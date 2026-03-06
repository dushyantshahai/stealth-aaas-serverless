import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { getLogger } from '../../../../layers/common/nodejs/utils/logger';
import { ValidationError, AuthorizationError, NotFoundError } from '../../../../layers/common/nodejs/utils/errors';
import { createSuccessResponse, createErrorResponse, createCreatedResponse } from '../../../../layers/common/nodejs/utils/response';
import { validateBody, validatePath } from '../../../../layers/common/nodejs/utils/validation';
import { authenticate } from '../../../../layers/common/nodejs/middleware/auth';
import { z } from 'zod';

const logger = getLogger('subjects-create');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const SUBJECTS_TABLE = `stealth-${process.env.STAGE || 'dev'}-subjects`;

const createSubjectSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  code: z.string().min(1, 'Code is required'),
  instituteId: z.string().min(1, 'Institute ID is required')
});

interface CreateSubjectInput {
  name: string;
  description?: string;
  code: string;
  instituteId: string;
}

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const requestId = context.awsRequestId;
  logger.info('Create subject request', { requestId });

  try {
    // Authenticate user
    const user = await authenticate(event);
    
    // Validate input
    const input: CreateSubjectInput = validateBody(createSubjectSchema, event);
    
    // Ensure user belongs to the institute they're creating subject for
    if (input.instituteId !== user.instituteId) {
      throw new AuthorizationError('Cannot create subject for different institute');
    }

    const subjectId = uuidv4();
    const now = new Date().toISOString();

    const subject = {
      subjectId: subjectId,
      name: input.name,
      description: input.description || '',
      code: input.code,
      instituteId: input.instituteId,
      createdAt: now,
      updatedAt: now,
      createdBy: user.userId,
      status: 'ACTIVE'
    };

    await docClient.send(new PutCommand({
      TableName: SUBJECTS_TABLE,
      Item: subject
    }));

    logger.info('Subject created successfully', { requestId, subjectId });

    return createCreatedResponse({
      subjectId,
      name: input.name,
      code: input.code,
      instituteId: input.instituteId,
      message: 'Subject created successfully'
    }, requestId);

  } catch (error) {
    logger.error('Create subject failed', error as Error, { requestId });
    
    if (error instanceof ValidationError || error instanceof AuthorizationError) {
      return createErrorResponse(error.code, error.message, error.statusCode, error.details, requestId);
    }
    
    return createErrorResponse('CREATE_SUBJECT_FAILED', 'Failed to create subject', 500, undefined, requestId);
  }
};

export default handler;
