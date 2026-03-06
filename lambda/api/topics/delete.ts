import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DynamoDBDocumentClient, DeleteCommand, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { getLogger } from '/opt/nodejs/utils/logger';
import { AuthorizationError, NotFoundError, ValidationError } from '/opt/nodejs/utils/errors';
import { createSuccessResponse, createErrorResponse } from '/opt/nodejs/utils/response';
import { authenticate } from '/opt/nodejs/middleware/auth';

const logger = getLogger('topics-delete');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const TOPICS_TABLE = process.env.TOPICS_TABLE || `stealth-${process.env.STAGE || 'dev'}-topics`;
const SUBTOPICS_TABLE = process.env.SUBTOPICS_TABLE || `stealth-${process.env.STAGE || 'dev'}-subtopics`;

export const handler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  const requestId = context.awsRequestId;
  logger.info('Delete topic request', { requestId });

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

    // First, get the topic to check ownership and existence
    const getCommand = new GetCommand({
      TableName: TOPICS_TABLE,
      Key: { topicId }
    });

    const getResult = await docClient.send(getCommand);
    
    if (!getResult.Item) {
      throw new NotFoundError('Topic not found');
    }

    const topic = getResult.Item;
    
    // Check institute isolation
    if (topic.instituteId !== user.instituteId) {
      throw new AuthorizationError('Access denied');
    }
    
    // Check if user has permission to delete
    if (topic.createdBy !== user.userId && user.role !== 'Admin') {
      throw new AuthorizationError('You do not have permission to delete this topic');
    }

    // Check if topic has subtopics before deleting
    const queryCommand = new QueryCommand({
      TableName: SUBTOPICS_TABLE,
      IndexName: 'topicId-order-index', // GSI on topicId and order
      KeyConditionExpression: 'topicId = :topicId',
      ExpressionAttributeValues: {
        ':topicId': topicId
      },
      Limit: 1 // We only need to know if there are any subtopics
    });

    const queryResult = await docClient.send(queryCommand);
    
    if (queryResult.Items && queryResult.Items.length > 0) {
      throw new ValidationError(
        'TOPIC_HAS_SUBTOPICS',
        'Cannot delete topic that has subtopics. Delete subtopics first.',
        400
      );
    }

    // Delete the topic
    const deleteCommand = new DeleteCommand({
      TableName: TOPICS_TABLE,
      Key: { topicId },
      ConditionExpression: 'topicId = :topicId AND instituteId = :instituteId',
      ExpressionAttributeValues: {
        ':topicId': topicId,
        ':instituteId': user.instituteId
      }
    });

    await docClient.send(deleteCommand);
    
    logger.info('Topic deleted successfully', { topicId, requestId });
    
    return createSuccessResponse({
      message: 'Topic deleted successfully',
      topicId
    }, requestId);
    
  } catch (error) {
    logger.error('Delete topic failed', error as Error, { requestId });
    
    if (error instanceof AuthorizationError || 
        error instanceof NotFoundError || 
        error instanceof ValidationError) {
      return createErrorResponse(
        error.code,
        error.message,
        error.statusCode,
        error.details,
        requestId
      );
    }
    
    return createErrorResponse(
      'DELETE_TOPIC_FAILED',
      'Failed to delete topic',
      500,
      undefined,
      requestId
    );
  }
};