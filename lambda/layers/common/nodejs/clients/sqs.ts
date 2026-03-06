import {
  SQSClient,
  SendMessageCommand,
  SendMessageBatchCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  PurgeQueueCommand,
  GetQueueAttributesCommand,
} from '@aws-sdk/client-sqs';
import { SendMessageCommandInput, ReceiveMessageCommandInput } from '@aws-sdk/client-sqs';
import { logger } from '../utils/logger';
import { ExternalServiceError } from '../utils/errors';

/**
 * SQS client singleton
 */
let sqsClient: SQSClient | null = null;

/**
 * Get or create SQS client
 */
export function getSQSClient(): SQSClient {
  if (!sqsClient) {
    sqsClient = new SQSClient({
      region: process.env.AWS_REGION || 'us-east-1',
      maxAttempts: 3,
    });
  }
  return sqsClient;
}

/**
 * Send message to queue
 */
export async function sendMessage(
  queueUrl: string,
  messageBody: unknown,
  delaySeconds?: number,
  messageAttributes?: Record<string, { stringValue: string; dataType: string }>
): Promise<string> {
  try {
    const client = getSQSClient();
    const command = new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: typeof messageBody === 'string' ? messageBody : JSON.stringify(messageBody),
      DelaySeconds: delaySeconds,
      MessageAttributes: messageAttributes,
    } as SendMessageCommandInput);

    const result = await client.send(command);
    logger.info('Message sent to SQS', { queueUrl, messageId: result.MessageId });
    return result.MessageId || '';
  } catch (error) {
    logger.error('Failed to send message to SQS', error as Error, { queueUrl });
    throw new ExternalServiceError('SQS', 'Failed to send message');
  }
}

/**
 * Send batch messages to queue
 */
export async function sendMessageBatch(
  queueUrl: string,
  messages: Array<{
    id: string;
    body: unknown;
    delaySeconds?: number;
  }>
): Promise<{ successful: string[]; failed: Array<{ id: string; error: string }> }> {
  try {
    const client = getSQSClient();

    const entries = messages.map((msg) => ({
      Id: msg.id,
      MessageBody: typeof msg.body === 'string' ? msg.body : JSON.stringify(msg.body),
      DelaySeconds: msg.delaySeconds,
    }));

    const command = new SendMessageBatchCommand({
      QueueUrl: queueUrl,
      Entries: entries,
    });

    const result = await client.send(command);

    const successful = (result.Successful || []).map((r) => r.Id || '');
    const failed = (result.Failed || []).map((f) => ({
      id: f.Id || '',
      error: f.Message || 'Unknown error',
    }));

    logger.info('Batch messages sent to SQS', {
      queueUrl,
      successful: successful.length,
      failed: failed.length,
    });

    return { successful, failed };
  } catch (error) {
    logger.error('Failed to send batch messages to SQS', error as Error, { queueUrl });
    throw new ExternalServiceError('SQS', 'Failed to send batch messages');
  }
}

/**
 * Receive messages from queue
 */
export async function receiveMessages(
  queueUrl: string,
  maxMessages: number = 10,
  waitTimeSeconds: number = 20,
  visibilityTimeout?: number
): Promise<Array<{ body: string; receiptHandle: string; messageId: string }>> {
  try {
    const client = getSQSClient();
    const command = new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: maxMessages,
      WaitTimeSeconds: waitTimeSeconds,
      VisibilityTimeout: visibilityTimeout,
      MessageAttributeNames: ['All'],
    } as ReceiveMessageCommandInput);

    const result = await client.send(command);
    const messages = (result.Messages || []).map((msg) => ({
      body: msg.Body || '',
      receiptHandle: msg.ReceiptHandle || '',
      messageId: msg.MessageId || '',
    }));

    logger.info('Messages received from SQS', {
      queueUrl,
      count: messages.length,
    });

    return messages;
  } catch (error) {
    logger.error('Failed to receive messages from SQS', error as Error, { queueUrl });
    throw new ExternalServiceError('SQS', 'Failed to receive messages');
  }
}

/**
 * Delete message from queue
 */
export async function deleteMessage(
  queueUrl: string,
  receiptHandle: string
): Promise<void> {
  try {
    const client = getSQSClient();
    const command = new DeleteMessageCommand({
      QueueUrl: queueUrl,
      ReceiptHandle: receiptHandle,
    });

    await client.send(command);
    logger.info('Message deleted from SQS', { queueUrl });
  } catch (error) {
    logger.error('Failed to delete message from SQS', error as Error, { queueUrl });
    throw new ExternalServiceError('SQS', 'Failed to delete message');
  }
}

/**
 * Purge queue (delete all messages)
 */
export async function purgeQueue(queueUrl: string): Promise<void> {
  try {
    const client = getSQSClient();
    const command = new PurgeQueueCommand({
      QueueUrl: queueUrl,
    });

    await client.send(command);
    logger.info('Queue purged', { queueUrl });
  } catch (error) {
    logger.error('Failed to purge queue', error as Error, { queueUrl });
    throw new ExternalServiceError('SQS', 'Failed to purge queue');
  }
}

/**
 * Get queue attributes
 */
export async function getQueueAttributes(
  queueUrl: string,
  attributeNames: string[] = ['All']
): Promise<Record<string, string>> {
  try {
    const client = getSQSClient();
    const command = new GetQueueAttributesCommand({
      QueueUrl: queueUrl,
      AttributeNames: attributeNames,
    });

    const result = await client.send(command);
    return result.Attributes || {};
  } catch (error) {
    logger.error('Failed to get queue attributes', error as Error, { queueUrl });
    throw new ExternalServiceError('SQS', 'Failed to get queue attributes');
  }
}

/**
 * Get approximate message count
 */
export async function getApproximateMessageCount(queueUrl: string): Promise<number> {
  try {
    const attributes = await getQueueAttributes(queueUrl, ['ApproximateNumberOfMessages']);
    return parseInt(attributes['ApproximateNumberOfMessages'] || '0', 10);
  } catch (error) {
    return -1;
  }
}

export default {
  getSQSClient,
  sendMessage,
  sendMessageBatch,
  receiveMessages,
  deleteMessage,
  purgeQueue,
  getQueueAttributes,
  getApproximateMessageCount,
};
