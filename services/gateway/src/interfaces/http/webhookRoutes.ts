import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { SignatureVerifier } from '../../infrastructure/meta/SignatureVerifier.js';
import type { ProcessWebhookUseCase, MetaWebhookPayload } from '../../application/ProcessWebhookUseCase.js';
import { SignatureVerificationError } from '../../domain/errors.js';

interface WebhookVerifyQuerystring {
  'hub.mode': string;
  'hub.verify_token': string;
  'hub.challenge': string;
}

export interface WebhookRouteDeps {
  verifyToken: string;
  signatureVerifier: SignatureVerifier;
  processWebhookUseCase: ProcessWebhookUseCase;
}

/**
 * Registers the Meta webhook routes:
 *
 *   GET  /webhook  — Meta verification handshake
 *   POST /webhook  — Inbound message events
 *
 * POST /webhook contract:
 * - Signature is verified synchronously before responding.
 * - 200 OK is sent IMMEDIATELY after signature verification. Meta enforces a
 *   strict 20s (practical ~250ms for SLA) response window; any async work
 *   after the 200 must not block the response.
 * - All downstream processing (tenant lookup, enqueue) runs asynchronously
 *   and errors are caught + logged without affecting the 200 response.
 */
export async function webhookRoutes(
  fastify: FastifyInstance,
  deps: WebhookRouteDeps,
): Promise<void> {
  const { verifyToken, signatureVerifier, processWebhookUseCase } = deps;

  // -----------------------------------------------------------------------
  // Preserve raw body bytes for HMAC verification.
  // Fastify does NOT expose raw body by default — we add a content type parser
  // that stashes the raw Buffer on the request object before JSON parsing.
  // -----------------------------------------------------------------------
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (req, body, done) => {
      try {
        const parsed = JSON.parse((body as Buffer).toString('utf8')) as unknown;
        // Attach the raw bytes so the POST handler can verify the signature
        (req as FastifyRequest & { rawBody?: Buffer }).rawBody = body as Buffer;
        done(null, parsed);
      } catch (err) {
        done(err instanceof Error ? err : new Error(String(err)));
      }
    },
  );

  // -----------------------------------------------------------------------
  // GET /webhook — Meta verification handshake
  // -----------------------------------------------------------------------
  fastify.get<{ Querystring: WebhookVerifyQuerystring }>(
    '/webhook',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            'hub.mode': { type: 'string' },
            'hub.verify_token': { type: 'string' },
            'hub.challenge': { type: 'string' },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: WebhookVerifyQuerystring }>, reply: FastifyReply): Promise<void> => {
      const mode = request.query['hub.mode'];
      const token = request.query['hub.verify_token'];
      const challenge = request.query['hub.challenge'];

      if (mode === 'subscribe' && token === verifyToken) {
        request.log.info({ event: 'webhook.handshake_ok' }, 'Meta webhook handshake succeeded');
        await reply.status(200).type('text/plain').send(challenge);
        return;
      }

      request.log.warn(
        { event: 'webhook.handshake_failed', mode, token_match: token === verifyToken },
        'Meta webhook handshake rejected',
      );
      await reply.status(403).send({ error: 'Forbidden' });
    },
  );

  // -----------------------------------------------------------------------
  // POST /webhook — Inbound message events
  // -----------------------------------------------------------------------
  fastify.post(
    '/webhook',
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const rawBody = (request as FastifyRequest & { rawBody?: Buffer }).rawBody;
      const signatureHeader = request.headers['x-hub-signature-256'] as string | undefined;

      // 1. Verify HMAC signature — the only synchronous guard before 200.
      try {
        signatureVerifier.verify(rawBody ?? Buffer.alloc(0), signatureHeader);
      } catch (err) {
        if (err instanceof SignatureVerificationError) {
          request.log.warn(
            { event: 'webhook.signature_invalid', err: err.message },
            'Webhook signature verification failed',
          );
          await reply.status(403).send({ error: 'Forbidden' });
          return;
        }
        throw err;
      }

      // 2. Reply 200 OK IMMEDIATELY — before any async processing.
      //    Meta requires acknowledgement within its SLA window.
      await reply.status(200).send({ status: 'ok' });

      // 3. Process asynchronously — errors are fully contained here.
      const payload = request.body as MetaWebhookPayload;
      const receivedAt = new Date().toISOString();

      processWebhookUseCase.execute(payload, receivedAt).catch((err: unknown) => {
        request.log.error(
          { event: 'webhook.process_error', err },
          'Async webhook processing failed',
        );
      });
    },
  );
}
