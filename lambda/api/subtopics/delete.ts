import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DynamoDBDocumentClient, DeleteCommand, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { getLogger } from '/opt/nodejs/utils/logger';
import { AuthorizationError, NotFoundError, ValidationError } from '/opt/nodejs/utils/errors';
import { createSuccessResponse, createErrorResponse } from '/opt/nodejs/utils/response';
import { authenticate } from '/opt/nodejs/middleware/auth';

const logger = getLogger('subtopics-delete');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

const SUBTOPICS_TABLE = process.env.SUBTOPICS_TABLE || `stealth-${process.env.STAGE || 'dev'}-subtopics`;
const CHUNKS_TABLE = process.env.CHUNKS_TABLE || `stealth-${process.env.STAGE || 'dev'}-chunks`;

export const handler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  const requestId = context.awsRequestId;
  logger.info('Delete subtopic request', { requestId });

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
    const getCommand = new GetCommand({
      TableName: SUBTOPICS_TABLE,
      Key: { subtopicId }
    });

    const getResult = await docClient.send(getCommand);
    
    if (!getResult.Item) {
      throw new NotFoundError('Subtopic not found');
    }

    const subtopic = getResult.Item;
    
    // Check institute isolation
    if (subtopic.instituteId !== user.instituteId) {
      throw new AuthorizationError('Access denied');
    }

    // Check if user has permission to delete
    if (subtopic.createdBy !== user.userId && user.role !== 'Admin') {
      throw new AuthorizationError('You do not have permission to delete this subtopic');
    }

    // Check if subtopic has associated chunks
    const chunksQuery = new QueryCommand({
      TableName: CHUNKS_TABLE,
      IndexName: 'subtopicId-index',
      KeyConditionExpression: 'subtopicId = :subtopicId',
      ExpressionAttributeValues: {
        ':subtopicId': subtopicId
      },
      Limit: 1
    });

    const chunksResult = await docClient.send(chunksQuery);
    
    if (chunksResult.Items && chunksResult.Items.length > 0) {
      throw new ValidationError(
        'Cannot delete subtopic with associated chunks',
        'SUBTOPIC_HAS_CHUNKS',
        400,
        { chunkCount: chunksResult.Items.length }
      );
    }

    // Delete the subtopic
    const deleteCommand = new DeleteCommand({
      TableName: SUBTOPICS_TABLE,
      Key: { subtopicId },
      ConditionExpression: 'subtopicId = :subtopicId AND instituteId = :instituteId',
      ExpressionAttributeValues: {
        ':subtopicId': subtopicId,
        ':instituteId': subtopic.instituteId
      }
    });

    await docClient.send(deleteCommand);
    
    logger.info('Subtopic deleted successfully', { subtopicId, requestId });

    return createSuccessResponse({
      message: 'Subtopic deleted successfully',
      subtopicId
    }, requestId);
    
  } catch (error) {
    logger.error('Delete subtopic failed', error as Error, { requestId });
    
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
      'DELETE_SUBTOPIC_FAILED',
      'Failed to delete subtopic',
      500,
      undefined,
      requestId
    );
  }
};