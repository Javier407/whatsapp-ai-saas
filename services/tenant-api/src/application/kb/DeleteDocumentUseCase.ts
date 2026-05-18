import { randomUUID } from 'crypto';
import type { IKbDocumentRepo } from '../../domain/ports/IKbDocumentRepo.js';
import type { IMessageQueue } from '../../domain/ports/IMessageQueue.js';
import type { IStoragePort } from '../../domain/ports/IStoragePort.js';
import { NotFoundError } from '../../domain/errors.js';

export class DeleteDocumentUseCase {
  constructor(
    private readonly kbRepo: IKbDocumentRepo,
    private readonly storage: IStoragePort,
    private readonly queue: IMessageQueue,
  ) {}

  async execute(tenantId: string, documentId: string): Promise<void> {
    const doc = await this.kbRepo.findById(documentId);
    if (!doc || doc.tenantId !== tenantId) {
      throw new NotFoundError('KnowledgeBaseDocument', documentId);
    }

    // Delete from storage first; if DB delete fails the file is orphaned
    // but the DB record will block re-use. Acceptable for MVP.
    await this.storage.delete(doc.storageUri);
    await this.kbRepo.delete(documentId);

    // Enqueue a deletion job so rag-indexer removes the vectors from ChromaDB.
    // Fire-and-forget: if the enqueue fails the vectors remain orphaned but
    // the DB record is already gone so they cannot be queried.
    await this.queue.enqueueDeletionJob(tenantId, {
      job_id: randomUUID(),
      tenant_id: tenantId,
      document_id: documentId,
      job_type: 'delete',
      enqueued_at: new Date().toISOString(),
    });
  }
}
