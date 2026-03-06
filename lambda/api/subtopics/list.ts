import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { getLogger } from '/opt/nodejs/utils/logger';
import { AuthorizationError, NotFoundError } from '/opt/nodejs/utils/errors';
import { createSuccessResponse, createErrorResponse } from '/opt/nodejs/utils/response';
import { authenticate } from '/opt/nodejs/middleware/auth';

const logger = getLogger('subtopics-list');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

const SUBTOPICS_TABLE = process.env.SUBTOPICS_TABLE || `stealth-${process.env.STAGE || 'dev'}-subtopics`;
const TOPICS_TABLE = process.env.TOPICS_TABLE || `stealth-${process.env.STAGE || 'dev'}-topics`;

export const handler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  const requestId = context.awsRequestId;
  logger.info('List subtopics request', { requestId });

  try {
    // Authenticate user
    const user = await authenticate(event);
    
    // Get topicId from query parameters
    const topicId = event.queryStringParameters?.topicId;
    if (!topicId) {
      return createErrorResponse(
        'MISSING_PARAMETER',
        'Topic ID is required',
        400,
        undefined,
        requestId
      );
    }

    // First, verify the topic exists and belongs to user's institute
    const topic = await getTopic(topicId);
    
    // Check institute isolation
    if (topic.instituteId !== user.instituteId) {
      throw new AuthorizationError('Access denied');
    }

    // Get pagination parameters
    const limit = parseInt(event.queryStringParameters?.limit || '50');
    const lastEvaluatedKey = event.queryStringParameters?.lastEvaluatedKey 
      ? JSON.parse(event.queryStringParameters.lastEvaluatedKey)
      : undefined;

    // Query subtopics by topicId, sorted by order
    const command = new QueryCommand({
      TableName: SUBTOPICS_TABLE,
      IndexName: 'topicId-index',
      KeyConditionExpression: 'topicId = :topicId',
      ExpressionAttributeValues: {
        ':topicId': topicId
      },
      Limit: limit,
      ExclusiveStartKey: lastEvaluatedKey,
      ScanIndexForward: true // Sort ascending by order
    });

    const result = await docClient.send(command);
    
    // Format response items (excluding internal fields)
    const subtopics = result.Items?.map(item => ({
      subtopicId: item.subtopicId,
      topicId: item.topicId,
      title: item.title,
      order: item.order,
      pageStart: item.pageStart,
      pageEnd: item.pageEnd,
      description: item.description,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      createdBy: item.createdBy
    })) || [];

    const response = {
      subtopics,
      count: subtopics.length,
      lastEvaluatedKey: result.LastEvaluatedKey 
        ? JSON.stringify(result.LastEvaluatedKey)
        : undefined
    };

    return createSuccessResponse(response, requestId);
    
  } catch (error) {
    logger.error('List subtopics failed', error as Error, { requestId });
    
    if (error instanceof AuthorizationError || error instanceof NotFoundError) {
      return createErrorResponse(
        error.code,
        error.message,
        error.statusCode,
        error.details,
        requestId
      );
    }
    
    return createErrorResponse(
      'LIST_SUBTOPICS_FAILED',
      'Failed to list subtopics',
      500,
      undefined,
      requestId
    );
  }
};

async function getTopic(topicId: string) {
  const result = await docClient.send(new QueryCommand({
    TableName: TOPICS_TABLE,
    KeyConditionExpression: 'topicId = :topicId',
    ExpressionAttributeValues: {
      ':topicId': topicId
    },
    Limit: 1
  }));
  
  if (!result.Items || result.Items.length === 0) {
    throw new NotFoundError('Topic not found');
  }
  
  return result.Items[0];
}