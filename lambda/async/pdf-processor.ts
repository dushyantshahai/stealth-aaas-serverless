/**
 * PDF Processing Orchestrator
 * 
 * Coordinates the complete PDF processing pipeline:
 * 1. Download PDF from S3
 * 2. Extract text using Gemini 3 Flash
 * 3. Extract TOC using Gemini 3 Flash
 * 4. Create page-aware chunks with 3-priority logic
 * 5. Generate embeddings
 * 6. Update book status
 */

import { SQSHandler, SQSBatchResponse } from 'aws-lambda';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { SQSClient, SendMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { getLogger } from '@common/utils/logger';
import { extractPdfText, extractTextFromPages } from './utils/pdf-text-extractor';
import { extractToc } from './toc-extractor';
import { createPageAwareChunks } from './text-chunker';

const logger = getLogger('pdf-processor');

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const sqsClient = new SQSClient({ region: process.env.AWS_REGION || 'us-east-1' });

const BOOKS_TABLE = `stealth-aaas-${process.env.STAGE || 'dev'}-books`;
const PDF_PROCESSING_QUEUE = `stealth-aaas-${process.env.STAGE || 'dev'}-pdf-processing`;

interface S3EventRecord {
  s3: {
    bucket: { name: string };
    object: { key: string; size: number };
  };
}

interface ProcessingResult {
  success: boolean;
  bookId: string;
  steps: {
    textExtraction: boolean;
    tocExtraction: boolean;
    chunking: boolean;
  };
  metrics?: {
    totalPages: number;
    totalChunks: number;
    chaptersCount: number;
    topicsCount: number;
    subtopicsCount: number;
  };
  error?: string;
}

/**
 * Update book status in DynamoDB
 */
async function updateBookStatus(
  bookId: string,
  status: 'PROCESSING' | 'PROCESSED' | 'FAILED',
  error?: string
): Promise<void> {
  const updateExpression = status === 'FAILED'
    ? 'SET #status = :status, processingError = :error, processedAt = :processedAt'
    : 'SET #status = :status, processedAt = :processedAt';

  const expressionAttributeNames = { '#status': 'status' };
  const expressionAttributeValues: Record<string, any> = {
    ':status': status,
    ':processedAt': new Date().toISOString(),
  };

  if (error) {
    expressionAttributeValues[':error'] = error;
  }

  await docClient.send(new UpdateCommand({
    TableName: BOOKS_TABLE,
    Key: { bookId },
    UpdateExpression: updateExpression,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
  }));

  logger.info('Book status updated', { bookId, status });
}

/**
 * Main processing function for a single PDF
 */
async function processPdf(
  bookId: string,
  s3Bucket: string,
  s3Key: string
): Promise<ProcessingResult> {
  logger.info('Processing PDF', { bookId, s3Bucket, s3Key });

  const result: ProcessingResult = {
    success: false,
    bookId,
    steps: { textExtraction: false, tocExtraction: false, chunking: false },
  };

  try {
    // Step 1: Extract text from PDF using Gemini 3 Flash
    logger.info('Step 1: Extracting text from PDF using Gemini 3 Flash');
    const extractedText = await extractPdfText(s3Bucket, s3Key);
    result.steps.textExtraction = true;
    logger.info('Text extraction complete', { 
      totalPages: extractedText.totalPages,
      textLength: extractedText.text.length 
    });

    // Step 2: Extract TOC using Gemini 3 Flash
    logger.info('Step 2: Extracting TOC using Gemini 3 Flash');
    const tocResult = await extractToc(bookId, s3Bucket, s3Key);
    result.steps.tocExtraction = true;
    logger.info('TOC extraction complete', {
      chapters: tocResult.chapters.length,
      topics: tocResult.topics.length,
      subtopics: tocResult.subtopics.length,
    });

    // Step 3: Create page-aware chunks with 3-priority logic
    logger.info('Step 3: Creating page-aware chunks');
    
    // Build page-indexed text
    const pageTextsIndexed: Record<number, string> = {};
    for (const page of extractedText.pages) {
      pageTextsIndexed[page.pageNumber] = page.text;
    }

    const chunkingResult = await createPageAwareChunks(
      bookId,
      pageTextsIndexed,
      extractedText.totalPages
    );
    result.steps.chunking = chunkingResult.success;

    logger.info('Text chunking complete', {
      totalChunks: chunkingResult.totalChunks,
      byPriority: chunkingResult.chunksByPriority,
    });

    // Step 4: Update book status to processed
    await updateBookStatus(bookId, 'PROCESSED');

    result.success = true;
    result.metrics = {
      totalPages: extractedText.totalPages,
      totalChunks: chunkingResult.totalChunks,
      chaptersCount: tocResult.chapters.length,
      topicsCount: tocResult.topics.length,
      subtopicsCount: tocResult.subtopics.length,
    };

    logger.info('PDF processing complete', result);
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('PDF processing failed', error as Error);

    await updateBookStatus(bookId, 'FAILED', errorMessage);
    result.error = errorMessage;

    return result;
  }
}

/**
 * SQS handler for PDF processing queue
 */
export const handler: SQSHandler = async (event): Promise<SQSBatchResponse | void> => {
  logger.info('PDF processor invoked', { recordCount: event.Records.length });

  const results: ProcessingResult[] = [];
  const batchItemFailures: Array<{ itemId: string }> = [];

  for (const record of event.Records) {
    const requestId = record.messageId;
    logger.info('Processing record', { requestId });

    try {
      // Parse the S3 event from SQS message
      const body = JSON.parse(record.body);
      const s3Event = body as { Records: S3EventRecord[] };

      for (const s3Record of s3Event.Records) {
        const s3Object = s3Record.s3.object;
        const s3Key = s3Object.key;
        const s3Bucket = s3Record.s3.bucket.name;

        // Extract bookId from S3 key
        // Expected format: institutes/{instituteId}/books/{bookId}/{filename}
        const keyParts = s3Key.split('/');
        if (keyParts.length < 5) {
          logger.error('Invalid S3 key format', new Error('Invalid S3 key'), { s3Key });
          continue;
        }

        const bookId = keyParts[3];

        // Process the PDF
        const result = await processPdf(bookId, s3Bucket, s3Key);
        results.push(result);

        // Delete the message from queue
        await sqsClient.send(new DeleteMessageCommand({
          QueueUrl: PDF_PROCESSING_QUEUE,
          ReceiptHandle: record.receiptHandle,
        }));
      }
    } catch (error) {
      logger.error('Error processing record', error as Error, { requestId });
      batchItemFailures.push({ itemId: record.messageId });
    }
  }

  logger.info('PDF processor completed', { processedCount: results.length });

  return {
    batchItemFailures,
  };
};

export default handler;
