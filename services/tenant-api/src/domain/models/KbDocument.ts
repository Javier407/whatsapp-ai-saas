export type SourceType = 'text' | 'pdf' | 'faq_json' | 'markdown';
export type DocumentStatus = 'pending' | 'indexing' | 'indexed' | 'failed';

export interface KbDocument {
  id: string;
  tenantId: string;
  name: string;
  sourceType: SourceType;
  storageUri: string;
  status: DocumentStatus;
  chunkCount: number | null;
  errorMessage: string | null;
  uploadedAt: Date;
  indexedAt: Date | null;
}
