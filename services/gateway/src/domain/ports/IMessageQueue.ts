import type { WebhookEnvelope } from '../models/WebhookEnvelope.js';

/**
 * Port — publishes a verified webhook envelope onto the async message queue.
 * Infrastructure implementations: RedisMessageQueue (via XADD to Redis Streams).
 */
export interface IMessageQueue {
  publish(tenantId: string, envelope: WebhookEnvelope): Promise<void>;
}
