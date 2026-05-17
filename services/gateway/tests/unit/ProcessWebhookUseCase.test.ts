import type { IMessageQueue } from '../../src/domain/ports/IMessageQueue.js';
import type { ITenantCache } from '../../src/domain/ports/ITenantCache.js';
import type { WebhookEnvelope } from '../../src/domain/models/WebhookEnvelope.js';
import { TenantNotFoundError } from '../../src/domain/errors.js';
import { ProcessWebhookUseCase } from '../../src/application/ProcessWebhookUseCase.js';
import type { FastifyBaseLogger } from 'fastify';

// ---------------------------------------------------------------------------
// Hand-rolled in-memory fakes (no mocking library — fakes couple to ports only)
// ---------------------------------------------------------------------------

class FakeTenantCache implements ITenantCache {
  private readonly mapping: Map<string, string>;
  lookups: string[] = [];

  constructor(mapping: Record<string, string> = {}) {
    this.mapping = new Map(Object.entries(mapping));
  }

  async getTenantId(phoneNumberId: string): Promise<string> {
    this.lookups.push(phoneNumberId);
    const tenantId = this.mapping.get(phoneNumberId);
    if (!tenantId) throw new TenantNotFoundError(phoneNumberId);
    return tenantId;
  }
}

class FakeMessageQueue implements IMessageQueue {
  published: Array<{ tenantId: string; envelope: WebhookEnvelope }> = [];

  async publish(tenantId: string, envelope: WebhookEnvelope): Promise<void> {
    this.published.push({ tenantId, envelope });
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
// Sample Meta payload factories
// ---------------------------------------------------------------------------

function makePayload(phoneNumberId: string, messageId = 'wamid.test-001') {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        changes: [
          {
            value: {
              messaging_product: 'whatsapp' as const,
              metadata: {
                display_phone_number: '+1234567890',
                phone_number_id: phoneNumberId,
              },
              contacts: [{ profile: { name: 'Test User' }, wa_id: '5491155555555' }],
              messages: [
                {
                  from: '5491155555555',
                  id: messageId,
                  timestamp: '1716000000',
                  type: 'text' as const,
                  text: { body: 'Hello' },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

function makeStatusPayload(phoneNumberId: string) {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        changes: [
          {
            value: {
              messaging_product: 'whatsapp' as const,
              metadata: { phone_number_id: phoneNumberId },
              statuses: [{ id: 'wamid.status-001', status: 'delivered' }],
            },
          },
        ],
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProcessWebhookUseCase', () => {
  const PHONE_ID = 'PNID_0001';
  const TENANT_ID = 'tenant-uuid-0001';
  const RECEIVED_AT = '2026-05-16T12:00:00.000Z';

  test('happy path: enqueues with correct envelope shape', async () => {
    const cache = new FakeTenantCache({ [PHONE_ID]: TENANT_ID });
    const queue = new FakeMessageQueue();
    const useCase = new ProcessWebhookUseCase({ tenantCache: cache, messageQueue: queue, logger: noopLogger });

    await useCase.execute(makePayload(PHONE_ID), RECEIVED_AT);

    expect(queue.published).toHaveLength(1);
    const { tenantId, envelope } = queue.published[0];
    expect(tenantId).toBe(TENANT_ID);
    expect(envelope.tenant_id).toBe(TENANT_ID);
    expect(envelope.phone_number_id).toBe(PHONE_ID);
    expect(envelope.received_at).toBe(RECEIVED_AT);
    expect(envelope.message_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(envelope.raw.messaging_product).toBe('whatsapp');
    expect(envelope.raw.messages?.[0].id).toBe('wamid.test-001');
  });

  test('TenantNotFoundError: skips enqueue and logs warning (no throw)', async () => {
    const cache = new FakeTenantCache({}); // empty — nothing maps PHONE_ID
    const queue = new FakeMessageQueue();
    const useCase = new ProcessWebhookUseCase({ tenantCache: cache, messageQueue: queue, logger: noopLogger });

    await expect(useCase.execute(makePayload(PHONE_ID), RECEIVED_AT)).resolves.toBeUndefined();
    expect(queue.published).toHaveLength(0);
  });

  test('non-message events (status updates) are silently ignored', async () => {
    const cache = new FakeTenantCache({ [PHONE_ID]: TENANT_ID });
    const queue = new FakeMessageQueue();
    const useCase = new ProcessWebhookUseCase({ tenantCache: cache, messageQueue: queue, logger: noopLogger });

    await useCase.execute(makeStatusPayload(PHONE_ID), RECEIVED_AT);

    expect(queue.published).toHaveLength(0);
  });

  test('empty payload (no entry) resolves without error', async () => {
    const cache = new FakeTenantCache({});
    const queue = new FakeMessageQueue();
    const useCase = new ProcessWebhookUseCase({ tenantCache: cache, messageQueue: queue, logger: noopLogger });

    await expect(useCase.execute({}, RECEIVED_AT)).resolves.toBeUndefined();
    expect(queue.published).toHaveLength(0);
  });

  test('missing phone_number_id in metadata is skipped gracefully', async () => {
    const cache = new FakeTenantCache({ [PHONE_ID]: TENANT_ID });
    const queue = new FakeMessageQueue();
    const useCase = new ProcessWebhookUseCase({ tenantCache: cache, messageQueue: queue, logger: noopLogger });

    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                messaging_product: 'whatsapp' as const,
                metadata: { phone_number_id: '' }, // empty
                messages: [{ from: '123', id: 'wamid.x', timestamp: '1', type: 'text' as const }],
              },
            },
          ],
        },
      ],
    };

    // empty phone_number_id treated as falsy — skipped
    await expect(useCase.execute(payload, RECEIVED_AT)).resolves.toBeUndefined();
    expect(queue.published).toHaveLength(0);
  });
});
