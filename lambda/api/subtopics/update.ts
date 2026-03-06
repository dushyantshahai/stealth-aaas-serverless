import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { getLogger } from '/opt/nodejs/utils/logger';
import { ValidationError, AuthorizationError, NotFoundError } from '/opt/nodejs/utils/errors';
import { createSuccessResponse, createErrorResponse } from '/opt/nodejs/utils/response';
import { authenticate } from '/opt/nodejs/middleware/auth';
import { validateBody } from '/opt/nodejs/utils/validation';
import { z } from 'zod';

const logger = getLogger('subtopics-update');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const SUBTOPICS_TABLE = process.env.SUBTOPICS_TABLE || `stealth-${process.env.STAGE || 'dev'}-subtopics`;

const updateSubtopicSchema = z.object({
  title: z.string().min(1, 'Title is required').optional(),
  order: z.number().int().positive('Order must be a positive number').optional(),
  pageStart: z.number().int().nonnegative('Page start must be non-negative').optional(),
  pageEnd: z.number().int().nonnegative('Page end must be non-negative').optional(),
  description: z.string().optional()
});

export const handler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  const requestId = context.awsRequestId;
  logger.info('Update subtopic request', { requestId });

  try {
    // Authenticate user
    const user = await authenticate(event);
    
    // Get subtopic ID from path
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
    
    // Parse and validate request body
    const body = JSON.parse(event.body || '{}');
    const validatedData = validateBody(updateSubtopicSchema, body);
    
    // First, get the current subtopic to check ownership
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
    
    // Check if user has permission to update
    if (subtopic.createdBy !== user.userId && user.role !== 'Admin') {
      throw new AuthorizationError('You do not have permission to update this subtopic');
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
        subtopicId 
      }, requestId);
    }
    
    // Add updated timestamp
    updateExpressions.push('updatedAt = :updatedAt');
    expressionAttributeValues[':updatedAt'] = new Date().toISOString();
    
    const updateCommand = new UpdateCommand({
      TableName: SUBTOPICS_TABLE,
      Key: { subtopicId },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ConditionExpression: 'subtopicId = :subtopicId AND instituteId = :instituteId',
      ReturnValues: 'ALL_NEW'
    });
    
    const result = await docClient.send(updateCommand);
    
    logger.info('Subtopic updated successfully', { subtopicId, requestId });
    
    return createSuccessResponse({
      message: 'Subtopic updated successfully',
      subtopicId,
      updatedAttributes: Object.keys(validatedData)
    }, requestId);
    
  } catch (error) {
    logger.error('Update subtopic failed', error as Error, { requestId });
    
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
      'UPDATE_SUBTOPIC_FAILED',
      'Failed to update subtopic',
      500,
      undefined,
      requestId
    );
  }
};