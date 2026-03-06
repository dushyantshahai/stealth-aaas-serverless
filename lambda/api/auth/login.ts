import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { CognitoIdentityProviderClient, InitiateAuthCommand } from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { getLogger } from '@common/utils/logger';
import { AuthenticationError, ValidationError } from '@common/utils/errors';
import { createSuccessResponse, createErrorResponse } from '@common/utils/response';
import { validateBody } from '@common/utils/validation';
import { z } from 'zod';

// Validation schema
const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const logger = getLogger('auth-login');

// Cognito client
const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

// DynamoDB client
const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const USERS_TABLE = `stealth-aaas-${process.env.STAGE || 'dev'}-users`;

interface LoginInput {
  email: string;
  password: string;
}

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  expiresIn: number;
  user: {
    userId: string;
    email: string;
    name: string;
    role: string;
    instituteId: string;
  };
}

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const requestId = context.awsRequestId;
  logger.info('User login request', { requestId });

  try {
    // Validate input
    const input: LoginInput = validateBody(loginSchema, event);

    // Authenticate with Cognito
    const authResult = await cognitoClient.send(new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: process.env.COGNITO_CLIENT_ID!,
      AuthParameters: {
        USERNAME: input.email,
        PASSWORD: input.password,
      },
    }));

    if (!authResult.AuthenticationResult) {
      throw new AuthenticationError('Invalid email or password');
    }

    // Get user profile from DynamoDB
    const userResult = await docClient.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: { email: input.email.toLowerCase() },
    }));

    if (!userResult.Item) {
      throw new AuthenticationError('User not found');
    }

    const user = userResult.Item;

    logger.info('User logged in successfully', { requestId, userId: user.userId, email: input.email });

    const response: LoginResponse = {
      accessToken: authResult.AuthenticationResult.AccessToken!,
      refreshToken: authResult.AuthenticationResult.RefreshToken!,
      idToken: authResult.AuthenticationResult.IdToken!,
      expiresIn: authResult.AuthenticationResult.ExpiresIn!,
      user: {
        userId: user.userId as string,
        email: user.email as string,
        name: user.name as string,
        role: user.role as string,
        instituteId: user.instituteId as string,
      },
    };

    return createSuccessResponse(response, 200, requestId);

  } catch (error) {
    logger.error('Login failed', error as Error, { requestId });

    if (error instanceof ValidationError || error instanceof AuthenticationError) {
      return createErrorResponse(
        error instanceof AuthenticationError ? 'AUTHENTICATION_FAILED' : error.code,
        error.message,
        error.statusCode,
        error.details,
        requestId
      );
    }

    return createErrorResponse('LOGIN_FAILED', 'Failed to login', 500, undefined, requestId);
  }
};

export default handler;
