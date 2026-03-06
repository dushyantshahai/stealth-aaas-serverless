import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { getLogger } from '@common/utils/logger';
import { NotFoundError, AuthorizationError } from '@common/utils/errors';
import { createSuccessResponse, createErrorResponse } from '@common/utils/response';
import { authenticate } from '@common/middleware/auth';
import { validatePath } from '@common/utils/validation';

const logger = getLogger('books-get');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const BOOKS_TABLE = process.env.BOOKS_TABLE || `stealth-${process.env.STAGE || 'dev'}-books`;

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const requestId = context.awsRequestId;
  logger.info('Get book request', { requestId });

  try {
    // Authenticate user
    const user = await authenticate(event);
    
    // Get book ID from path
    const bookId = validatePath(event, 'id');

    // Get book from DynamoDB
    const result = await docClient.send(new GetCommand({
      TableName: BOOKS_TABLE,
      Key: { bookId }
    }));

    if (!result.Item) {
      throw new NotFoundError('Book not found');
    }

    const book = result.Item;

    // Check institute isolation
    if (book.instituteId !== user.instituteId) {
      throw new AuthorizationError('Access denied');
    }

    logger.info('Book retrieved successfully', { requestId, bookId });

    return createSuccessResponse({
      book: {
        bookId: book.bookId,
        title: book.title,
        subjectId: book.subjectId,
        instituteId: book.instituteId,
        description: book.description,
        metadata: book.metadata,
        status: book.status,
        s3Key: book.s3Key,
        uploadedAt: book.uploadedAt,
        processedAt: book.processedAt,
        createdBy: book.createdBy,
        createdAt: book.createdAt,
        updatedAt: book.updatedAt,
        version: book.version
      }
    }, requestId);

  } catch (error) {
    logger.error('Get book failed', error as Error, { requestId });
    
    if (error instanceof NotFoundError || error instanceof AuthorizationError) {
      return createErrorResponse(
        error.code,
        error.message,
        error.statusCode,
        error.details,
        requestId
      );
    }
    
    return createErrorResponse(
      'GET_BOOK_FAILED',
      'Failed to get book',
      500,
      undefined,
      requestId
    );
  }
};

export default handler;
