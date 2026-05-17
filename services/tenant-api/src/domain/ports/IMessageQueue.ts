export interface IndexingJobPayload {
  job_id: string;
  tenant_id: string;
  document_id: string;
  storage_uri: string;
  source_type: string;
  name: string;
  embedder: string;
  enqueued_at: string; // ISO 8601
}

export interface IMessageQueue {
  enqueueIndexingJob(tenantId: string, payload: IndexingJobPayload): Promise<void>;
}
