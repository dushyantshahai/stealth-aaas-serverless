import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DynamoDBDocumentClient, DeleteCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { getLogger } from '@common/utils/logger';
import { AuthorizationError, NotFoundError } from '@common/utils/errors';
import { createSuccessResponse, createErrorResponse } from '@common/utils/response';
import { authenticate } from '@common/middleware/auth';
import { validatePath } from '@common/utils/validation';

const logger = getLogger('chapters-delete');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const CHAPTERS_TABLE = process.env.CHAPTERS_TABLE || `stealth-${process.env.STAGE || 'dev'}-chapters`;
const BOOKS_TABLE = process.env.BOOKS_TABLE || `stealth-${process.env.STAGE || 'dev'}-books`;

export const handler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  const requestId = context.awsRequestId;
  logger.info('Delete chapter request', { requestId });

  try {
    // Authenticate user
    const user = await authenticate(event);
    
    // Get chapter ID from path
    const chapterId = validatePath(event, 'id');
    
    // First, get the current chapter to check ownership
    const getChapterCommand = new GetCommand({
      TableName: CHAPTERS_TABLE,
      Key: { chapterId }
    });
    
    const getChapterResult = await docClient.send(getChapterCommand);
    
    if (!getChapterResult.Item) {
      throw new NotFoundError('Chapter not found');
    }
    
    const chapter = getChapterResult.Item;
    
    // Verify the book exists and belongs to user's institute
    const book = await getBook(chapter.bookId);
    
    // Check institute isolation
    if (book.instituteId !== user.instituteId) {
      throw new AuthorizationError('Access denied');
    }
    
    // Check if user has permission to delete
    if (chapter.createdBy !== user.userId && user.role !== 'Admin') {
      throw new AuthorizationError('You do not have permission to delete this chapter');
    }
    
    // Check if chapter has associated topics (we'll need to check this in a real implementation)
    // For now, we'll just delete the chapter
    
    // Delete the chapter
    const deleteCommand = new DeleteCommand({
      TableName: CHAPTERS_TABLE,
      Key: { chapterId },
      ConditionExpression: 'chapterId = :chapterId AND bookId = :bookId',
      ExpressionAttributeValues: {
        ':chapterId': chapterId,
        ':bookId': chapter.bookId
      }
    });
    
    await docClient.send(deleteCommand);
    
    logger.info('Chapter deleted successfully', { chapterId, requestId });
    
    return createSuccessResponse({
      message: 'Chapter deleted successfully',
      chapterId
    }, requestId);
    
  } catch (error) {
    logger.error('Delete chapter failed', error as Error, { requestId });
    
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
      'DELETE_CHAPTER_FAILED',
      'Failed to delete chapter',
      500,
      undefined,
      requestId
    );
  }
};

async function getBook(bookId: string) {
  const result = await docClient.send(new GetCommand({
    TableName: BOOKS_TABLE,
    Key: { bookId }
  }));
  
  if (!result.Item) {
    throw new NotFoundError('Book not found');
  }
  
  return result.Item;
}
