import type { Readable } from 'node:stream';

export interface UploadInput {
  tenantId: string;
  documentId: string;
  filename: string;
  stream: Readable;
  contentType: string;
  size?: number;
}

export interface IStoragePort {
  upload(input: UploadInput): Promise<string>; // returns storageUri
  delete(storageUri: string): Promise<void>;
  getSignedUrl(storageUri: string, expirySeconds: number): Promise<string>;
}
