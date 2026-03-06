import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { getLogger } from '/opt/nodejs/utils/logger';
import { ValidationError, AuthorizationError, NotFoundError } from '/opt/nodejs/utils/errors';
import { createSuccessResponse, createErrorResponse } from '/opt/nodejs/utils/response';
import { authenticate } from '/opt/nodejs/middleware/auth';
import { validateBody, validatePath } from '/opt/nodejs/utils/validation';
import { z } from 'zod';

const logger = getLogger('books-update');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const BOOKS_TABLE = process.env.BOOKS_TABLE || `stealth-${process.env.STAGE || 'dev'}-books`;

const updateBookSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export const handler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  const requestId = context.awsRequestId;
  logger.info('Update book request', { requestId });

  try {
    // Authenticate user
    const user = await authenticate(event);
    
    // Get book ID from path
    const bookId = validatePath(event, 'id');
    
    // Parse and validate request body
    const body = JSON.parse(event.body || '{}');
    const validatedData = validateBody(updateBookSchema, body);
    
    // First, get the current book to check ownership
    const getCommand = new GetCommand({
      TableName: BOOKS_TABLE,
      Key: { bookId }
    });
    
    const getResult = await docClient.send(getCommand);
    
    if (!getResult.Item) {
      throw new NotFoundError('Book not found');
    }
    
    const book = getResult.Item;
    
    // Check institute isolation
    if (book.instituteId !== user.instituteId) {
      throw new AuthorizationError('Access denied');
    }
    
    // Check if user has permission to update
    if (book.createdBy !== user.userId && user.role !== 'Admin') {
      throw new AuthorizationError('You do not have permission to update this book');
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
    
    if (validatedData.description !== undefined) {
      updateExpressions.push('description = :description');
      expressionAttributeValues[':description'] = validatedData.description;
    }
    
    if (validatedData.metadata !== undefined) {
      updateExpressions.push('metadata = :metadata');
      expressionAttributeValues[':metadata'] = validatedData.metadata;
    }
    
    if (updateExpressions.length === 0) {
      return createSuccessResponse({ 
        message: 'No changes provided for update',
        bookId 
      }, requestId);
    }
    
    // Add updated timestamp
    updateExpressions.push('updatedAt = :updatedAt');
    expressionAttributeValues[':updatedAt'] = new Date().toISOString();
    
    const updateCommand = new UpdateCommand({
      TableName: BOOKS_TABLE,
      Key: { bookId },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ConditionExpression: 'bookId = :bookId AND instituteId = :instituteId',
      ReturnValues: 'ALL_NEW'
    });
    
    const result = await docClient.send(updateCommand);
    
    logger.info('Book updated successfully', { bookId, requestId });
    
    return createSuccessResponse({
      message: 'Book updated successfully',
      bookId,
      updatedAttributes: Object.keys(validatedData)
    }, requestId);
    
  } catch (error) {
    logger.error('Update book failed', error as Error, { requestId });
    
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
      'UPDATE_BOOK_FAILED',
      'Failed to update book',
      500,
      undefined,
      requestId
    );
  }
};