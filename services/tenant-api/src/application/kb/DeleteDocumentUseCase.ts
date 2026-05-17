import type { IKbDocumentRepo } from '../../domain/ports/IKbDocumentRepo.js';
import type { IStoragePort } from '../../domain/ports/IStoragePort.js';
import { NotFoundError } from '../../domain/errors.js';

export class DeleteDocumentUseCase {
  constructor(
    private readonly kbRepo: IKbDocumentRepo,
    private readonly storage: IStoragePort,
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

    // TODO: enqueue a ChromaDB deletion job for the rag-indexer to clean up embeddings
  }
}
