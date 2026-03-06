import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { getLogger } from '@common/utils/logger';
import { AuthorizationError } from '@common/utils/errors';
import { createSuccessResponse, createErrorResponse } from '@common/utils/response';
import { authenticate } from '@common/middleware/auth';
import { validateQueryParams } from '@common/utils/validation';

const logger = getLogger('books-list');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const BOOKS_TABLE = process.env.BOOKS_TABLE || `stealth-${process.env.STAGE || 'dev'}-books`;

export const handler = async (event: APIGatewayProxyEvent, context: any) => {
  const requestId = context.awsRequestId;
  logger.info('List books request', { requestId });

  try {
    // Authenticate user
    const user = await authenticate(event);
    
    // Get query parameters
    const queryParams = event.queryStringParameters || {};
    const subjectId = queryParams.subjectId;
    const limit = parseInt(queryParams.limit || '50');
    const lastEvaluatedKey = queryParams.lastEvaluatedKey;
    
    // Build query parameters
    let queryParams: any = {
      TableName: BOOKS_TABLE,
      IndexName: 'instituteId-index', // We'll need to create this GSI
      KeyConditionExpression: 'instituteId = :instituteId',
      ExpressionAttributeValues: {
        ':instituteId': user.instituteId
      },
      Limit: Math.min(limit, 100), // Max 100 items per page
      ScanIndexForward: true,
      ConsistentRead: false
    };

    // Add subject filter if provided
    if (subjectId) {
      queryParams.FilterExpression = 'subjectId = :subjectId';
      queryParams.ExpressionAttributeValues[':subjectId'] = subjectId;
    }

    // Add pagination
    if (lastEvaluatedKey) {
      queryParams.ExclusiveStartKey = JSON.parse(
        Buffer.from(lastEvaluatedKey, 'base64').toString('utf-8')
      );
    }

    // Execute query
    const command = new QueryCommand(queryParams);
    const result = await docClient.send(command);

    // Transform response
    const books = result.Items?.map(book => ({
      bookId: book.bookId,
      title: book.title,
      subjectId: book.subjectId,
      status: book.status,
      description: book.description,
      createdAt: book.createdAt,
      updatedAt: book.updatedAt,
      createdBy: book.createdBy
    })) || [];

    const response = {
      books,
      lastEvaluatedKey: result.LastEvaluatedKey 
        ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
        : null
    };

    return createSuccessResponse(response, requestId);

  } catch (error) {
    logger.error('Error listing books', error as Error, { requestId });
    return createErrorResponse(
      'LIST_BOOKS_FAILED',
      'Failed to list books',
      500,
      undefined,
      requestId
    );
  }
};
