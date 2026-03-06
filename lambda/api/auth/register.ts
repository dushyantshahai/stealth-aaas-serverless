import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { CognitoIdentityProviderClient, SignUpCommand, AdminGetUserCommand } from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { getLogger } from '/opt/nodejs/utils/logger';
import { ValidationError, ConflictError, ExternalServiceError } from '/opt/nodejs/utils/errors';
import { createSuccessResponse, createErrorResponse } from '/opt/nodejs/utils/response';
import { validateBody } from '/opt/nodejs/utils/validation';
import { z } from 'zod';

// Validation schema
const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required'),
  role: z.enum(['Admin', 'Professor', 'Student'], {
    errorMap: () => ({ message: 'Invalid role. Must be Admin, Professor, or Student' }),
  }),
  instituteId: z.string().min(1, 'Institute ID is required'),
});

const logger = getLogger('auth-register');

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

interface RegisterInput {
  email: string;
  password: string;
  name: string;
  role: 'Admin' | 'Professor' | 'Student';
  instituteId: string;
}

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const requestId = context.requestId;
  logger.info('User registration request', { requestId });

  try {
    // Validate input
    const input: RegisterInput = validateBody(registerSchema, event);

    // Check if user already exists
    const existingUser = await cognitoClient.send(new AdminGetUserCommand({
      UserPoolId: process.env.COGNITO_USER_POOL_ID!,
      Username: input.email,
    }));

    if (existingUser.User) {
      throw new ConflictError('User with this email already exists');
    }

    // Create user in Cognito
    const signUpResult = await cognitoClient.send(new SignUpCommand({
      UserPoolId: process.env.COGNITO_USER_POOL_ID!,
      ClientId: process.env.COGNITO_CLIENT_ID!,
      Username: input.email,
      Password: input.password,
      UserAttributes: [
        { Name: 'email', Value: input.email },
        { Name: 'name', Value: input.name },
        { Name: 'custom:instituteId', Value: input.instituteId },
        { Name: 'custom:userRole', Value: input.role },
        { Name: 'email_verified', Value: 'true' },
      ],
    }));

    // Create user record in DynamoDB
    const userId = signUpResult.UserSub!;
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
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      },
    }));

    logger.info('User registered successfully', { requestId, userId, email: input.email });

    return createSuccessResponse({
      userId,
      email: input.email,
      message: 'User registered successfully. Please verify your email.',
    }, 201, requestId);

  } catch (error) {
    logger.error('Registration failed', error as Error, { requestId });

    if (error instanceof ValidationError || error instanceof ConflictError) {
      return createErrorResponse(error.code, error.message, error.statusCode, error.details, requestId);
    }

    return createErrorResponse('REGISTRATION_FAILED', 'Failed to register user', 500, undefined, requestId);
  }
};

export default handler;