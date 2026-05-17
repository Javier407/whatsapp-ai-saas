import * as Minio from 'minio';
import type { IStoragePort, UploadInput } from '../../domain/ports/IStoragePort.js';
import { ExternalServiceError } from '../../domain/errors.js';

export interface MinioConfig {
  endPoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  bucket: string;
}

export class MinioStorageAdapter implements IStoragePort {
  private readonly client: Minio.Client;
  private readonly bucket: string;

  constructor(config: MinioConfig) {
    this.client = new Minio.Client({
      endPoint: config.endPoint,
      port: config.port,
      useSSL: config.useSSL,
      accessKey: config.accessKey,
      secretKey: config.secretKey,
    });
    this.bucket = config.bucket;
  }

  /**
   * Streams the upload directly to MinIO without buffering in memory.
   * Returns the storageUri: `kb-documents/{tenantId}/{documentId}/{filename}`
   */
  async upload(input: UploadInput): Promise<string> {
    const objectName = `kb-documents/${input.tenantId}/${input.documentId}/${input.filename}`;
    const metaData = { 'Content-Type': input.contentType };

    try {
      await this.client.putObject(
        this.bucket,
        objectName,
        input.stream,
        input.size,
        metaData,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new ExternalServiceError('MinIO', `Upload failed: ${message}`);
    }

    return `s3://${this.bucket}/${objectName}`;
  }

  async delete(storageUri: string): Promise<void> {
    const objectName = this.parseObjectName(storageUri);
    try {
      await this.client.removeObject(this.bucket, objectName);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new ExternalServiceError('MinIO', `Delete failed: ${message}`);
    }
  }

  async getSignedUrl(storageUri: string, expirySeconds: number): Promise<string> {
    const objectName = this.parseObjectName(storageUri);
    try {
      return await this.client.presignedGetObject(this.bucket, objectName, expirySeconds);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new ExternalServiceError('MinIO', `Presign failed: ${message}`);
    }
  }

  private parseObjectName(storageUri: string): string {
    // Strip s3://bucket/ prefix
    const prefix = `s3://${this.bucket}/`;
    if (!storageUri.startsWith(prefix)) {
      throw new Error(`Invalid storageUri: ${storageUri}`);
    }
    return storageUri.slice(prefix.length);
  }
}
