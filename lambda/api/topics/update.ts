import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { getLogger } from '../../../../layers/common/nodejs/utils/logger';
import { ValidationError, AuthorizationError, NotFoundError } from '../../../../layers/common/nodejs/utils/errors';
import { createSuccessResponse, createErrorResponse } from '../../../../layers/common/nodejs/utils/response';
import { authenticate } from '../../../../layers/common/nodejs/middleware/auth';
import { validateBody, validatePath } from '../../../../layers/common/nodejs/utils/validation';
import { z } from 'zod';

const logger = getLogger('topics-update');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const TOPICS_TABLE = process.env.TOPICS_TABLE || `stealth-${process.env.STAGE || 'dev'}-topics`;

const updateTopicSchema = z.object({
  title: z.string().min(1, 'Title is required').optional(),
  order: z.number().int().positive('Order must be a positive number').optional(),
  pageStart: z.number().int().nonnegative('Page start must be non-negative').optional(),
  pageEnd: z.number().int().nonnegative('Page end must be non-negative').optional(),
  description: z.string().optional()
});

export const handler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  const requestId = context.awsRequestId;
  logger.info('Update topic request', { requestId });

  try {
    // Authenticate user
    const user = await authenticate(event);
    
    // Get topic ID from path
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
    
    // Parse and validate request body
    const body = JSON.parse(event.body || '{}');
    const validatedData = validateBody(updateTopicSchema, body);
    
    // First, get the current topic to check ownership
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
    
    // Check if user has permission to update
    if (topic.createdBy !== user.userId && user.role !== 'Admin') {
      throw new AuthorizationError('You do not have permission to update this topic');
    }
    
    // Build update expression
    const updateExpressions = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};
    
    if (validatedData.title !== undefined) {
      updateExpressions.push('#title = :title');
      expressionAttributeNames['#title'] = 'title';
      expressionAttributeValues[':title'] = validatedData.title;
    }
    
    if (validatedData.order !== undefined) {
      updateExpressions.push('#order = :order');
      expressionAttributeNames['#order'] = 'order';
      expressionAttributeValues[':order'] = validatedData.order;
    }
    
    if (validatedData.pageStart !== undefined) {
      updateExpressions.push('pageStart = :pageStart');
      expressionAttributeValues[':pageStart'] = validatedData.pageStart;
    }
    
    if (validatedData.pageEnd !== undefined) {
      updateExpressions.push('pageEnd = :pageEnd');
      expressionAttributeValues[':pageEnd'] = validatedData.pageEnd;
    }
    
    if (validatedData.description !== undefined) {
      updateExpressions.push('description = :description');
      expressionAttributeValues[':description'] = validatedData.description;
    }
    
    if (updateExpressions.length === 0) {
      return createSuccessResponse({ 
        message: 'No changes provided for update',
        topicId 
      }, requestId);
    }
    
    // Add updated timestamp
    updateExpressions.push('updatedAt = :updatedAt');
    expressionAttributeValues[':updatedAt'] = new Date().toISOString();
    
    const updateCommand = new UpdateCommand({
      TableName: TOPICS_TABLE,
      Key: { topicId },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ConditionExpression: 'topicId = :topicId AND instituteId = :instituteId',
      ReturnValues: 'ALL_NEW'
    });
    
    const result = await docClient.send(updateCommand);
    
    logger.info('Topic updated successfully', { topicId, requestId });
    
    return createSuccessResponse({
      message: 'Topic updated successfully',
      topicId,
      updatedAttributes: Object.keys(validatedData)
    }, requestId);
    
  } catch (error) {
    logger.error('Update topic failed', error as Error, { requestId });
    
    if (error instanceof ValidationError || 
        error instanceof AuthorizationError || 
        error instanceof NotFoundError) {
      return createErrorResponse(
        error.code,
        error.message,
        error.statusCode,
        error.details,
        requestId
      );
    }
    
    return createErrorResponse(
      'UPDATE_TOPIC_FAILED',
      'Failed to update topic',
      500,
      undefined,
      requestId
    );
  }
};
