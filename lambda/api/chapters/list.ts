import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { getLogger } from '../../../../layers/common/nodejs/utils/logger';
import { AuthorizationError, NotFoundError } from '../../../../layers/common/nodejs/utils/errors';
import { createSuccessResponse, createErrorResponse } from '../../../../layers/common/nodejs/utils/response';
import { authenticate } from '../../../../layers/common/nodejs/middleware/auth';
import { validateQueryParams } from '../../../../layers/common/nodejs/utils/validation';

const logger = getLogger('chapters-list');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const CHAPTERS_TABLE = process.env.CHAPTERS_TABLE || `stealth-${process.env.STAGE || 'dev'}-chapters`;
const BOOKS_TABLE = process.env.BOOKS_TABLE || `stealth-${process.env.STAGE || 'dev'}-books`;

export const handler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  const requestId = context.awsRequestId;
  logger.info('List chapters request', { requestId });

  try {
    // Authenticate user
    const user = await authenticate(event);
    
    // Get query parameters
    const queryParams = event.queryStringParameters || {};
    const bookId = queryParams.bookId;
    const limit = parseInt(queryParams.limit || '50');
    const lastEvaluatedKey = queryParams.lastEvaluatedKey;
    
    if (!bookId) {
      return createErrorResponse(
        'MISSING_BOOK_ID',
        'Book ID is required',
        400,
        undefined,
        requestId
      );
    }

    // First, verify the book exists and belongs to user's institute
    const book = await getBook(bookId);
    
    // Check institute isolation
    if (book.instituteId !== user.instituteId) {
      throw new AuthorizationError('Access denied');
    }

    // Build query parameters
    const queryParams: any = {
      TableName: CHAPTERS_TABLE,
      IndexName: 'bookId-order-index', // Assuming GSI on bookId and order
      KeyConditionExpression: 'bookId = :bookId',
      ExpressionAttributeValues: {
        ':bookId': bookId
      },
      Limit: Math.min(limit, 100), // Max 100 items per page
      ScanIndexForward: true, // Sort by order ascending
    };

    // Add pagination if lastEvaluatedKey is provided
    if (lastEvaluatedKey) {
      queryParams.ExclusiveStartKey = JSON.parse(
        Buffer.from(lastEvaluatedKey, 'base64').toString('utf-8')
      );
    }

    // Execute query
    const command = new QueryCommand(queryParams);
    const result = await docClient.send(command);

    // Transform response
    const chapters = result.Items?.map(chapter => ({
      chapterId: chapter.chapterId,
      bookId: chapter.bookId,
      title: chapter.title,
      order: chapter.order,
      pageStart: chapter.pageStart,
      pageEnd: chapter.pageEnd,
      description: chapter.description,
      createdAt: chapter.createdAt,
      updatedAt: chapter.updatedAt
    })) || [];

    const response = {
      chapters,
      lastEvaluatedKey: result.LastEvaluatedKey 
        ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
        : null
    };

    return createSuccessResponse(response, requestId);

  } catch (error) {
    logger.error('List chapters failed', error as Error, { requestId });
    
    if (error instanceof AuthorizationError) {
      return createErrorResponse(
        error.code,
        error.message,
        error.statusCode,
        error.details,
        requestId
      );
    }
    
    return createErrorResponse(
      'LIST_CHAPTERS_FAILED',
      'Failed to list chapters',
      500,
      undefined,
      requestId
    );
  }
};

async function getBook(bookId: string) {
  const command = new GetCommand({
    TableName: BOOKS_TABLE,
    Key: { bookId }
  });
  
  const result = await docClient.send(command);
  
  if (!result.Item) {
    throw new NotFoundError('Book not found');
  }
  
  return result.Item;
}
