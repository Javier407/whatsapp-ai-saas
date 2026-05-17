import type Redis from 'ioredis';
import type { IMessageQueue, IndexingJobPayload } from '../../domain/ports/IMessageQueue.js';
import { ExternalServiceError } from '../../domain/errors.js';

/**
 * Writes an indexing job to the Redis Stream `indexing:{tenantId}`.
 * Uses XADD with MAXLEN ~ 10000 for bounded memory.
 */
export class RedisIndexingQueue implements IMessageQueue {
  constructor(private readonly redis: Redis) {}

  async enqueueIndexingJob(tenantId: string, payload: IndexingJobPayload): Promise<void> {
    const streamKey = `indexing:${tenantId}`;

    try {
      await this.redis.xadd(
        streamKey,
        'MAXLEN',
        '~',
        '10000',
        '*', // auto-generate stream ID
        'job_id', payload.job_id,
        'tenant_id', payload.tenant_id,
        'document_id', payload.document_id,
        'storage_uri', payload.storage_uri,
        'source_type', payload.source_type,
        'name', payload.name,
        'embedder', payload.embedder,
        'enqueued_at', payload.enqueued_at,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new ExternalServiceError('Redis', `XADD failed: ${message}`);
    }
  }
}
