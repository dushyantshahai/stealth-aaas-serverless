import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { getLogger } from '@common/utils/logger';
import { ValidationError, AuthorizationError, NotFoundError } from '@common/utils/errors';
import { createSuccessResponse, createErrorResponse } from '@common/utils/response';
import { authenticate } from '@common/middleware/auth';
import { validateBody, validatePath } from '@common/utils/validation';
import { z } from 'zod';

const logger = getLogger('chapters-create');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const CHAPTERS_TABLE = process.env.CHAPTERS_TABLE || `stealth-${process.env.STAGE || 'dev'}-chapters`;
const BOOKS_TABLE = process.env.BOOKS_TABLE || `stealth-${process.env.STAGE || 'dev'}-books`;

const createChapterSchema = z.object({
  bookId: z.string().min(1, 'Book ID is required'),
  title: z.string().min(1, 'Title is required'),
  order: z.number().int().positive('Order must be a positive number'),
  pageStart: z.number().int().nonnegative('Page start must be non-negative').optional(),
  pageEnd: z.number().int().nonnegative('Page end must be non-negative').optional(),
  description: z.string().optional()
});

export const handler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  const requestId = context.awsRequestId;
  logger.info('Create chapter request', { requestId });

  try {
    // Authenticate user
    const user = await authenticate(event);
    
    // Validate request body
    const body = JSON.parse(event.body || '{}');
    const validatedData = validateBody(createChapterSchema, body);
    
    // First, verify the book exists and belongs to user's institute
    const book = await getBook(validatedData.bookId);
    
    // Check institute isolation
    if (book.instituteId !== user.instituteId) {
      throw new AuthorizationError('Access denied');
    }
    
    // Check if user has permission to modify this book
    if (book.createdBy !== user.userId && user.role !== 'Admin') {
      throw new AuthorizationError('You do not have permission to add chapters to this book');
    }
    
    // Generate chapter ID and timestamps
    const chapterId = uuidv4();
    const now = new Date().toISOString();
    
    const chapter = {
      chapterId: chapterId,
      bookId: validatedData.bookId,
      title: validatedData.title,
      order: validatedData.order,
      pageStart: validatedData.pageStart || 0,
      pageEnd: validatedData.pageEnd || 0,
      description: validatedData.description || '',
      instituteId: user.instituteId,
      createdBy: user.userId,
      createdAt: now,
      updatedAt: now,
      version: 1
    };
    
    // Save to DynamoDB
    await docClient.send(new PutCommand({
      TableName: CHAPTERS_TABLE,
      Item: chapter
    }));
    
    logger.info('Chapter created successfully', { chapterId, requestId });
    
    return createSuccessResponse({
      message: 'Chapter created successfully',
      chapterId,
      chapter: {
        chapterId,
        bookId: chapter.bookId,
        title: chapter.title,
        order: chapter.order,
        pageStart: chapter.pageStart,
        pageEnd: chapter.pageEnd,
        description: chapter.description
      }
    }, requestId);
    
  } catch (error) {
    logger.error('Create chapter failed', error as Error, { requestId });
    
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
      'CREATE_CHAPTER_FAILED',
      'Failed to create chapter',
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
