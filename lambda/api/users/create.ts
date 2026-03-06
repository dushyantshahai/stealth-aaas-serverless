import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminGetUserCommand } from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { getLogger } from '/opt/nodejs/utils/logger';
import { ValidationError, ConflictError, AuthorizationError, ExternalServiceError } from '/opt/nodejs/utils/errors';
import { createSuccessResponse, createErrorResponse, createCreatedResponse } from '/opt/nodejs/utils/response';
import { validateBody, validatePath } from '/opt/nodejs/utils/validation';
import { authenticate } from '/opt/nodejs/middleware/auth';
import { adminOnly } from '/opt/nodejs/middleware/rbac';
import { z } from 'zod';

// Validation schema
const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(1, 'Name is required'),
  role: z.enum(['Admin', 'Professor', 'Student'], {
    errorMap: () => ({ message: 'Invalid role. Must be Admin, Professor, or Student' }),
  }),
  instituteId: z.string().min(1, 'Institute ID is required'),
});

const logger = getLogger('users-create');

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

interface CreateUserInput {
  email: string;
  name: string;
  role: 'Admin' | 'Professor' | 'Student';
  instituteId: string;
}

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const requestId = context.requestId;
  logger.info('Create user request', { requestId });

  try {
    // Authenticate and authorize
    const user = await authenticate(event);
    adminOnly(event, user);

    // Validate input
    const input: CreateUserInput = validateBody(createUserSchema, event);

    // Ensure instituteId matches admin's institute
    if (input.instituteId !== user.instituteId) {
      throw new AuthorizationError('Cannot create users for other institutes');
    }

    // Check if user already exists
    try {
      await cognitoClient.send(new AdminGetUserCommand({
        UserPoolId: process.env.COGNITO_USER_POOL_ID!,
        Username: input.email,
      }));
      throw new ConflictError('User with this email already exists');
    } catch (error: unknown) {
      if ((error as Error).name !== 'UserNotFoundException') {
        throw error;
      }
    }

    // Generate temporary password
    const tempPassword = generateTemporaryPassword();

    // Create user in Cognito
    await cognitoClient.send(new AdminCreateUserCommand({
      UserPoolId: process.env.COGNITO_USER_POOL_ID!,
      Username: input.email,
      TemporaryPassword: tempPassword,
      UserAttributes: [
        { Name: 'email', Value: input.email },
        { Name: 'name', Value: input.name },
        { Name: 'custom:instituteId', Value: input.instituteId },
        { Name: 'custom:userRole', Value: input.role },
        { Name: 'email_verified', Value: 'true' },
      ],
      MessageAction: 'SUPPRESS', // Don't send welcome email
    }));

    // Create user record in DynamoDB
    const userId = uuidv4();
    const now = new Date().toISOString();

    await docClient.send(new PutCommand({
      TableName: USERS_TABLE,
      Item: {
        userId,
        email: input.email.toLowerCase(),
        name: input.name,
        role: input.role,
        instituteId: input.instituteId,
        cognitoSub: userId,
        status: 'PENDING', // User needs to change password
        createdAt: now,
        updatedAt: now,
        createdBy: user.userId,
      },
    }));

    logger.info('User created successfully', { requestId, userId, email: input.email });

    return createCreatedResponse({
      userId,
      email: input.email,
      temporaryPassword: tempPassword, // In production, send via secure channel
      message: 'User created successfully. Temporary password generated.',
    }, requestId);

  } catch (error) {
    logger.error('Create user failed', error as Error, { requestId });

    if (error instanceof ValidationError || error instanceof ConflictError || error instanceof AuthorizationError) {
      return createErrorResponse(error.code, error.message, error.statusCode, error.details, requestId);
    }

    return createErrorResponse('CREATE_USER_FAILED', 'Failed to create user', 500, undefined, requestId);
  }
};

function generateTemporaryPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  let password = '';
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export default handler;