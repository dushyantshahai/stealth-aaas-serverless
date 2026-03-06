import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DynamoDBDocumentClient, DeleteCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { getLogger } from '../../../../layers/common/nodejs/utils/logger';
import { AuthorizationError, NotFoundError } from '../../../../layers/common/nodejs/utils/errors';
import { createSuccessResponse, createErrorResponse } from '../../../../layers/common/nodejs/utils/response';
import { authenticate } from '../../../../layers/common/nodejs/middleware/auth';
import { validatePath } from '../../../../layers/common/nodejs/utils/validation';

const logger = getLogger('books-delete');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const BOOKS_TABLE = process.env.BOOKS_TABLE || `stealth-${process.env.STAGE || 'dev'}-books`;

export const handler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  const requestId = context.awsRequestId;
  logger.info('Delete book request', { requestId });

  try {
    // Authenticate user
    const user = await authenticate(event);
    
    // Get book ID from path
    const bookId = validatePath(event, 'id');
    
    // First, get the current book to check ownership and status
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
    
    // Check if user has permission to delete
    if (book.createdBy !== user.userId && user.role !== 'Admin') {
      throw new AuthorizationError('You do not have permission to delete this book');
    }
    
    // Check if book has been uploaded (has S3 key)
    if (book.s3Key) {
      return createErrorResponse(
        'BOOK_HAS_UPLOADED_FILE',
        'Cannot delete book that has an uploaded file. Delete the file first.',
        400,
        undefined,
        requestId
      );
    }
    
    // Check if book is being processed
    if (book.status === 'PROCESSING') {
      return createErrorResponse(
        'BOOK_IS_PROCESSING',
        'Cannot delete book that is currently being processed',
        400,
        undefined,
        requestId
      );
    }
    
    // Delete the book
    const deleteCommand = new DeleteCommand({
      TableName: BOOKS_TABLE,
      Key: { bookId },
      ConditionExpression: 'bookId = :bookId AND instituteId = :instituteId',
      ExpressionAttributeValues: {
        ':bookId': bookId,
        ':instituteId': user.instituteId
      }
    });
    
    await docClient.send(deleteCommand);
    
    logger.info('Book deleted successfully', { bookId, requestId });
    
    return createSuccessResponse({
      message: 'Book deleted successfully',
      bookId
    }, requestId);
    
  } catch (error) {
    logger.error('Delete book failed', error as Error, { requestId });
    
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
      'DELETE_BOOK_FAILED',
      'Failed to delete book',
      500,
      undefined,
      requestId
    );
  }
};
