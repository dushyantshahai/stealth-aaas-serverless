import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DynamoDBDocumentClient, QueryCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { getLogger } from '../../../../layers/common/nodejs/utils/logger';
import { AuthorizationError, NotFoundError } from '../../../../layers/common/nodejs/utils/errors';
import { createSuccessResponse, createErrorResponse } from '../../../../layers/common/nodejs/utils/response';
import { authenticate } from '../../../../layers/common/nodejs/middleware/auth';

const logger = getLogger('topics-list');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const TOPICS_TABLE = process.env.TOPICS_TABLE || `stealth-${process.env.STAGE || 'dev'}-topics`;
const CHAPTERS_TABLE = process.env.CHAPTERS_TABLE || `stealth-${process.env.STAGE || 'dev'}-chapters`;

export const handler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  const requestId = context.awsRequestId;
  logger.info('List topics request', { requestId });

  try {
    // Authenticate user
    const user = await authenticate(event);
    
    // Get query parameters
    const queryParams = event.queryStringParameters || {};
    const chapterId = queryParams.chapterId;
    const limit = parseInt(queryParams.limit || '50');
    const lastEvaluatedKey = queryParams.lastEvaluatedKey;
    
    if (!chapterId) {
      return createErrorResponse(
        'MISSING_CHAPTER_ID',
        'Chapter ID is required',
        400,
        undefined,
        requestId
      );
    }

    // First, verify the chapter exists and belongs to user's institute
    const chapter = await getChapter(chapterId);
    
    // Check institute isolation
    if (chapter.instituteId !== user.instituteId) {
      throw new AuthorizationError('Access denied');
    }

    // Build query parameters
    const queryCommandParams: any = {
      TableName: TOPICS_TABLE,
      IndexName: 'chapterId-order-index', // GSI on chapterId and order
      KeyConditionExpression: 'chapterId = :chapterId',
      ExpressionAttributeValues: {
        ':chapterId': chapterId
      },
      Limit: Math.min(limit, 100), // Max 100 items per page
      ScanIndexForward: true, // Sort by order ascending
    };

    // Add pagination if lastEvaluatedKey is provided
    if (lastEvaluatedKey) {
      queryCommandParams.ExclusiveStartKey = JSON.parse(
        Buffer.from(lastEvaluatedKey, 'base64').toString('utf-8')
      );
    }

    // Execute query
    const command = new QueryCommand(queryCommandParams);
    const result = await docClient.send(command);

    // Transform response
    const topics = result.Items?.map(topic => ({
      topicId: topic.topicId,
      chapterId: topic.chapterId,
      title: topic.title,
      order: topic.order,
      pageStart: topic.pageStart,
      pageEnd: topic.pageEnd,
      description: topic.description,
      createdAt: topic.createdAt,
      updatedAt: topic.updatedAt
    })) || [];

    const response = {
      topics,
      lastEvaluatedKey: result.LastEvaluatedKey 
        ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
        : null
    };

    return createSuccessResponse(response, requestId);

  } catch (error) {
    logger.error('List topics failed', error as Error, { requestId });
    
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
      'LIST_TOPICS_FAILED',
      'Failed to list topics',
      500,
      undefined,
      requestId
    );
  }
};

async function getChapter(chapterId: string) {
  const command = new GetCommand({
    TableName: CHAPTERS_TABLE,
    Key: { chapterId }
  });
  
  const result = await docClient.send(command);
  
  if (!result.Item) {
    throw new NotFoundError('Chapter not found');
  }
  
  return result.Item;
}
