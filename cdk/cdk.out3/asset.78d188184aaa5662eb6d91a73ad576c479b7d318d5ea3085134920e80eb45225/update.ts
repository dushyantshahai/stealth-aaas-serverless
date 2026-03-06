import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { getLogger } from '/opt/nodejs/utils/logger';
import { ValidationError, AuthorizationError, NotFoundError } from '/opt/nodejs/utils/errors';
import { createSuccessResponse, createErrorResponse } from '/opt/nodejs/utils/response';
import { authenticate } from '/opt/nodejs/middleware/auth';
import { validateBody, validatePath } from '/opt/nodejs/utils/validation';
import { z } from 'zod';

const logger = getLogger('chapters-update');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const CHAPTERS_TABLE = process.env.CHAPTERS_TABLE || `stealth-${process.env.STAGE || 'dev'}-chapters`;
const BOOKS_TABLE = process.env.BOOKS_TABLE || `stealth-${process.env.STAGE || 'dev'}-books`;

const updateChapterSchema = z.object({
  title: z.string().min(1, 'Title is required').optional(),
  order: z.number().int().positive('Order must be a positive number').optional(),
  pageStart: z.number().int().nonnegative('Page start must be non-negative').optional(),
  pageEnd: z.number().int().nonnegative('Page end must be non-negative').optional(),
  description: z.string().optional()
});

export const handler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  const requestId = context.awsRequestId;
  logger.info('Update chapter request', { requestId });

  try {
    // Authenticate user
    const user = await authenticate(event);
    
    // Get chapter ID from path
    const chapterId = validatePath(event, 'id');
    
    // Parse and validate request body
    const body = JSON.parse(event.body || '{}');
    const validatedData = validateBody(updateChapterSchema, body);
    
    // First, get the current chapter to check ownership
    const getChapterCommand = new GetCommand({
      TableName: CHAPTERS_TABLE,
      Key: { chapterId }
    });
    
    const getChapterResult = await docClient.send(getChapterCommand);
    
    if (!getChapterResult.Item) {
      throw new NotFoundError('Chapter not found');
    }
    
    const chapter = getChapterResult.Item;
    
    // Verify the book exists and belongs to user's institute
    const book = await getBook(chapter.bookId);
    
    // Check institute isolation
    if (book.instituteId !== user.instituteId) {
      throw new AuthorizationError('Access denied');
    }
    
    // Check if user has permission to update
    if (chapter.createdBy !== user.userId && user.role !== 'Admin') {
      throw new AuthorizationError('You do not have permission to update this chapter');
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
        chapterId 
      }, requestId);
    }
    
    // Add updated timestamp
    updateExpressions.push('updatedAt = :updatedAt');
    expressionAttributeValues[':updatedAt'] = new Date().toISOString();
    
    const updateCommand = new UpdateCommand({
      TableName: CHAPTERS_TABLE,
      Key: { chapterId },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ConditionExpression: 'chapterId = :chapterId AND bookId = :bookId',
      ReturnValues: 'ALL_NEW'
    });
    
    const result = await docClient.send(updateCommand);
    
    logger.info('Chapter updated successfully', { chapterId, requestId });
    
    return createSuccessResponse({
      message: 'Chapter updated successfully',
      chapterId,
      updatedAttributes: Object.keys(validatedData)
    }, requestId);
    
  } catch (error) {
    logger.error('Update chapter failed', error as Error, { requestId });
    
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
      'UPDATE_CHAPTER_FAILED',
      'Failed to update chapter',
      500,
      undefined,
      requestId
    );
  }
};

async function getBook(bookId: string) {
  const result = await docClient.send(new GetCommand({
    TableName: BOOKS_TABLE,
    Key: { bookId }
  }));
  
  if (!result.Item) {
    throw new NotFoundError('Book not found');
  }
  
  return result.Item;
}