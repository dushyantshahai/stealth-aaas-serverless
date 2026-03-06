import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { getLogger } from '../../../../layers/common/nodejs/utils/logger';
import { NotFoundError, AuthorizationError } from '../../../../layers/common/nodejs/utils/errors';
import { createSuccessResponse, createErrorResponse } from '../../../../layers/common/nodejs/utils/response';
import { authenticate } from '../../../../layers/common/nodejs/middleware/auth';
import { validatePath } from '../../../../layers/common/nodejs/utils/validation';

const logger = getLogger('subjects-get');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const SUBJECTS_TABLE = `stealth-${process.env.STAGE || 'dev'}-subjects`;

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const requestId = context.awsRequestId;
  logger.info('Get subject request', { requestId });

  try {
    // Authenticate user
    const user = await authenticate(event);
    
    // Get subject ID from path
    const subjectId = validatePath(event, 'id');

    // Get subject from DynamoDB
    const result = await docClient.send(new GetCommand({
      TableName: SUBJECTS_TABLE,
      Key: { subjectId }
    }));

    if (!result.Item) {
      throw new NotFoundError('Subject not found');
    }

    const subject = result.Item;

    // Check institute isolation
    if (subject.instituteId !== user.instituteId) {
      throw new AuthorizationError('Access denied');
    }

    logger.info('Subject retrieved successfully', { requestId, subjectId });

    return createSuccessResponse({
      subject: {
        subjectId: subject.subjectId,
        name: subject.name,
        description: subject.description,
        code: subject.code,
        instituteId: subject.instituteId,
        status: subject.status,
        createdAt: subject.createdAt,
        updatedAt: subject.updatedAt,
        createdBy: subject.createdBy
      }
    }, requestId);

  } catch (error) {
    logger.error('Get subject failed', error as Error, { requestId });
    
    if (error instanceof NotFoundError || error instanceof AuthorizationError) {
      return createErrorResponse(error.code, error.message, error.statusCode, error.details, requestId);
    }
    
    return createErrorResponse('GET_SUBJECT_FAILED', 'Failed to get subject', 500, undefined, requestId);
  }
};

export default handler;
