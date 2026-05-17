import { createHmac } from 'node:crypto';
import Fastify from 'fastify';
import type { FastifyInstance, FastifyBaseLogger } from 'fastify';
import { webhookRoutes } from '../../src/interfaces/http/webhookRoutes.js';
import { healthRoutes } from '../../src/interfaces/http/healthRoutes.js';
import { SignatureVerifier } from '../../src/infrastructure/meta/SignatureVerifier.js';
import type { IMessageQueue } from '../../src/domain/ports/IMessageQueue.js';
import type { ITenantCache } from '../../src/domain/ports/ITenantCache.js';
import type { WebhookEnvelope } from '../../src/domain/models/WebhookEnvelope.js';
import { ProcessWebhookUseCase } from '../../src/application/ProcessWebhookUseCase.js';
import { TenantNotFoundError } from '../../src/domain/errors.js';
import type { Redis } from 'ioredis';

// ---------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------

class FakeTenantCache implements ITenantCache {
  constructor(private readonly resolves: boolean = true) {}
  async getTenantId(phoneNumberId: string): Promise<string> {
    if (!this.resolves) throw new TenantNotFoundError(phoneNumberId);
    return 'tenant-uuid-test';
  }
}

class FakeMessageQueue implements IMessageQueue {
  published: WebhookEnvelope[] = [];
  async publish(_tenantId: string, envelope: WebhookEnvelope): Promise<void> {
    this.published.push(envelope);
  }
}

class FakeRedis {
  private readonly reachable: boolean;
  constructor(reachable = true) {
    this.reachable = reachable;
  }
  async ping(): Promise<string> {
    if (!this.reachable) throw new Error('Connection refused');
    return 'PONG';
  }
}

const noopLogger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  fatal: () => undefined,
  trace: () => undefined,
  child: () => noopLogger,
} as unknown as FastifyBaseLogger;

// ---------------------------------------------------------------------------
// App factory for tests — uses inject() instead of real HTTP
// ---------------------------------------------------------------------------

const SECRET = 'integration-test-secret';
const VERIFY_TOKEN = 'my-verify-token';

function makeBody(phoneNumberId = 'PNID_INTEGRATION') {
  return JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [
      {
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: { phone_number_id: phoneNumberId, display_phone_number: '+1' },
              contacts: [{ profile: { name: 'Tester' }, wa_id: '54911' }],
              messages: [
                {
                  from: '54911',
                  id: 'wamid.integration-001',
                  timestamp: '1716000000',
                  type: 'text',
                  text: { body: 'Hi' },
                },
              ],
            },
          },
        ],
      },
    ],
  });
}

function sign(body: string, secret: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(Buffer.from(body)).digest('hex');
}

async function buildTestApp(opts: {
  tenantResolves?: boolean;
  redisReachable?: boolean;
} = {}): Promise<FastifyInstance> {
  const fastify = Fastify({ logger: false });

  const tenantCache = new FakeTenantCache(opts.tenantResolves ?? true);
  const queue = new FakeMessageQueue();
  const signatureVerifier = new SignatureVerifier(SECRET);
  const processWebhookUseCase = new ProcessWebhookUseCase({
    tenantCache,
    messageQueue: queue,
    logger: noopLogger,
  });
  const fakeRedis = new FakeRedis(opts.redisReachable ?? true);

  await fastify.register(webhookRoutes, {
    verifyToken: VERIFY_TOKEN,
    signatureVerifier,
    processWebhookUseCase,
  });

  await fastify.register(healthRoutes, {
    redis: fakeRedis as unknown as Redis,
  });

  await fastify.ready();
  return fastify;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /webhook (Meta handshake)', () => {
  let app: FastifyInstance;
  beforeAll(async () => { app = await buildTestApp(); });
  afterAll(async () => { await app.close(); });

  test('200 + challenge echoed with correct token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/webhook?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=abc123`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe('abc123');
  });

  test('403 with wrong token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=abc123',
    });
    expect(res.statusCode).toBe(403);
  });

  test('403 when mode is not subscribe', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/webhook?hub.mode=unsubscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=abc123`,
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('POST /webhook', () => {
  let app: FastifyInstance;
  beforeAll(async () => { app = await buildTestApp(); });
  afterAll(async () => { await app.close(); });

  test('200 immediately with valid HMAC', async () => {
    const body = makeBody();
    const res = await app.inject({
      method: 'POST',
      url: '/webhook',
      headers: {
        'content-type': 'application/json',
        'x-hub-signature-256': sign(body, SECRET),
      },
      payload: body,
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ status: 'ok' });
  });

  test('403 with invalid HMAC', async () => {
    const body = makeBody();
    const res = await app.inject({
      method: 'POST',
      url: '/webhook',
      headers: {
        'content-type': 'application/json',
        'x-hub-signature-256': 'sha256=badhash',
      },
      payload: body,
    });
    expect(res.statusCode).toBe(403);
  });

  test('403 with missing signature header', async () => {
    const body = makeBody();
    const res = await app.inject({
      method: 'POST',
      url: '/webhook',
      headers: { 'content-type': 'application/json' },
      payload: body,
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('GET /readyz', () => {
  test('200 when Redis is reachable', async () => {
    const app = await buildTestApp({ redisReachable: true });
    const res = await app.inject({ method: 'GET', url: '/readyz' });
    expect(res.statusCode).toBe(200);
    await app.close();
  });

  test('503 when Redis is unreachable', async () => {
    const app = await buildTestApp({ redisReachable: false });
    const res = await app.inject({ method: 'GET', url: '/readyz' });
    expect(res.statusCode).toBe(503);
    await app.close();
  });
});

describe('GET /healthz', () => {
  let app: FastifyInstance;
  beforeAll(async () => { app = await buildTestApp(); });
  afterAll(async () => { await app.close(); });

  test('always 200', async () => {
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ status: 'ok' });
  });
});
