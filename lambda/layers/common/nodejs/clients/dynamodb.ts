import {
  DynamoDBClient,
  ResourceNotFoundException,
} from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
  QueryCommandInput,
  PutCommandInput,
  GetCommandInput,
  UpdateCommandInput,
  DeleteCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { logger } from '@common/utils/logger';
import { DatabaseError } from '@common/utils/errors';

/**
 * DynamoDB client singleton
 */
let dynamoClient: DynamoDBClient | null = null;
let docClient: DynamoDBDocumentClient | null = null;

/**
 * Get or create DynamoDB client
 */
export function getDynamoClient(): DynamoDBClient {
  if (!dynamoClient) {
    dynamoClient = new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-east-1',
      maxAttempts: 3,
      retryMode: 'adaptive',
    });
  }
  return dynamoClient;
}

/**
 * Get or create Document client
 */
export function getDocClient(): DynamoDBDocumentClient {
  if (!docClient) {
    docClient = DynamoDBDocumentClient.from(getDynamoClient(), {
      marshallOptions: {
        removeUndefinedValues: true,
        convertClassInstanceToMap: true,
      },
    });
  }
  return docClient;
}

/**
 * Get item from DynamoDB
 */
export async function getItem<T>(
  tableName: string,
  key: Record<string, unknown>
): Promise<T | null> {
  try {
    const client = getDocClient();
    const command = new GetCommand({
      TableName: tableName,
      Key: key,
    } as GetCommandInput);

    const result = await client.send(command);
    return (result.Item as T) || null;
  } catch (error) {
    logger.error('DynamoDB getItem failed', error as Error, { tableName, key });
    throw new DatabaseError('Failed to retrieve item from database');
  }
}

/**
 * Put item to DynamoDB
 */
export async function putItem<T>(
  tableName: string,
  item: T
): Promise<void> {
  try {
    const client = getDocClient();
    const command = new PutCommand({
      TableName: tableName,
      Item: item,
    } as PutCommandInput);

    await client.send(command);
  } catch (error) {
    logger.error('DynamoDB putItem failed', error as Error, { tableName });
    throw new DatabaseError('Failed to save item to database');
  }
}

/**
 * Update item in DynamoDB
 */
export async function updateItem<T>(
  tableName: string,
  key: Record<string, unknown>,
  updateExpression: string,
  expressionAttributeValues: Record<string, unknown>,
  expressionAttributeNames?: Record<string, string>
): Promise<T> {
  try {
    const client = getDocClient();
    const command = new UpdateCommand({
      TableName: tableName,
      Key: key,
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: expressionAttributeNames,
      ReturnValues: 'ALL_NEW',
    } as UpdateCommandInput);

    const result = await client.send(command);
    return result.Attributes as T;
  } catch (error) {
    logger.error('DynamoDB updateItem failed', error as Error, {
      tableName,
      key,
    });
    throw new DatabaseError('Failed to update item in database');
  }
}

/**
 * Delete item from DynamoDB
 */
export async function deleteItem(
  tableName: string,
  key: Record<string, unknown>
): Promise<void> {
  try {
    const client = getDocClient();
    const command = new DeleteCommand({
      TableName: tableName,
      Key: key,
    } as DeleteCommandInput);

    await client.send(command);
  } catch (error) {
    logger.error('DynamoDB deleteItem failed', error as Error, { tableName, key });
    throw new DatabaseError('Failed to delete item from database');
  }
}

/**
 * Query items from DynamoDB using GSI or table
 */
export async function queryItems<T>(
  tableName: string,
  keyConditionExpression: string,
  expressionAttributeValues: Record<string, unknown>,
  indexName?: string
): Promise<T[]> {
  try {
    const client = getDocClient();
    const command = new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: keyConditionExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      IndexName: indexName,
    } as QueryCommandInput);

    const result = await client.send(command);
    return (result.Items as T[]) || [];
  } catch (error) {
    logger.error('DynamoDB queryItems failed', error as Error, {
      tableName,
      indexName,
    });
    throw new DatabaseError('Failed to query items from database');
  }
}

/**
 * Scan table (use sparingly - expensive operation)
 */
export async function scanItems<T>(
  tableName: string,
  filterExpression?: string,
  expressionAttributeValues?: Record<string, unknown>
): Promise<T[]> {
  try {
    const client = getDocClient();
    const command = new ScanCommand({
      TableName: tableName,
      FilterExpression: filterExpression,
      ExpressionAttributeValues: expressionAttributeValues,
    } as QueryCommandInput);

    const result = await client.send(command);
    return (result.Items as T[]) || [];
  } catch (error) {
    logger.error('DynamoDB scanItems failed', error as Error, { tableName });
    throw new DatabaseError('Failed to scan items from database');
  }
}

/**
 * Check if item exists
 */
export async function itemExists(
  tableName: string,
  key: Record<string, unknown>
): Promise<boolean> {
  try {
    const item = await getItem(tableName, key);
    return item !== null;
  } catch (error) {
    return false;
  }
}

export default {
  getDynamoClient,
  getDocClient,
  getItem,
  putItem,
  updateItem,
  deleteItem,
  queryItems,
  scanItems,
  itemExists,
};
