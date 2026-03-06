import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { getLogger } from '../../../../layers/common/nodejs/utils/logger';
import { ValidationError, NotFoundError, AuthorizationError } from '../../../../layers/common/nodejs/utils/errors';
import { createSuccessResponse, createErrorResponse } from '../../../../layers/common/nodejs/utils/response';
import { authenticate } from '../../../../layers/common/nodejs/middleware/auth';
import { validateBody, validatePath } from '../../../../layers/common/nodejs/utils/validation';
import { z } from 'zod';

const logger = getLogger('subjects-update');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const SUBJECTS_TABLE = `stealth-${process.env.STAGE || 'dev'}-subjects`;

const updateSubjectSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  code: z.string().min(1).optional(),
});

interface UpdateSubjectInput {
  name?: string;
  description?: string;
  code?: string;
}

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const requestId = context.awsRequestId;
  logger.info('Update subject request', { requestId });

  try {
    // Authenticate user
    const user = await authenticate(event);

    const subjectId = validatePath(event, 'id');
    const input: UpdateSubjectInput = validateBody(updateSubjectSchema, event);

    // Check if subject exists and belongs to user's institute
    const existingSubject = await docClient.send(new GetCommand({
      TableName: SUBJECTS_TABLE,
      Key: { subjectId },
    }));

    if (!existingSubject.Item) {
      throw new NotFoundError('Subject not found');
    }

    const dbSubject = existingSubject.Item;

    if (dbSubject.instituteId !== user.instituteId) {
      throw new AuthorizationError('Access denied');
    }

    const now = new Date().toISOString();
    const updateExpression = ['set updatedAt = :updatedAt'];
    const expressionAttributeValues: Record<string, any> = {
      ':updatedAt': now,
    };

    if (input.name) {
      updateExpression.push('name = :name');
      expressionAttributeValues[':name'] = input.name;
    }

    if (input.description !== undefined) {
      updateExpression.push('description = :description');
      expressionAttributeValues[':description'] = input.description;
    }

    if (input.code) {
      updateExpression.push('code = :code');
      expressionAttributeValues[':code'] = input.code;
    }

    await docClient.send(new UpdateCommand({
      TableName: SUBJECTS_TABLE,
      Key: { subjectId },
      UpdateExpression: updateExpression.join(', '),
      ExpressionAttributeValues: expressionAttributeValues,
    }));

    logger.info('Subject updated successfully', { requestId, subjectId });

    return createSuccessResponse({
      subjectId,
      name: input.name || dbSubject.name,
      description: input.description !== undefined ? input.description : dbSubject.description,
      code: input.code || dbSubject.code,
      updatedAt: now,
      message: 'Subject updated successfully',
    }, requestId);

  } catch (error) {
    logger.error('Update subject failed', error as Error, { requestId });

    if (error instanceof ValidationError || error instanceof NotFoundError || error instanceof AuthorizationError) {
      return createErrorResponse(
        error.code,
        error.message,
        error.statusCode,
        error.details,
        requestId
      );
    }

    return createErrorResponse(
      'UPDATE_SUBJECT_FAILED',
      'Failed to update subject',
      500,
      undefined,
      requestId
    );
  }
};

export default handler;
