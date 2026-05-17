import type { PrismaClient } from '@prisma/client';
import type {
  IKbDocumentRepo,
  CreateKbDocumentInput,
} from '../../domain/ports/IKbDocumentRepo.js';
import type { KbDocument, DocumentStatus } from '../../domain/models/KbDocument.js';

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

  async findById(id: string): Promise<KbDocument | null> {
    const row = await this.prisma.knowledgeBaseDocument.findUnique({ where: { id } });
    return row ? mapDoc(row) : null;
  }

  async listByTenant(tenantId: string): Promise<KbDocument[]> {
    const rows = await this.prisma.knowledgeBaseDocument.findMany({
      where: { tenantId },
      orderBy: { uploadedAt: 'desc' },
    });
    return rows.map(mapDoc);
  }

  async countByTenant(tenantId: string): Promise<number> {
    return this.prisma.knowledgeBaseDocument.count({ where: { tenantId } });
  }

  async create(input: CreateKbDocumentInput): Promise<KbDocument> {
    const row = await this.prisma.knowledgeBaseDocument.create({
      data: {
        tenantId: input.tenantId,
        name: input.name,
        sourceType: input.sourceType as never,
        storageUri: input.storageUri,
      },
    });
    return mapDoc(row);
  }

  async updateStatus(
    id: string,
    status: DocumentStatus,
    errorMessage?: string,
  ): Promise<KbDocument> {
    const row = await this.prisma.knowledgeBaseDocument.update({
      where: { id },
      data: {
        status: status as never,
        ...(errorMessage !== undefined && { errorMessage }),
        ...(status === 'indexed' && { indexedAt: new Date() }),
      },
    });
    return mapDoc(row);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.knowledgeBaseDocument.delete({ where: { id } });
  }
}
