import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { CognitoIdentityProviderClient, AdminDisableUserCommand } from '@aws-sdk/client-cognito-identity-provider';
import { getLogger } from '../../../../layers/common/nodejs/utils/logger';
import { ValidationError, NotFoundError, AuthorizationError, BadRequestError } from '../../../../layers/common/nodejs/utils/errors';
import { createSuccessResponse, createErrorResponse } from '../../../../layers/common/nodejs/utils/response';
import { authenticate } from '../../../../layers/common/nodejs/middleware/auth';
import { adminOnly } from '../../../../layers/common/nodejs/middleware/rbac';
import { validatePath } from '../../../../layers/common/nodejs/utils/validation';

const logger = getLogger('users-delete');

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

const USERS_TABLE = `stealth-aaas-${process.env.STAGE || 'dev'}-users`;

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const requestId = context.requestId;
  logger.info('Delete user request', { requestId });

  try {
    const user = await authenticate(event);
    adminOnly(event, user);

    const userId = validatePath(event, 'id');

    if (userId === user.userId) {
      throw new BadRequestError('Cannot delete your own account');
    }

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

    await docClient.send(new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { userId },
      UpdateExpression: 'set #status = :status, deletedAt = :deletedAt, updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': 'DELETED',
        ':deletedAt': now,
        ':updatedAt': now,
      },
    }));

    if (dbUser.cognitoSub) {
      try {
        await cognitoClient.send(new AdminDisableUserCommand({
          UserPoolId: process.env.COGNITO_USER_POOL_ID!,
          Username: dbUser.email,
        }));
      } catch (cognitoError) {
        logger.warn('Failed to disable user in Cognito', { 
          requestId, 
          email: dbUser.email,
          error: (cognitoError as Error).message 
        });
      }
    }

    logger.info('User deleted successfully', { requestId, userId });

    return createSuccessResponse({
      userId,
      message: 'User deleted successfully',
    }, requestId);

  } catch (error) {
    logger.error('Delete user failed', error as Error, { requestId });

    if (error instanceof ValidationError || error instanceof NotFoundError || 
        error instanceof AuthorizationError || error instanceof BadRequestError) {
      return createErrorResponse(
        error.code,
        error.message,
        error.statusCode,
        error.details,
        requestId
      );
    }

    return createErrorResponse(
      'DELETE_USER_FAILED',
      'Failed to delete user',
      500,
      undefined,
      requestId
    );
  }
};

export default handler;
