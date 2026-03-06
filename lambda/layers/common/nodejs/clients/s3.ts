import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logger } from '@common/utils/logger';
import { ExternalServiceError } from '@common/utils/errors';

/**
 * S3 client singleton
 */
let s3Client: S3Client | null = null;

/**
 * Get or create S3 client
 */
export function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      maxAttempts: 3,
    });
  }
  return s3Client;
}

/**
 * Generate a presigned URL for uploading
 */
export async function generateUploadUrl(
  bucket: string,
  key: string,
  contentType: string,
  expiresIn: number = 900 // 15 minutes
): Promise<string> {
  try {
    const client = getS3Client();
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });

    return await getSignedUrl(client, command, { expiresIn });
  } catch (error) {
    logger.error('Failed to generate upload URL', error as Error, { bucket, key });
    throw new ExternalServiceError('S3', 'Failed to generate upload URL');
  }
}

/**
 * Generate a presigned URL for downloading
 */
export async function generateDownloadUrl(
  bucket: string,
  key: string,
  expiresIn: number = 3600 // 1 hour
): Promise<string> {
  try {
    const client = getS3Client();
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    return await getSignedUrl(client, command, { expiresIn });
  } catch (error) {
    logger.error('Failed to generate download URL', error as Error, { bucket, key });
    throw new ExternalServiceError('S3', 'Failed to generate download URL');
  }
}

/**
 * Upload file to S3
 */
export async function uploadFile(
  bucket: string,
  key: string,
  body: Buffer | string,
  contentType: string,
  metadata?: Record<string, string>
): Promise<void> {
  try {
    const client = getS3Client();
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      Metadata: metadata,
    });

    await client.send(command);
    logger.info('File uploaded to S3', { bucket, key });
  } catch (error) {
    logger.error('Failed to upload file to S3', error as Error, { bucket, key });
    throw new ExternalServiceError('S3', 'Failed to upload file');
  }
}

/**
 * Get file from S3
 */
export async function getFile(
  bucket: string,
  key: string
): Promise<Buffer> {
  try {
    const client = getS3Client();
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const result = await client.send(command);
    const stream = result.Body;
    if (!stream) {
      throw new Error('Empty response body');
    }

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of stream as any) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  } catch (error) {
    logger.error('Failed to get file from S3', error as Error, { bucket, key });
    throw new ExternalServiceError('S3', 'Failed to get file');
  }
}

/**
 * Delete file from S3
 */
export async function deleteFile(bucket: string, key: string): Promise<void> {
  try {
    const client = getS3Client();
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await client.send(command);
    logger.info('File deleted from S3', { bucket, key });
  } catch (error) {
    logger.error('Failed to delete file from S3', error as Error, { bucket, key });
    throw new ExternalServiceError('S3', 'Failed to delete file');
  }
}

/**
 * Copy file within S3
 */
export async function copyFile(
  sourceBucket: string,
  sourceKey: string,
  destBucket: string,
  destKey: string
): Promise<void> {
  try {
    const client = getS3Client();
    const command = new CopyObjectCommand({
      CopySource: `${sourceBucket}/${sourceKey}`,
      Bucket: destBucket,
      Key: destKey,
    });

    await client.send(command);
    logger.info('File copied in S3', { sourceBucket, sourceKey, destBucket, destKey });
  } catch (error) {
    logger.error('Failed to copy file in S3', error as Error, {
      sourceBucket,
      sourceKey,
      destBucket,
      destKey,
    });
    throw new ExternalServiceError('S3', 'Failed to copy file');
  }
}

/**
 * List files in S3 prefix
 */
export async function listFiles(
  bucket: string,
  prefix: string,
  maxKeys: number = 1000
): Promise<string[]> {
  try {
    const client = getS3Client();
    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      MaxKeys: maxKeys,
    });

    const result = await client.send(command);
    return (result.Contents || []).map((item) => item.Key || '');
  } catch (error) {
    logger.error('Failed to list files in S3', error as Error, { bucket, prefix });
    throw new ExternalServiceError('S3', 'Failed to list files');
  }
}

/**
 * Check if file exists
 */
export async function fileExists(bucket: string, key: string): Promise<boolean> {
  try {
    const client = getS3Client();
    const command = new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await client.send(command);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get file metadata
 */
export async function getFileMetadata(
  bucket: string,
  key: string
): Promise<{ contentType?: string; contentLength?: number; metadata?: Record<string, string> }> {
  try {
    const client = getS3Client();
    const command = new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const result = await client.send(command);
    return {
      contentType: result.ContentType,
      contentLength: result.ContentLength,
      metadata: result.Metadata,
    };
  } catch (error) {
    logger.error('Failed to get file metadata', error as Error, { bucket, key });
    throw new ExternalServiceError('S3', 'Failed to get file metadata');
  }
}

export default {
  getS3Client,
  generateUploadUrl,
  generateDownloadUrl,
  uploadFile,
  getFile,
  deleteFile,
  copyFile,
  listFiles,
  fileExists,
  getFileMetadata,
};
