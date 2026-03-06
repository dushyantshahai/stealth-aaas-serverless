import {
  SecretsManagerClient,
  GetSecretValueCommand,
  PutSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import { logger } from '@common/utils/logger';
import { ExternalServiceError } from '@common/utils/errors';

/**
 * Secrets Manager client singleton
 */
let secretsClient: SecretsManagerClient | null = null;

/**
 * Get or create Secrets Manager client
 */
export function getSecretsClient(): SecretsManagerClient {
  if (!secretsClient) {
    secretsClient = new SecretsManagerClient({
      region: process.env.AWS_REGION || 'us-east-1',
      maxAttempts: 3,
    });
  }
  return secretsClient;
}

/**
 * Get secret value
 */
export async function getSecret<T = string>(secretName: string): Promise<T> {
  try {
    const client = getSecretsClient();
    const command = new GetSecretValueCommand({
      SecretId: secretName,
    });

    const result = await client.send(command);

    if (result.SecretString) {
      return JSON.parse(result.SecretString) as T;
    }

    throw new Error('Secret value is binary, not supported');
  } catch (error) {
    logger.error('Failed to get secret', error as Error, { secretName });
    throw new ExternalServiceError('SecretsManager', 'Failed to get secret');
  }
}

/**
 * Put secret value
 */
export async function putSecret(
  secretName: string,
  secretValue: unknown
): Promise<void> {
  try {
    const client = getSecretsClient();
    const command = new PutSecretValueCommand({
      SecretId: secretName,
      SecretString: JSON.stringify(secretValue),
    });

    await client.send(command);
    logger.info('Secret updated', { secretName });
  } catch (error) {
    logger.error('Failed to put secret', error as Error, { secretName });
    throw new ExternalServiceError('SecretsManager', 'Failed to put secret');
  }
}

/**
 * Get JWT secret from Secrets Manager
 */
export async function getJwtSecret(): Promise<string> {
  const secretName = `stealth-aaas/${process.env.STAGE || 'dev'}/jwt-secret`;
  return getSecret<string>(secretName);
}

/**
 * Get Cognito credentials from Secrets Manager
 */
export async function getCognitoCredentials(): Promise<{
  userPoolId: string;
  clientId: string;
}> {
  const secretName = `stealth-aaas/${process.env.STAGE || 'dev'}/cognito`;
  return getSecret<{ userPoolId: string; clientId: string }>(secretName);
}

export default {
  getSecretsClient,
  getSecret,
  putSecret,
  getJwtSecret,
  getCognitoCredentials,
};
