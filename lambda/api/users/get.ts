import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { getLogger } from '/opt/nodejs/utils/logger';
import { NotFoundError, AuthorizationError } from '/opt/nodejs/utils/errors';
import { createSuccessResponse, createErrorResponse } from '/opt/nodejs/utils/response';
import { authenticate } from '/opt/nodejs/middleware/auth';
import { validatePath } from '/opt/nodejs/utils/validation';

const logger = getLogger('users-get');

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const USERS_TABLE = `stealth-aaas-${process.env.STAGE || 'dev'}-users`;

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const requestId = context.requestId;
  logger.info('Get user request', { requestId });

  try {
    const user = await authenticate(event);

    const userId = validatePath(event, 'id');

    const result = await docClient.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: { userId },
    }));

    if (!result.Item) {
      throw new NotFoundError('User not found');
    }

    const dbUser = result.Item;

    if (dbUser.instituteId !== user.instituteId) {
      throw new AuthorizationError('Access denied');
    }

    logger.info('User retrieved successfully', { requestId, userId });

    return createSuccessResponse({
      user: {
        userId: dbUser.userId,
        email: dbUser.email,
        name: dbUser.name,
        role: dbUser.role,
        instituteId: dbUser.instituteId,
        status: dbUser.status,
        createdAt: dbUser.createdAt,
        updatedAt: dbUser.updatedAt,
      },
    }, requestId);

  } catch (error) {
    logger.error('Get user failed', error as Error, { requestId });

    if (error instanceof NotFoundError || error instanceof AuthorizationError) {
      return createErrorResponse(
        error.code,
        error.message,
        error.statusCode,
        error.details,
        requestId
      );
    }

    return createErrorResponse(
      'GET_USER_FAILED',
      'Failed to get user',
      500,
      undefined,
      requestId
    );
  }
};

export default handler;