import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { getLogger } from '@common/utils/logger';
import { NotFoundError, AuthorizationError } from '@common/utils/errors';
import { createSuccessResponse, createErrorResponse } from '@common/utils/response';
import { authenticate } from '@common/middleware/auth';
import { validatePath } from '@common/utils/validation';

const logger = getLogger('chapters-get');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const CHAPTERS_TABLE = process.env.CHAPTERS_TABLE || `stealth-${process.env.STAGE || 'dev'}-chapters`;
const BOOKS_TABLE = process.env.BOOKS_TABLE || `stealth-${process.env.STAGE || 'dev'}-books`;

export const handler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  const requestId = context.awsRequestId;
  logger.info('Get chapter request', { requestId });

  try {
    // Authenticate user
    const user = await authenticate(event);
    
    // Get chapter ID from path
    const chapterId = validatePath(event, 'id');
    
    // Get chapter from DynamoDB
    const result = await docClient.send(new GetCommand({
      TableName: CHAPTERS_TABLE,
      Key: { chapterId }
    }));
    
    if (!result.Item) {
      throw new NotFoundError('Chapter not found');
    }
    
    const chapter = result.Item;
    
    // Verify the book exists and belongs to user's institute
    const book = await getBook(chapter.bookId);
    
    // Check institute isolation
    if (book.instituteId !== user.instituteId) {
      throw new AuthorizationError('Access denied');
    }
    
    logger.info('Chapter retrieved successfully', { chapterId, requestId });
    
    return createSuccessResponse({
      chapter: {
        chapterId: chapter.chapterId,
        bookId: chapter.bookId,
        title: chapter.title,
        order: chapter.order,
        pageStart: chapter.pageStart,
        pageEnd: chapter.pageEnd,
        description: chapter.description,
        createdBy: chapter.createdBy,
        createdAt: chapter.createdAt,
        updatedAt: chapter.updatedAt,
        version: chapter.version
      }
    }, requestId);
    
  } catch (error) {
    logger.error('Get chapter failed', error as Error, { requestId });
    
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
      'GET_CHAPTER_FAILED',
      'Failed to get chapter',
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
