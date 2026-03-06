import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { CognitoIdentityProviderClient, InitiateAuthCommand } from '@aws-sdk/client-cognito-identity-provider';
import { getLogger } from '@common/utils/logger';
import { AuthenticationError, ValidationError } from '@common/utils/errors';
import { createSuccessResponse, createErrorResponse } from '@common/utils/response';
import { validateBody } from '@common/utils/validation';
import { z } from 'zod';

// Validation schema
const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const logger = getLogger('auth-refresh');

// Cognito client
const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

interface RefreshInput {
  refreshToken: string;
}

interface RefreshResponse {
  accessToken: string;
  idToken: string;
  expiresIn: number;
}

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const requestId = context.awsRequestId;
  logger.info('Token refresh request', { requestId });

  try {
    // Validate input
    const input: RefreshInput = validateBody(refreshSchema, event);

    // Refresh tokens with Cognito
    const authResult = await cognitoClient.send(new InitiateAuthCommand({
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      ClientId: process.env.COGNITO_CLIENT_ID!,
      AuthParameters: {
        REFRESH_TOKEN: input.refreshToken,
      },
    }));

    if (!authResult.AuthenticationResult) {
      throw new AuthenticationError('Invalid or expired refresh token');
    }

    logger.info('Token refreshed successfully', { requestId });

    const response: RefreshResponse = {
      accessToken: authResult.AuthenticationResult.AccessToken!,
      idToken: authResult.AuthenticationResult.IdToken!,
      expiresIn: authResult.AuthenticationResult.ExpiresIn!,
    };

    return createSuccessResponse(response, 200, requestId);

  } catch (error) {
    logger.error('Token refresh failed', error as Error, { requestId });

    if (error instanceof ValidationError || error instanceof AuthenticationError) {
      return createErrorResponse(
        error instanceof AuthenticationError ? 'TOKEN_REFRESH_FAILED' : error.code,
        error.message,
        error.statusCode,
        error.details,
        requestId
      );
    }

    return createErrorResponse('TOKEN_REFRESH_FAILED', 'Failed to refresh token', 500, undefined, requestId);
  }
};

export default handler;
