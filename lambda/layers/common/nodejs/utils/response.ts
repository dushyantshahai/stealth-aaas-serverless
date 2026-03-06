import { APIGatewayProxyResult } from 'aws-lambda';
import { logResponse } from './logger';

/**
 * Standard API response interface
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    requestId?: string;
    timestamp?: string;
  };
}

/**
 * Create a successful API response
 */
export function createSuccessResponse<T>(
  data: T,
  statusCode: number = 200,
  requestId?: string
): APIGatewayProxyResult {
  const response: ApiResponse<T> = {
    success: true,
    data,
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
    },
  };

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'X-Request-Id': requestId || '',
    },
    body: JSON.stringify(response),
  };
}

/**
 * Create an error API response
 */
export function createErrorResponse(
  code: string,
  message: string,
  statusCode: number = 500,
  details?: unknown,
  requestId?: string
): APIGatewayProxyResult {
  const response: ApiResponse = {
    success: false,
    error: {
      code,
      message,
      details,
    },
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
    },
  };

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'X-Request-Id': requestId || '',
    },
    body: JSON.stringify(response),
  };
}

/**
 * Create a paginated response
 */
export function createPaginatedResponse<T>(
  items: T[],
  nextToken?: string,
  requestId?: string
): APIGatewayProxyResult {
  const response: ApiResponse<{ items: T[]; nextToken?: string }> = {
    success: true,
    data: {
      items,
      ...(nextToken && { nextToken }),
    },
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
    },
  };

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'X-Request-Id': requestId || '',
    },
    body: JSON.stringify(response),
  };
}

/**
 * Create a created response (201)
 */
export function createCreatedResponse<T>(
  data: T,
  requestId?: string
): APIGatewayProxyResult {
  return createSuccessResponse(data, 201, requestId);
}

/**
 * Create a no content response (204)
 */
export function createNoContentResponse(requestId?: string): APIGatewayProxyResult {
  return {
    statusCode: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'X-Request-Id': requestId || '',
    },
    body: '',
  };
}

/**
 * Handle Lambda response with logging
 */
export function handleResponse(
  result: APIGatewayProxyResult,
  requestId: string
): APIGatewayProxyResult {
  logResponse(result.statusCode, requestId);
  return result;
}

export default {
  ApiResponse,
  createSuccessResponse,
  createErrorResponse,
  createPaginatedResponse,
  createCreatedResponse,
  createNoContentResponse,
  handleResponse,
};
