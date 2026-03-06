import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand as DocQueryCommand } from '@aws-sdk/lib-dynamodb';
import { getLogger } from '/opt/nodejs/utils/logger';
import { ValidationError, NotFoundError } from '/opt/nodejs/utils/errors';
import { createSuccessResponse, createErrorResponse } from '/opt/nodejs/utils/response';
import { authenticate } from '/opt/nodejs/middleware/auth';
import { z } from 'zod';

const logger = getLogger('users-list');

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const USERS_TABLE = `stealth-aaas-${process.env.STAGE || 'dev'}-users`;

const listUsersSchema = z.object({
  limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 20),
  lastEvaluatedKey: z.string().optional(),
});

interface ListUsersInput {
  limit: number;
  lastEvaluatedKey?: string;
}

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const requestId = context.requestId;
  logger.info('List users request', { requestId });

  try {
    const user = await authenticate(event);

    const input: ListUsersInput = listUsersSchema.parse({
      limit: event.queryStringParameters?.limit,
      lastEvaluatedKey: event.queryStringParameters?.lastEvaluatedKey,
    });

    const queryParams: Record<string, string> = {
      IndexName: 'instituteId-index',
      KeyConditionExpression: 'instituteId = :instituteId',
      ExpressionAttributeValues: {
        ':instituteId': { S: user.instituteId },
      },
      Limit: input.limit,
      ScanIndexForward: false,
    };

    if (input.lastEvaluatedKey) {
      queryParams.ExclusiveStartKey = input.lastEvaluatedKey;
    }

    const result = await docClient.send(new DocQueryCommand({
      TableName: USERS_TABLE,
      ...queryParams,
    }));

    const users = (result.Items || []).map(item => ({
      userId: item.userId,
      email: item.email,
      name: item.name,
      role: item.role,
      instituteId: item.instituteId,
      status: item.status,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));

    logger.info('Users listed successfully', { 
      requestId, 
      count: users.length,
      hasMore: !!result.LastEvaluatedKey,
    });

    return createSuccessResponse({
      users,
      pagination: {
        count: users.length,
        lastEvaluatedKey: result.LastEvaluatedKey 
          ? JSON.stringify(result.LastEvaluatedKey) 
          : undefined,
        hasMore: !!result.LastEvaluatedKey,
      },
    }, requestId);

  } catch (error) {
    logger.error('List users failed', error as Error, { requestId });

    if (error instanceof ValidationError) {
      return createErrorResponse(
        error.code,
        error.message,
        error.statusCode,
        error.details,
        requestId
      );
    }

    return createErrorResponse(
      'LIST_USERS_FAILED',
      'Failed to list users',
      500,
      undefined,
      requestId
    );
  }
};

export default handler;