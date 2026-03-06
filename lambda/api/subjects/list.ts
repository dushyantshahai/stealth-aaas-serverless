import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand as DocQueryCommand } from '@aws-sdk/lib-dynamodb';
import { getLogger } from '@common/utils/logger';
import { ValidationError } from '@common/utils/errors';
import { createSuccessResponse, createErrorResponse } from '@common/utils/response';
import { authenticate } from '@common/middleware/auth';
import { z } from 'zod';

const logger = getLogger('subjects-list');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const SUBJECTS_TABLE = `stealth-${process.env.STAGE || 'dev'}-subjects`;

const listSubjectsSchema = z.object({
  limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 20),
  lastEvaluatedKey: z.string().optional(),
});

interface ListSubjectsInput {
  limit: number;
  lastEvaluatedKey?: string;
}

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const requestId = context.awsRequestId;
  logger.info('List subjects request', { requestId });

  try {
    // Authenticate user
    const user = await authenticate(event);

    const input: ListSubjectsInput = listSubjectsSchema.parse({
      limit: event.queryStringParameters?.limit,
      lastEvaluatedKey: event.queryStringParameters?.lastEvaluatedKey,
    });

    const queryParams: Record<string, any> = {
      TableName: SUBJECTS_TABLE,
      IndexName: 'instituteId-index',
      KeyConditionExpression: 'instituteId = :instituteId',
      ExpressionAttributeValues: {
        ':instituteId': { S: user.instituteId },
      },
      Limit: input.limit,
      ScanIndexForward: false,
    };

    if (input.lastEvaluatedKey) {
      queryParams.ExclusiveStartKey = JSON.parse(input.lastEvaluatedKey);
    }

    const result = await docClient.send(new DocQueryCommand(queryParams));

    const subjects = (result.Items || []).map(item => ({
      subjectId: item.subjectId,
      name: item.name,
      description: item.description,
      code: item.code,
      instituteId: item.instituteId,
      status: item.status,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      createdBy: item.createdBy,
    }));

    logger.info('Subjects listed successfully', { 
      requestId, 
      count: subjects.length,
      hasMore: !!result.LastEvaluatedKey,
    });

    return createSuccessResponse({
      subjects,
      pagination: {
        count: subjects.length,
        lastEvaluatedKey: result.LastEvaluatedKey 
          ? JSON.stringify(result.LastEvaluatedKey) 
          : undefined,
        hasMore: !!result.LastEvaluatedKey,
      },
    }, requestId);

  } catch (error) {
    logger.error('List subjects failed', error as Error, { requestId });

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
      'LIST_SUBJECTS_FAILED',
      'Failed to list subjects',
      500,
      undefined,
      requestId
    );
  }
};

export default handler;
