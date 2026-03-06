import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import { logger, getLogger } from '../utils/logger';
import { AuthenticationError, AuthorizationError } from '../utils/errors';

// JWKS for Cognito
const jwks = createRemoteJWKSet(
  new URL(`https://cognito-idp.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}`)
);

/**
 * Extract JWT token from Authorization header
 */
export function extractToken(event: APIGatewayProxyEvent): string | null {
  const authHeader = event.headers?.Authorization || event.headers?.authorization;
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Verify JWT token and return payload
 */
export async function verifyToken(token: string): Promise<{
  sub: string;
  email?: string;
  'custom:instituteId'?: string;
  'custom:userRole'?: string;
  exp?: number;
  iat?: number;
}> {
  try {
    const { payload } = await jwks(token, {
      issuer: `https://cognito-idp.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}`,
      audience: process.env.COGNITO_CLIENT_ID,
    });

    return payload as {
      sub: string;
      email?: string;
      'custom:instituteId'?: string;
      'custom:userRole'?: string;
      exp?: number;
      iat?: number;
    };
  } catch (error) {
    logger.error('JWT verification failed', error as Error);
    throw new AuthenticationError('Invalid or expired token');
  }
}

/**
 * Authentication middleware
 */
export async function authenticate(
  event: APIGatewayProxyEvent
): Promise<{
  userId: string;
  email?: string;
  instituteId?: string;
  userRole?: string;
}> {
  const token = extractToken(event);
  if (!token) {
    throw new AuthenticationError('Authorization token is required');
  }

  const payload = await verifyToken(token);
  return {
    userId: payload.sub,
    email: payload.email,
    instituteId: payload['custom:instituteId'],
    userRole: payload['custom:userRole'],
  };
}

/**
 * Optional authentication (doesn't throw if no token)
 */
export async function optionalAuth(
  event: APIGatewayProxyEvent
): Promise<{
  userId?: string;
  email?: string;
  instituteId?: string;
  userRole?: string;
} | null> {
  const token = extractToken(event);
  if (!token) {
    return null;
  }

  try {
    const payload = await verifyToken(token);
    return {
      userId: payload.sub,
      email: payload.email,
      instituteId: payload['custom:instituteId'],
      userRole: payload['custom:userRole'],
    };
  } catch {
    return null;
  }
}

/**
 * Create authenticated handler wrapper
 */
export function withAuth<T extends APIGatewayProxyResult>(
  handler: (
    event: APIGatewayProxyEvent,
    context: { userId: string; email?: string; instituteId?: string; userRole?: string }
  ) => Promise<T>
) {
  return async (event: APIGatewayProxyEvent): Promise<T> => {
    const user = await authenticate(event);
    return handler(event, user);
  };
}

export default {
  extractToken,
  verifyToken,
  authenticate,
  optionalAuth,
  withAuth,
};