import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { CognitoIdentityProviderClient, ForgotPasswordCommand } from '@aws-sdk/client-cognito-identity-provider';
import { getLogger } from '/opt/nodejs/utils/logger';
import { ValidationError, NotFoundError } from '/opt/nodejs/utils/errors';
import { createSuccessResponse, createErrorResponse } from '/opt/nodejs/utils/response';
import { validateBody } from '/opt/nodejs/utils/validation';
import { z } from 'zod';

// Validation schema
const resetPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const logger = getLogger('auth-reset-password');

// Cognito client
const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

interface ResetPasswordInput {
  email: string;
}

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const requestId = context.requestId;
  logger.info('Password reset request', { requestId });

  try {
    // Validate input
    const input: ResetPasswordInput = validateBody(resetPasswordSchema, event);

    // Trigger Cognito forgot password flow
    await cognitoClient.send(new ForgotPasswordCommand({
      ClientId: process.env.COGNITO_CLIENT_ID!,
      Username: input.email,
    }));

    logger.info('Password reset email sent', { requestId, email: input.email });

    return createSuccessResponse({
      message: 'Password reset email sent. Please check your email for the verification code.',
    }, 200, requestId);

  } catch (error) {
    logger.error('Password reset failed', error as Error, { requestId });

    if (error instanceof ValidationError) {
      return createErrorResponse(error.code, error.message, error.statusCode, error.details, requestId);
    }

    // Cognito throws UserNotFoundException if user doesn't exist
    // We don't want to reveal whether a user exists, so we return success anyway
    if ((error as Error).name === 'UserNotFoundException') {
      logger.warn('Password reset for non-existent user', { requestId, email: input.email });
      return createSuccessResponse({
        message: 'If an account exists with this email, a password reset link has been sent.',
      }, 200, requestId);
    }

    return createErrorResponse('PASSWORD_RESET_FAILED', 'Failed to process password reset request', 500, undefined, requestId);
  }
};

export default handler;