import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { getLogger } from '../../../../layers/common/nodejs/utils/logger';
import { ValidationError, AuthorizationError, NotFoundError } from '../../../../layers/common/nodejs/utils/errors';
import { createSuccessResponse, createErrorResponse } from '../../../../layers/common/nodejs/utils/response';
import { authenticate } from '../../../../layers/common/nodejs/middleware/auth';
import { validateBody } from '../../../../layers/common/nodejs/utils/validation';
import { z } from 'zod';

const logger = getLogger('subtopics-create');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const SUBTOPICS_TABLE = process.env.SUBTOPICS_TABLE || `stealth-${process.env.STAGE || 'dev'}-subtopics`;
const TOPICS_TABLE = process.env.TOPICS_TABLE || `stealth-${process.env.STAGE || 'dev'}-topics`;

const createSubtopicSchema = z.object({
  topicId: z.string().min(1, 'Topic ID is required'),
  title: z.string().min(1, 'Title is required'),
  order: z.number().int().positive('Order must be a positive number'),
  pageStart: z.number().int().nonnegative('Page start must be non-negative').optional(),
  pageEnd: z.number().int().nonnegative('Page end must be non-negative').optional(),
  description: z.string().optional()
});

export const handler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  const requestId = context.awsRequestId;
  logger.info('Create subtopic request', { requestId });

  try {
    // Authenticate user
    const user = await authenticate(event);
    
    // Validate request body
    const body = JSON.parse(event.body || '{}');
    const validatedData = validateBody(createSubtopicSchema, body);
    
    // First, verify the topic exists and belongs to user's institute
    const topic = await getTopic(validatedData.topicId);
    
    // Check institute isolation
    if (topic.instituteId !== user.instituteId) {
      throw new AuthorizationError('Access denied');
    }
    
    // Check if user has permission to modify this topic
    if (topic.createdBy !== user.userId && user.role !== 'Admin') {
      throw new AuthorizationError('You do not have permission to add subtopics to this topic');
    }
    
    // Generate subtopic ID and timestamps
    const subtopicId = uuidv4();
    const now = new Date().toISOString();
    
    const subtopic = {
      subtopicId: subtopicId,
      topicId: validatedData.topicId,
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
      TableName: SUBTOPICS_TABLE,
      Item: subtopic
    }));
    
    logger.info('Subtopic created successfully', { subtopicId, requestId });
    
    return createSuccessResponse({
      message: 'Subtopic created successfully',
      subtopicId,
      subtopic: {
        subtopicId,
        topicId: subtopic.topicId,
        title: subtopic.title,
        order: subtopic.order,
        pageStart: subtopic.pageStart,
        pageEnd: subtopic.pageEnd,
        description: subtopic.description
      }
    }, requestId);
    
  } catch (error) {
    logger.error('Create subtopic failed', error as Error, { requestId });
    
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
      'CREATE_SUBTOPIC_FAILED',
      'Failed to create subtopic',
      500,
      undefined,
      requestId
    );
  }
};

async function getTopic(topicId: string) {
  const result = await docClient.send(new GetCommand({
    TableName: TOPICS_TABLE,
    Key: { topicId }
  }));
  
  if (!result.Item) {
    throw new NotFoundError('Topic not found');
  }
  
  return result.Item;
}
