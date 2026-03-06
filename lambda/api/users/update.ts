import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { CognitoIdentityProviderClient, AdminUpdateUserAttributesCommand } from '@aws-sdk/client-cognito-identity-provider';
import { getLogger } from '@common/utils/logger';
import { ValidationError, NotFoundError, AuthorizationError } from '@common/utils/errors';
import { createSuccessResponse, createErrorResponse } from '@common/utils/response';
import { authenticate } from '@common/middleware/auth';
import { validateBody, validatePath } from '@common/utils/validation';
import { z } from 'zod';

const logger = getLogger('users-update');

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

const USERS_TABLE = `stealth-aaas-${process.env.STAGE || 'dev'}-users`;

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(['Admin', 'Professor', 'Student']).optional(),
});

interface UpdateUserInput {
  name?: string;
  role?: 'Admin' | 'Professor' | 'Student';
}

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const requestId = context.awsRequestId;
  logger.info('Update user request', { requestId });

  try {
    const user = await authenticate(event);

    const userId = validatePath(event, 'id');
    const input: UpdateUserInput = validateBody(updateUserSchema, event);

    const existingUser = await docClient.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: { userId },
    }));

    if (!existingUser.Item) {
      throw new NotFoundError('User not found');
    }

    const dbUser = existingUser.Item;

    if (dbUser.instituteId !== user.instituteId) {
      throw new AuthorizationError('Access denied');
    }

    const now = new Date().toISOString();
    const updateExpression = ['set updatedAt = :updatedAt'];
    const expressionAttributeValues: Record<string, unknown> = {
      ':updatedAt': now,
    };

    if (input.name) {
      updateExpression.push('name = :name');
      expressionAttributeValues[':name'] = input.name;
    }

    if (input.role) {
      updateExpression.push('role = :role');
      expressionAttributeValues[':role'] = input.role;

      await cognitoClient.send(new AdminUpdateUserAttributesCommand({
        UserPoolId: process.env.COGNITO_USER_POOL_ID!,
        Username: dbUser.email,
        UserAttributes: [
          { Name: 'custom:userRole', Value: input.role },
        ],
      }));
    }

    await docClient.send(new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { userId },
      UpdateExpression: updateExpression.join(', '),
      ExpressionAttributeValues: expressionAttributeValues,
    }));

    logger.info('User updated successfully', { requestId, userId });

    return createSuccessResponse({
      userId,
      name: input.name || dbUser.name,
      role: input.role || dbUser.role,
      updatedAt: now,
      message: 'User updated successfully',
    }, requestId);

  } catch (error) {
    logger.error('Update user failed', error as Error, { requestId });

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
      'UPDATE_USER_FAILED',
      'Failed to update user',
      500,
      undefined,
      requestId
    );
  }
};

export default handler;
