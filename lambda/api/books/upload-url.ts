import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getLogger } from '@common/utils/logger';
import { ValidationError, AuthorizationError, NotFoundError } from '@common/utils/errors';
import { createSuccessResponse, createErrorResponse } from '@common/utils/response';
import { authenticate } from '@common/middleware/auth';
import { validatePath, validateBody } from '@common/utils/validation';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

const logger = getLogger('books-upload-url');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

const BOOKS_TABLE = process.env.BOOKS_TABLE || `stealth-${process.env.STAGE || 'dev'}-books`;
const PDF_BUCKET = process.env.PDF_BUCKET || `stealth-${process.env.STAGE || 'dev'}-pdfs`;

const uploadUrlSchema = z.object({
  filename: z.string().min(1, 'Filename is required'),
  contentType: z.string().default('application/pdf'),
  fileSize: z.number().positive('File size must be positive').max(100 * 1024 * 1024, 'File size must be less than 100MB'), // 100MB max
});

export const handler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  const requestId = context.awsRequestId;
  logger.info('Generate upload URL request', { requestId });

  try {
    // Authenticate user
    const user = await authenticate(event);
    
    // Get book ID from path
    const bookId = validatePath(event, 'id');
    
    // Parse and validate request body
    const body = JSON.parse(event.body || '{}');
    const validatedData = validateBody(uploadUrlSchema, body);
    
    // First, get the current book to check ownership
    const getCommand = new GetCommand({
      TableName: BOOKS_TABLE,
      Key: { bookId }
    });
    
    const getResult = await docClient.send(getCommand);
    
    if (!getResult.Item) {
      throw new NotFoundError('Book not found');
    }
    
    const book = getResult.Item;
    
    // Check institute isolation
    if (book.instituteId !== user.instituteId) {
      throw new AuthorizationError('Access denied');
    }
    
    // Check if book already has an uploaded file
    if (book.s3Key) {
      return createErrorResponse(
        'BOOK_ALREADY_HAS_FILE',
        'Book already has an uploaded file. Delete the existing file first.',
        400,
        undefined,
        requestId
      );
    }
    
    // Check if book is being processed
    if (book.status === 'PROCESSING') {
      return createErrorResponse(
        'BOOK_IS_PROCESSING',
        'Book is currently being processed',
        400,
        undefined,
        requestId
      );
    }
    
    // Generate S3 key
    const fileExtension = validatedData.filename.split('.').pop() || 'pdf';
    const uniqueFilename = `${uuidv4()}.${fileExtension}`;
    const s3Key = `institutes/${book.instituteId}/books/${bookId}/${uniqueFilename}`;
    
    // Generate presigned URL
    const putCommand = new PutObjectCommand({
      Bucket: PDF_BUCKET,
      Key: s3Key,
      ContentType: validatedData.contentType,
      Metadata: {
        bookId,
        instituteId: book.instituteId,
        subjectId: book.subjectId,
        uploadedBy: user.userId,
        originalFilename: validatedData.filename,
      }
    });
    
    const presignedUrl = await getSignedUrl(s3Client, putCommand, {
      expiresIn: 900, // 15 minutes
    });
    
    // Update book with S3 key and status
    const now = new Date().toISOString();
    const updateCommand = new UpdateCommand({
      TableName: BOOKS_TABLE,
      Key: { bookId },
      UpdateExpression: 'SET s3Key = :s3Key, status = :status, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':s3Key': s3Key,
        ':status': 'UPLOAD_PENDING',
        ':updatedAt': now,
      },
      ConditionExpression: 'bookId = :bookId AND instituteId = :instituteId',
      ReturnValues: 'ALL_NEW'
    });
    
    await docClient.send(updateCommand);
    
    logger.info('Upload URL generated successfully', { bookId, s3Key, requestId });
    
    return createSuccessResponse({
      uploadUrl: presignedUrl,
      s3Key,
      bookId,
      expiresIn: 900, // 15 minutes in seconds
      uploadInstructions: {
        method: 'PUT',
        headers: {
          'Content-Type': validatedData.contentType,
        },
        maxFileSize: validatedData.fileSize,
      }
    }, requestId);
    
  } catch (error) {
    logger.error('Generate upload URL failed', error as Error, { requestId });
    
    if (error instanceof ValidationError || 
        error instanceof AuthorizationError || 
        error instanceof NotFoundError) {
      return createErrorResponse(
        error.code,
        error.message,
        error.statusCode,
        error.details,
        requestId
      );
    }
    
    return createErrorResponse(
      'GENERATE_UPLOAD_URL_FAILED',
      'Failed to generate upload URL',
      500,
      undefined,
      requestId
    );
  }
};
