import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelWithResponseStreamCommand,
} from '@aws-sdk/client-bedrock-runtime';
import { logger } from '../utils/logger';
import { ExternalServiceError } from '../utils/errors';

/**
 * Bedrock client singleton
 */
let bedrockClient: BedrockRuntimeClient | null = null;

/**
 * Get or create Bedrock client
 */
export function getBedrockClient(): BedrockRuntimeClient {
  if (!bedrockClient) {
    bedrockClient = new BedrockRuntimeClient({
      region: process.env.AWS_REGION || 'us-east-1',
      maxAttempts: 3,
    });
  }
  return bedrockClient;
}

/**
 * Claude 3.5 Sonnet model ID
 */
export const CLAUDE_3_5_SONNET = 'anthropic.claude-3-5-sonnet-20241022-v2:0';

/**
 * Claude 3 Haiku model ID
 */
export const CLAUDE_3_HAIKU = 'anthropic.claude-3-haiku-20240307-v1:0';

/**
 * Amazon Nova model ID
 */
export const NOVA_LITE = 'amazon.nova-lite-v1:0';
export const NOVA_MICRO = 'amazon.nova-micro-v1:0';

/**
 * Invoke Claude model for text generation
 */
export async function invokeClaude(
  prompt: string,
  modelId: string = CLAUDE_3_5_SONNET,
  maxTokens: number = 4096,
  temperature: number = 0.7
): Promise<string> {
  try {
    const client = getBedrockClient();

    const command = new InvokeModelCommand({
      modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: maxTokens,
        temperature,
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: prompt }],
          },
        ],
      }),
    });

    const response = await client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    if (responseBody.error) {
      throw new Error(responseBody.error.message);
    }

    return responseBody.content[0].text;
  } catch (error) {
    logger.error('Bedrock invokeClaude failed', error as Error, { modelId });
    throw new ExternalServiceError('Bedrock', 'Failed to generate text');
  }
}

/**
 * Invoke Amazon Nova model for text generation
 */
export async function invokeNova(
  prompt: string,
  modelId: string = NOVA_LITE,
  maxTokens: number = 4096,
  temperature: number = 0.7
): Promise<string> {
  try {
    const client = getBedrockClient();

    const command = new InvokeModelCommand({
      modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        inferenceConfig: {
          maxNewTokens: maxTokens,
          temperature,
        },
        textPrompt: prompt,
      }),
    });

    const response = await client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    if (responseBody.error) {
      throw new Error(responseBody.error.message);
    }

    return responseBody.output?.text || '';
  } catch (error) {
    logger.error('Bedrock invokeNova failed', error as Error, { modelId });
    throw new ExternalServiceError('Bedrock', 'Failed to generate text');
  }
}

/**
 * Generate embeddings using Amazon Titan
 */
export async function generateEmbeddings(
  text: string,
  modelId: string = 'amazon.titan-embed-text-v2:0'
): Promise<number[]> {
  try {
    const client = getBedrockClient();

    const command = new InvokeModelCommand({
      modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        inputText: text,
        dimensions: 1024,
        normalize: true,
      }),
    });

    const response = await client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    if (responseBody.error) {
      throw new Error(responseBody.error.message);
    }

    return responseBody.embedding;
  } catch (error) {
    logger.error('Bedrock generateEmbeddings failed', error as Error, { modelId });
    throw new ExternalServiceError('Bedrock', 'Failed to generate embeddings');
  }
}

/**
 * Generate MCQ questions using Claude
 */
export async function generateMCQ(
  content: string,
  numQuestions: number = 10,
  difficulty: 'Easy' | 'Medium' | 'Hard' = 'Medium'
): Promise<string> {
  const prompt = `Based on the following content, generate ${numQuestions} multiple choice questions at a ${difficulty} difficulty level.

Content:
${content}

For each question, provide:
1. The question text
2. Four options (A, B, C, D)
3. The correct answer
4. A brief explanation

Format the output as a JSON array with this structure:
[
  {
    "question": "Question text",
    "options": ["A: Option 1", "B: Option 2", "C: Option 3", "D: Option 4"],
    "correctAnswer": "A",
    "explanation": "Explanation of the correct answer"
  }
]`;

  return invokeClaude(prompt, CLAUDE_3_5_SONNET, 8192, 0.5);
}

/**
 * Generate summary using Claude
 */
export async function generateSummary(
  content: string,
  maxLength: number = 500
): Promise<string> {
  const prompt = `Please provide a concise summary of the following content in ${maxLength} words or less.

Content:
${content}

Summary:`;

  return invokeClaude(prompt, CLAUDE_3_5_SONNET, maxLength * 4, 0.3);
}

/**
 * Generate TOC from book content
 */
export async function generateTOC(
  bookContent: string,
  numChapters: number = 10
): Promise<string> {
  const prompt = `Analyze the following book content and generate a table of contents with ${numChapters} chapters.

For each chapter, provide:
1. Chapter number
2. Chapter title
3. Brief description (2-3 sentences)
4. Estimated page range

Format the output as a JSON array:
[
  {
    "chapterNumber": 1,
    "title": "Chapter Title",
    "description": "Chapter description",
    "pageStart": 1,
    "pageEnd": 15
  }
]

Book content:
${bookContent.slice(0, 10000)}`;

  return invokeClaude(prompt, CLAUDE_3_5_SONNET, 4096, 0.3);
}

export default {
  getBedrockClient,
  invokeClaude,
  invokeNova,
  generateEmbeddings,
  generateMCQ,
  generateSummary,
  generateTOC,
  CLAUDE_3_5_SONNET,
  CLAUDE_3_HAIKU,
  NOVA_LITE,
  NOVA_MICRO,
};