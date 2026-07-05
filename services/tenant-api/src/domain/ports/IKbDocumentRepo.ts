import type { KbDocument, SourceType, DocumentStatus } from '../models/KbDocument.js';

export interface CreateKbDocumentInput {
  tenantId: string;
  name: string;
  sourceType: SourceType;
  storageUri: string;
}

export interface IKbDocumentRepo {
  findById(tenantId: string, id: string): Promise<KbDocument | null>;
  listByTenant(tenantId: string): Promise<KbDocument[]>;
  countByTenant(tenantId: string): Promise<number>;
  create(input: CreateKbDocumentInput): Promise<KbDocument>;
  updateStatus(id: string, status: DocumentStatus, errorMessage?: string): Promise<KbDocument>;
  delete(tenantId: string, id: string): Promise<void>;
}
