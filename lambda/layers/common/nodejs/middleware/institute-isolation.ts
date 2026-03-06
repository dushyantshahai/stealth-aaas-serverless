import { APIGatewayProxyEvent } from 'aws-lambda';
import { AuthorizationError } from '../utils/errors';

/**
 * Institute isolation middleware
 * Ensures users can only access resources within their own institute
 */
export function enforceInstituteIsolation(
  event: APIGatewayProxyEvent,
  user: { instituteId?: string }
): void {
  // Get instituteId from path parameters, query string, or body
  const resourceInstituteId = extractResourceInstituteId(event);

  if (!resourceInstituteId) {
    // If no resource institute ID, allow access (will be validated at data layer)
    return;
  }

  if (!user.instituteId) {
    throw new AuthorizationError('User institute ID is required');
  }

  if (resourceInstituteId !== user.instituteId) {
    throw new AuthorizationError(
      'Access denied: You can only access resources within your institute'
    );
  }
}

/**
 * Extract institute ID from various request locations
 */
function extractResourceInstituteId(event: APIGatewayProxyEvent): string | null {
  // Check path parameters
  const pathParams = event.pathParameters;
  if (pathParams?.instituteId) {
    return pathParams.instituteId;
  }

  // Check query string parameters
  const queryParams = event.queryStringParameters;
  if (queryParams?.instituteId) {
    return queryParams.instituteId;
  }

  // Check request body
  if (event.body) {
    try {
      const body = JSON.parse(event.body);
      if (body.instituteId) {
        return body.instituteId;
      }
    } catch {
      // Ignore JSON parse errors
    }
  }

  return null;
}

/**
 * Create institute-scoped query filter
 */
export function createInstituteFilter(
  userInstituteId: string | undefined,
  fieldName: string = 'instituteId'
): Record<string, string> | null {
  if (!userInstituteId) {
    return null;
  }
  return { [fieldName]: userInstituteId };
}

/**
 * Validate institute in create request
 */
export function validateInstituteInRequest(
  event: APIGatewayProxyEvent,
  user: { instituteId?: string }
): string {
  const requestInstituteId = extractResourceInstituteId(event);

  if (!requestInstituteId && user.instituteId) {
    // Use user's institute if not specified in request
    return user.instituteId;
  }

  if (requestInstituteId && requestInstituteId !== user.instituteId) {
    throw new AuthorizationError(
      'Cannot create resources for other institutes'
    );
  }

  if (!requestInstituteId && !user.instituteId) {
    throw new AuthorizationError('Institute ID is required');
  }

  return requestInstituteId || user.instituteId;
}

/**
 * Middleware wrapper for institute isolation
 */
export function withInstituteIsolation(
  handler: (event: APIGatewayProxyEvent, user: { instituteId?: string }) => Promise<unknown>
) {
  return async (
    event: APIGatewayProxyEvent,
    user: { instituteId?: string }
  ): Promise<unknown> => {
    enforceInstituteIsolation(event, user);
    return handler(event, user);
  };
}

export default {
  enforceInstituteIsolation,
  createInstituteFilter,
  validateInstituteInRequest,
  withInstituteIsolation,
};
