import { randomUUID } from 'node:crypto';
import type { FastifyBaseLogger } from 'fastify';
import type { IMessageQueue } from '../domain/ports/IMessageQueue.js';
import type { ITenantCache } from '../domain/ports/ITenantCache.js';
import type { MetaWebhookValue } from '../domain/models/WebhookEnvelope.js';
import { TenantNotFoundError } from '../domain/errors.js';

export interface MetaWebhookPayload {
  object?: string;
  entry?: Array<{
    changes?: Array<{
      value?: MetaWebhookValue;
    }>;
  }>;
}

export interface ProcessWebhookDeps {
  tenantCache: ITenantCache;
  messageQueue: IMessageQueue;
  logger: FastifyBaseLogger;
}

/**
 * Application use case — orchestrates the full webhook processing pipeline:
 *   1. Extract all value objects from the parsed Meta payload
 *   2. For each value: resolve tenant_id via cache (Redis → Postgres fallback)
 *   3. Build a WebhookEnvelope and enqueue it on the Redis Stream
 *
 * This is intentionally side-effect-free from an HTTP perspective: all errors
 * are caught and logged. The caller (HTTP handler) has already returned 200 OK
 * to Meta by the time this runs, so failures here must never propagate upward.
 */
export class ProcessWebhookUseCase {
  private readonly tenantCache: ITenantCache;
  private readonly messageQueue: IMessageQueue;
  private readonly logger: FastifyBaseLogger;

  constructor({ tenantCache, messageQueue, logger }: ProcessWebhookDeps) {
    this.tenantCache = tenantCache;
    this.messageQueue = messageQueue;
    this.logger = logger;
  }

  async execute(payload: MetaWebhookPayload, receivedAt: string): Promise<void> {
    const entries = payload.entry ?? [];

    for (const entry of entries) {
      const changes = entry.changes ?? [];

      for (const change of changes) {
        const value = change.value;
        if (!value) continue;

        // Ignore non-message events (status updates, read receipts)
        const hasMessages = Array.isArray(value.messages) && value.messages.length > 0;
        if (!hasMessages) {
          this.logger.debug({ event: 'webhook.non_message_ignored' }, 'Ignoring non-message webhook event');
          continue;
        }

        const phoneNumberId = value.metadata?.phone_number_id;
        if (!phoneNumberId) {
          this.logger.warn({ event: 'webhook.missing_phone_number_id' }, 'No phone_number_id in metadata, skipping');
          continue;
        }

        let tenantId: string;
        try {
          tenantId = await this.tenantCache.getTenantId(phoneNumberId);
        } catch (err) {
          if (err instanceof TenantNotFoundError) {
            this.logger.warn(
              { event: 'webhook.unknown_phone_number', phone_number_id: phoneNumberId },
              'Unknown phone_number_id — skipping entry',
            );
            continue;
          }
          throw err;
        }

        const envelope = {
          message_id: randomUUID(),
          received_at: receivedAt,
          tenant_id: tenantId,
          phone_number_id: phoneNumberId,
          raw: value,
        };

        await this.messageQueue.publish(tenantId, envelope);

        this.logger.info(
          {
            event: 'webhook.enqueued',
            tenant_id: tenantId,
            phone_number_id: phoneNumberId,
            message_id: envelope.message_id,
          },
          'Webhook envelope enqueued',
        );
      }
    }
  }
}
