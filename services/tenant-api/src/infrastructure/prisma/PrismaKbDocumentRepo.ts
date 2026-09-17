import type { PrismaClient } from '@prisma/client';
import type {
  IKbDocumentRepo,
  CreateKbDocumentInput,
} from '../../domain/ports/IKbDocumentRepo.js';
import type { KbDocument, DocumentStatus } from '../../domain/models/KbDocument.js';
import { withRls } from './withRls.js';

function mapDoc(row: {
  id: string;
  tenantId: string;
  name: string;
  sourceType: string;
  storageUri: string;
  status: string;
  chunkCount: number | null;
  errorMessage: string | null;
  uploadedAt: Date;
  indexedAt: Date | null;
}): KbDocument {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    sourceType: row.sourceType as KbDocument['sourceType'],
    storageUri: row.storageUri,
    status: row.status as KbDocument['status'],
    chunkCount: row.chunkCount,
    errorMessage: row.errorMessage,
    uploadedAt: row.uploadedAt,
    indexedAt: row.indexedAt,
  };
}

export class PrismaKbDocumentRepo implements IKbDocumentRepo {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(tenantId: string, id: string): Promise<KbDocument | null> {
    const row = await withRls(
      this.prisma,
      (tx) => tx.knowledgeBaseDocument.findUnique({ where: { id } }),
      tenantId,
    );
    return row ? mapDoc(row) : null;
  }

  async listByTenant(tenantId: string): Promise<KbDocument[]> {
    const rows = await withRls(
      this.prisma,
      (tx) =>
        tx.knowledgeBaseDocument.findMany({
          where: { tenantId },
          orderBy: { uploadedAt: 'desc' },
        }),
      tenantId,
    );
    return rows.map(mapDoc);
  }

  async countByTenant(tenantId: string): Promise<number> {
    return withRls(
      this.prisma,
      (tx) => tx.knowledgeBaseDocument.count({ where: { tenantId } }),
      tenantId,
    );
  }

  async create(input: CreateKbDocumentInput): Promise<KbDocument> {
    const row = await withRls(
      this.prisma,
      (tx) =>
        tx.knowledgeBaseDocument.create({
          data: {
            tenantId: input.tenantId,
            name: input.name,
            sourceType: input.sourceType as never,
            storageUri: input.storageUri,
          },
        }),
      input.tenantId,
    );
    return mapDoc(row);
  }

  async updateStatus(
    id: string,
    status: DocumentStatus,
    errorMessage?: string,
  ): Promise<KbDocument> {
    const row = await withRls(this.prisma, (tx) =>
      tx.knowledgeBaseDocument.update({
        where: { id },
        data: {
          status: status as never,
          ...(errorMessage !== undefined && { errorMessage }),
          ...(status === 'indexed' && { indexedAt: new Date() }),
        },
      }),
    );
    return mapDoc(row);
  }

  async delete(tenantId: string, id: string): Promise<void> {
    await withRls(
      this.prisma,
      (tx) => tx.knowledgeBaseDocument.delete({ where: { id } }),
      tenantId,
    );
  }
}
