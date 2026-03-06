import {
  TextractClient,
  StartDocumentTextDetectionCommand,
  GetDocumentTextDetectionCommand,
  StartDocumentAnalysisCommand,
  GetDocumentAnalysisCommand,
  FeatureType,
} from '@aws-sdk/client-textract';
import { logger } from '@common/utils/logger';
import { ExternalServiceError } from '@common/utils/errors';

/**
 * Textract client singleton
 */
let textractClient: TextractClient | null = null;

/**
 * Get or create Textract client
 */
export function getTextractClient(): TextractClient {
  if (!textractClient) {
    textractClient = new TextractClient({
      region: process.env.AWS_REGION || 'us-east-1',
      maxAttempts: 3,
    });
  }
  return textractClient;
}

/**
 * Start document text detection (async job)
 */
export async function startDocumentTextDetection(
  s3Bucket: string,
  s3Key: string
): Promise<string> {
  try {
    const client = getTextractClient();
    const command = new StartDocumentTextDetectionCommand({
      DocumentLocation: {
        S3Object: {
          Bucket: s3Bucket,
          Name: s3Key,
        },
      },
    });

    const result = await client.send(command);
    logger.info('Textract job started', { jobId: result.JobId });
    return result.JobId || '';
  } catch (error) {
    logger.error('Failed to start text detection', error as Error, { s3Bucket, s3Key });
    throw new ExternalServiceError('Textract', 'Failed to start text detection');
  }
}

/**
 * Get document text detection results
 */
export async function getDocumentTextDetection(
  jobId: string
): Promise<Array<{ text: string; confidence: number; boundingBox?: unknown }>> {
  try {
    const client = getTextractClient();
    const command = new GetDocumentTextDetectionCommand({
      JobId: jobId,
    });

    const result = await client.send(command);

    const lines = (result.Blocks || [])
      .filter((block) => block.BlockType === 'LINE')
      .map((block) => ({
        text: block.Text || '',
        confidence: block.Confidence || 0,
        boundingBox: block.Geometry,
      }));

    return lines;
  } catch (error) {
    logger.error('Failed to get text detection results', error as Error, { jobId });
    throw new ExternalServiceError('Textract', 'Failed to get text detection results');
  }
}

/**
 * Start document analysis (with tables and forms)
 */
export async function startDocumentAnalysis(
  s3Bucket: string,
  s3Key: string,
  featureTypes: FeatureType[] = ['TABLES', 'FORMS']
): Promise<string> {
  try {
    const client = getTextractClient();
    const command = new StartDocumentAnalysisCommand({
      DocumentLocation: {
        S3Object: {
          Bucket: s3Bucket,
          Name: s3Key,
        },
      },
      FeatureTypes: featureTypes,
    });

    const result = await client.send(command);
    logger.info('Textract analysis job started', { jobId: result.JobId });
    return result.JobId || '';
  } catch (error) {
    logger.error('Failed to start document analysis', error as Error, { s3Bucket, s3Key });
    throw new ExternalServiceError('Textract', 'Failed to start document analysis');
  }
}

/**
 * Get document analysis results (tables and forms)
 */
export async function getDocumentAnalysis(
  jobId: string
): Promise<{
  tables: unknown[];
  forms: unknown[];
  lines: Array<{ text: string; confidence: number }>;
}> {
  try {
    const client = getTextractClient();
    const command = new GetDocumentAnalysisCommand({
      JobId: jobId,
    });

    const result = await client.send(command);

    const lines: Array<{ text: string; confidence: number }> = [];
    const tables: unknown[] = [];
    const forms: unknown[] = [];

    for (const block of result.Blocks || []) {
      if (block.BlockType === 'LINE') {
        lines.push({
          text: block.Text || '',
          confidence: block.Confidence || 0,
        });
      } else if (block.BlockType === 'TABLE') {
        tables.push(block);
      } else if (block.BlockType === 'KEY_VALUE_SET') {
        forms.push(block);
      }
    }

    return { tables, forms, lines };
  } catch (error) {
    logger.error('Failed to get document analysis results', error as Error, { jobId });
    throw new ExternalServiceError('Textract', 'Failed to get document analysis results');
  }
}

/**
 * Extract text from PDF document
 */
export async function extractTextFromPDF(
  s3Bucket: string,
  s3Key: string
): Promise<string> {
  try {
    // Start async job
    const jobId = await startDocumentTextDetection(s3Bucket, s3Key);

    // Poll for completion (in production, use S3 event notification + SQS)
    let status = 'IN_PROGRESS';
    let attempts = 0;
    const maxAttempts = 30;

    while (status === 'IN_PROGRESS' && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds
      const client = getTextractClient();
      const command = new GetDocumentTextDetectionCommand({ JobId: jobId });
      const result = await client.send(command);
      status = result.JobStatus || 'FAILED';
      attempts++;
    }

    if (status !== 'SUCCEEDED') {
      throw new Error(`Textract job failed with status: ${status}`);
    }

    // Get the results
    const lines = await getDocumentTextDetection(jobId);
    return lines.map((line) => line.text).join('\n');
  } catch (error) {
    logger.error('Failed to extract text from PDF', error as Error, { s3Bucket, s3Key });
    throw new ExternalServiceError('Textract', 'Failed to extract text from PDF');
  }
}

export default {
  getTextractClient,
  startDocumentTextDetection,
  getDocumentTextDetection,
  startDocumentAnalysis,
  getDocumentAnalysis,
  extractTextFromPDF,
};
