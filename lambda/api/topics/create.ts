import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { getLogger } from '/opt/nodejs/utils/logger';
import { ValidationError, AuthorizationError, NotFoundError } from '/opt/nodejs/utils/errors';
import { createSuccessResponse, createErrorResponse } from '/opt/nodejs/utils/response';
import { authenticate } from '/opt/nodejs/middleware/auth';
import { validateBody } from '/opt/nodejs/utils/validation';
import { z } from 'zod';

const logger = getLogger('topics-create');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const TOPICS_TABLE = process.env.TOPICS_TABLE || `stealth-${process.env.STAGE || 'dev'}-topics`;
const CHAPTERS_TABLE = process.env.CHAPTERS_TABLE || `stealth-${process.env.STAGE || 'dev'}-chapters`;

const createTopicSchema = z.object({
  chapterId: z.string().min(1, 'Chapter ID is required'),
  title: z.string().min(1, 'Title is required'),
  order: z.number().int().positive('Order must be a positive number'),
  pageStart: z.number().int().nonnegative('Page start must be non-negative').optional(),
  pageEnd: z.number().int().nonnegative('Page end must be non-negative').optional(),
  description: z.string().optional()
});

export const handler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  const requestId = context.awsRequestId;
  logger.info('Create topic request', { requestId });

  try {
    // Authenticate user
    const user = await authenticate(event);
    
    // Validate request body
    const body = JSON.parse(event.body || '{}');
    const validatedData = validateBody(createTopicSchema, body);
    
    // First, verify the chapter exists and belongs to user's institute
    const chapter = await getChapter(validatedData.chapterId);
    
    // Check institute isolation
    if (chapter.instituteId !== user.instituteId) {
      throw new AuthorizationError('Access denied');
    }
    
    // Check if user has permission to modify this chapter
    if (chapter.createdBy !== user.userId && user.role !== 'Admin') {
      throw new AuthorizationError('You do not have permission to add topics to this chapter');
    }
    
    // Generate topic ID and timestamps
    const topicId = uuidv4();
    const now = new Date().toISOString();
    
    const topic = {
      topicId: topicId,
      chapterId: validatedData.chapterId,
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
      TableName: TOPICS_TABLE,
      Item: topic
    }));
    
    logger.info('Topic created successfully', { topicId, requestId });
    
    return createSuccessResponse({
      message: 'Topic created successfully',
      topicId,
      topic: {
        topicId,
        chapterId: topic.chapterId,
        title: topic.title,
        order: topic.order,
        pageStart: topic.pageStart,
        pageEnd: topic.pageEnd,
        description: topic.description
      }
    }, requestId);
    
  } catch (error) {
    logger.error('Create topic failed', error as Error, { requestId });
    
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
      'CREATE_TOPIC_FAILED',
      'Failed to create topic',
      500,
      undefined,
      requestId
    );
  }
};

async function getChapter(chapterId: string) {
  const result = await docClient.send(new GetCommand({
    TableName: CHAPTERS_TABLE,
    Key: { chapterId }
  }));
  
  if (!result.Item) {
    throw new NotFoundError('Chapter not found');
  }
  
  return result.Item;
}