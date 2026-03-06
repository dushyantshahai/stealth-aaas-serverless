import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { getLogger } from '@common/utils/logger';
import { NotFoundError, AuthorizationError, BadRequestError } from '@common/utils/errors';
import { createSuccessResponse, createErrorResponse } from '@common/utils/response';
import { authenticate } from '@common/middleware/auth';
import { validatePath } from '@common/utils/validation';

const logger = getLogger('subjects-delete');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const SUBJECTS_TABLE = `stealth-${process.env.STAGE || 'dev'}-subjects`;
const BOOKS_TABLE = `stealth-${process.env.STAGE || 'dev'}-books`;

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const requestId = context.awsRequestId;
  logger.info('Delete subject request', { requestId });

  try {
    // Authenticate user
    const user = await authenticate(event);

    const subjectId = validatePath(event, 'id');

    // Check if subject exists and belongs to user's institute
    const existingSubject = await docClient.send(new GetCommand({
      TableName: SUBJECTS_TABLE,
      Key: { subjectId },
    }));

    if (!existingSubject.Item) {
      throw new NotFoundError('Subject not found');
    }

    const dbSubject = existingSubject.Item;

    if (dbSubject.instituteId !== user.instituteId) {
      throw new AuthorizationError('Access denied');
    }

    // Check if subject has any books
    const booksResult = await docClient.send(new QueryCommand({
      TableName: BOOKS_TABLE,
      IndexName: 'subjectId-index',
      KeyConditionExpression: 'subjectId = :subjectId',
      ExpressionAttributeValues: {
        ':subjectId': { S: subjectId },
      },
      Limit: 1,
    }));

    if (booksResult.Items && booksResult.Items.length > 0) {
      throw new BadRequestError('Cannot delete subject with existing books');
    }

    const now = new Date().toISOString();

    // Soft delete - mark as deleted
    await docClient.send(new UpdateCommand({
      TableName: SUBJECTS_TABLE,
      Key: { subjectId },
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

    logger.info('Subject deleted successfully', { requestId, subjectId });

    return createSuccessResponse({
      subjectId,
      message: 'Subject deleted successfully',
    }, requestId);

  } catch (error) {
    logger.error('Delete subject failed', error as Error, { requestId });

    if (error instanceof NotFoundError || error instanceof AuthorizationError || error instanceof BadRequestError) {
      return createErrorResponse(
        error.code,
        error.message,
        error.statusCode,
        error.details,
        requestId
      );
    }

    return createErrorResponse(
      'DELETE_SUBJECT_FAILED',
      'Failed to delete subject',
      500,
      undefined,
      requestId
    );
  }
};

export default handler;
