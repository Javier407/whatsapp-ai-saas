import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';
import type { IKbDocumentRepo } from '../../domain/ports/IKbDocumentRepo.js';
import type { IStoragePort } from '../../domain/ports/IStoragePort.js';
import type { IMessageQueue } from '../../domain/ports/IMessageQueue.js';
import type { KbDocument, SourceType } from '../../domain/models/KbDocument.js';
import { ValidationError, QuotaExceededError } from '../../domain/errors.js';

const ALLOWED_SOURCE_TYPES: SourceType[] = ['text', 'pdf', 'faq_json', 'markdown'];

export interface UploadDocumentInput {
  tenantId: string;
  name: string;
  sourceType: string;
  stream: Readable;
  filename: string;
  contentType: string;
  fileSize?: number;
}

export class UploadDocumentUseCase {
  private readonly maxFileSizeBytes: number;
  private readonly maxDocuments: number;

  constructor(
    private readonly kbRepo: IKbDocumentRepo,
    private readonly storage: IStoragePort,
    private readonly queue: IMessageQueue,
    maxFileSizeMb = 10,
    maxDocuments = 100,
  ) {
    this.maxFileSizeBytes = maxFileSizeMb * 1024 * 1024;
    this.maxDocuments = maxDocuments;
  }

  async execute(input: UploadDocumentInput): Promise<KbDocument> {
    // Validate source_type
    if (!ALLOWED_SOURCE_TYPES.includes(input.sourceType as SourceType)) {
      throw new ValidationError(
        `Invalid source_type '${input.sourceType}'. Allowed: ${ALLOWED_SOURCE_TYPES.join(', ')}`,
      );
    }

    // Check file size if provided by the multipart handler
    if (input.fileSize !== undefined && input.fileSize > this.maxFileSizeBytes) {
      throw new ValidationError(
        `File too large: ${Math.round(input.fileSize / (1024 * 1024))}MB exceeds ${this.maxFileSizeBytes / (1024 * 1024)}MB limit`,
      );
    }

    // Enforce per-tenant document quota before upload
    const count = await this.kbRepo.countByTenant(input.tenantId);
    if (count >= this.maxDocuments) {
      throw new QuotaExceededError('knowledge base documents', this.maxDocuments);
    }

    const documentId = randomUUID();

    // Stream upload directly to MinIO — no full-buffer in memory
    const storageUri = await this.storage.upload({
      tenantId: input.tenantId,
      documentId,
      filename: input.filename,
      stream: input.stream,
      contentType: input.contentType,
      size: input.fileSize,
    });

    // Insert DB record with status=pending
    const doc = await this.kbRepo.create({
      tenantId: input.tenantId,
      name: input.name,
      sourceType: input.sourceType as SourceType,
      storageUri,
    });

    // Enqueue indexing job
    const jobId = randomUUID();
    await this.queue.enqueueIndexingJob(input.tenantId, {
      job_id: jobId,
      tenant_id: input.tenantId,
      document_id: doc.id,
      storage_uri: storageUri,
      source_type: input.sourceType,
      name: input.name,
      embedder: 'default',
      enqueued_at: new Date().toISOString(),
    });

    return doc;
  }
}
