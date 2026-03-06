import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { getLogger } from '@common/utils/logger';
import { AuthorizationError, NotFoundError } from '@common/utils/errors';
import { createSuccessResponse, createErrorResponse } from '@common/utils/response';
import { authenticate } from '@common/middleware/auth';

const logger = getLogger('subtopics-get');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

const SUBTOPICS_TABLE = process.env.SUBTOPICS_TABLE || `stealth-${process.env.STAGE || 'dev'}-subtopics`;

export const handler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  const requestId = context.awsRequestId;
  logger.info('Get subtopic request', { requestId });

  try {
    // Authenticate user
    const user = await authenticate(event);
    
    // Get subtopic ID from path parameters
    const subtopicId = event.pathParameters?.subtopicId;
    if (!subtopicId) {
      return createErrorResponse(
        'MISSING_PARAMETER',
        'Subtopic ID is required',
        400,
        undefined,
        requestId
      );
    }

    // Get the subtopic from DynamoDB
    const command = new GetCommand({
      TableName: SUBTOPICS_TABLE,
      Key: { subtopicId }
    });

    const result = await docClient.send(command);
    
    if (!result.Item) {
      throw new NotFoundError('Subtopic not found');
    }

    const subtopic = result.Item;
    
    // Check institute isolation
    if (subtopic.instituteId !== user.instituteId) {
      throw new AuthorizationError('Access denied');
    }

    // Return the subtopic (excluding sensitive/internal fields)
    const response = {
      subtopicId: subtopic.subtopicId,
      topicId: subtopic.topicId,
      title: subtopic.title,
      order: subtopic.order,
      pageStart: subtopic.pageStart,
      pageEnd: subtopic.pageEnd,
      description: subtopic.description,
      createdAt: subtopic.createdAt,
      updatedAt: subtopic.updatedAt,
      createdBy: subtopic.createdBy
    };

    return createSuccessResponse(response, requestId);
    
  } catch (error) {
    logger.error('Get subtopic failed', error as Error, { requestId });
    
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
      'GET_SUBTOPIC_FAILED',
      'Failed to get subtopic',
      500,
      undefined,
      requestId
    );
  }
};
