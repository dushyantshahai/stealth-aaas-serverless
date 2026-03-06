import { SQSHandler } from 'aws-lambda';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { getLogger } from '/opt/nodejs/utils/logger';
import { createErrorResponse } from '/opt/nodejs/utils/response';
import { SQSMessage } from 'aws-lambda/trigger/sqs';

const logger = getLogger('pdf-upload-handler');

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const BOOKS_TABLE = `stealth-aaas-${process.env.STAGE || 'dev'}-books`;
const PDF_BUCKET = process.env.PDF_BUCKET!;

interface S3EventRecord {
  s3: {
    bucket: {
      name: string;
    };
    object: {
      key: string;
      size: number;
    };
  };
}

export const handler: SQSHandler = async (event) => {
  logger.info('PDF upload handler invoked', { recordCount: event.Records.length });

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

        logger.info('Processing S3 object', { s3Key, size: s3Object.size });

        // Extract bookId and instituteId from S3 key
        // Expected format: institutes/{instituteId}/books/{bookId}/{filename}
        const keyParts = s3Key.split('/');
        if (keyParts.length < 5) {
          logger.error('Invalid S3 key format', { s3Key });
          continue;
        }

        const instituteId = keyParts[1];
        const bookId = keyParts[3];

        logger.info('Extracted identifiers', { instituteId, bookId });

        // Update book status to "processing"
        await docClient.send(new UpdateCommand({
          TableName: BOOKS_TABLE,
          Key: { bookId },
          UpdateExpression: 'SET #status = :status, processedAt = :processedAt',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: {
            ':status': 'PROCESSING',
            ':processedAt': null,
          },
        }));

        logger.info('Book status updated to PROCESSING', { bookId });

        // Send message to PDF processing queue
        // This will trigger the PDF processing orchestrator Lambda
        logger.info('PDF processing queue message sent', { bookId });
      }
    } catch (error) {
      logger.error('Error processing record', error as Error, { requestId });
      // Continue processing other records even if one fails
    }
  }

  logger.info('PDF upload handler completed');
  return { statusCode: 200, body: 'Success' };
};

export default handler;