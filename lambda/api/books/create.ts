import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { getLogger } from '../../../../layers/common/nodejs/utils/logger';
import { ValidationError, AuthorizationError, NotFoundError } from '../../../../layers/common/nodejs/utils/errors';
import { createSuccessResponse, createErrorResponse, createCreatedResponse } from '../../../../layers/common/nodejs/utils/response';
import { validateBody, validatePath } from '../../../../layers/common/nodejs/utils/validation';
import { authenticate } from '../../../../layers/common/nodejs/middleware/auth';
import { z } from 'zod';

const logger = getLogger('books-create');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const BOOKS_TABLE = process.env.BOOKS_TABLE || `stealth-${process.env.STAGE || 'dev'}-books`;
const SUBJECTS_TABLE = process.env.SUBJECTS_TABLE || `stealth-${process.env.STAGE || 'dev'}-subjects`;

const createBookSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  subjectId: z.string().min(1, 'Subject ID is required'),
  description: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

interface CreateBookInput {
  title: string;
  subjectId: string;
  description?: string;
  metadata?: Record<string, any>;
}

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const requestId = context.awsRequestId;
  logger.info('Create book request', { requestId });

  try {
    // Authenticate user
    const user = await authenticate(event);
    
    // Validate input
    const input: CreateBookInput = validateBody(createBookSchema, event);
    
    // Check if subject exists and belongs to user's institute
    const subject = await docClient.send(new GetCommand({
      TableName: SUBJECTS_TABLE,
      Key: { subjectId: input.subjectId }
    }));

    if (!subject.Item) {
      throw new NotFoundError('Subject not found');
    }

    // Check institute isolation
    if (subject.Item.instituteId !== user.instituteId) {
      throw new AuthorizationError('Access denied');
    }

    const bookId = uuidv4();
    const now = new Date().toISOString();

    const book = {
      bookId,
      title: input.title,
      subjectId: input.subjectId,
      instituteId: user.instituteId,
      description: input.description || '',
      metadata: input.metadata || {},
      status: 'DRAFT',
      createdBy: user.userId,
      createdAt: now,
      updatedAt: now,
      version: 1
    };

    await docClient.send(new PutCommand({
      TableName: BOOKS_TABLE,
      Item: book
    }));

    logger.info('Book created successfully', { requestId, bookId });

    return createCreatedResponse({
      bookId,
      title: input.title,
      subjectId: input.subjectId,
      message: 'Book created successfully'
    }, requestId);

  } catch (error) {
    logger.error('Create book failed', error as Error, { requestId });
    
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
      'CREATE_BOOK_FAILED',
      'Failed to create book',
      500,
      undefined,
      requestId
    );
  }
};

export default handler;
