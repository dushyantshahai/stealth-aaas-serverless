import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { getLogger } from '../../../../layers/common/nodejs/utils/logger';
import { AuthorizationError, NotFoundError } from '../../../../layers/common/nodejs/utils/errors';
import { createSuccessResponse, createErrorResponse } from '../../../../layers/common/nodejs/utils/response';
import { authenticate } from '../../../../layers/common/nodejs/middleware/auth';
import { validatePath } from '../../../../layers/common/nodejs/utils/validation';

const logger = getLogger('topics-get');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

const TOPICS_TABLE = process.env.TOPICS_TABLE || `stealth-${process.env.STAGE || 'dev'}-topics`;

export const handler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  const requestId = context.awsRequestId;
  logger.info('Get topic request', { requestId });

  try {
    // Authenticate user
    const user = await authenticate(event);
    
    // Get topic ID from path parameters
    const topicId = event.pathParameters?.topicId;
    if (!topicId) {
      return createErrorResponse(
        'MISSING_PARAMETER',
        'Topic ID is required',
        400,
        undefined,
        requestId
      );
    }

    // Get the topic from DynamoDB
    const command = new GetCommand({
      TableName: TOPICS_TABLE,
      Key: { topicId }
    });

    const result = await docClient.send(command);
    
    if (!result.Item) {
      throw new NotFoundError('Topic not found');
    }

    const topic = result.Item;
    
    // Check institute isolation
    if (topic.instituteId !== user.instituteId) {
      throw new AuthorizationError('Access denied');
    }

    // Return the topic (excluding sensitive/internal fields)
    const response = {
      topicId: topic.topicId,
      chapterId: topic.chapterId,
      title: topic.title,
      order: topic.order,
      pageStart: topic.pageStart,
      pageEnd: topic.pageEnd,
      description: topic.description,
      createdAt: topic.createdAt,
      updatedAt: topic.updatedAt,
      createdBy: topic.createdBy
    };

    return createSuccessResponse(response, requestId);
    
  } catch (error) {
    logger.error('Get topic failed', error as Error, { requestId });
    
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
      'GET_TOPIC_FAILED',
      'Failed to get topic',
      500,
      undefined,
      requestId
    );
  }
};
