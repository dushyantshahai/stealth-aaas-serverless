/**
 * Bedrock Knowledge Base Client
 * 
 * Provides utilities for querying the Bedrock Knowledge Base
 * to retrieve relevant document chunks for RAG (Retrieval-Augmented Generation)
 */

import { BedrockAgentRuntimeClient, RetrieveCommand } from '@aws-sdk/client-bedrock-agent-runtime';
import { getLogger } from '../utils/logger';

const logger = getLogger('knowledge-base-client');

interface KnowledgeBaseChunk {
  content: string;
  source: string;
  metadata?: Record<string, any>;
  score?: number;
}

interface KnowledgeBaseQueryResult {
  chunks: KnowledgeBaseChunk[];
  totalChunks: number;
  queryTime: number;
}

interface KnowledgeBaseQueryOptions {
  maxResults?: number;
  retrievalFilter?: Record<string, any>;
}

/**
 * Initialize Bedrock Agent Runtime client for Knowledge Base queries
 */
function getBedrockClient(): BedrockAgentRuntimeClient {
  return new BedrockAgentRuntimeClient({
    region: process.env.AWS_REGION || 'us-east-1'
  });
}

/**
 * Query the Bedrock Knowledge Base for relevant chunks
 * 
 * @param knowledgeBaseId - The Knowledge Base ID
 * @param query - The search query text
 * @param options - Query options (maxResults, retrievalFilter)
 * @returns Promise with retrieved chunks and metadata
 */
export async function queryKnowledgeBase(
  knowledgeBaseId: string,
  query: string,
  options: KnowledgeBaseQueryOptions = {}
): Promise<KnowledgeBaseQueryResult> {
  const startTime = Date.now();
  const maxResults = options.maxResults || 5;

  logger.info('Querying Knowledge Base', {
    knowledgeBaseId,
    queryLength: query.length,
    maxResults
  });

  try {
    const client = getBedrockClient();

    const command = new RetrieveCommand({
      knowledgeBaseId,
      retrievalConfiguration: {
        vectorSearchConfiguration: {
          numberOfResults: maxResults,
          overrideSearchType: 'HYBRID' // Use hybrid search (vector + keyword)
        }
      },
      text: query,
      retrievalFilter: options.retrievalFilter
    });

    const response = await client.send(command);

    // Parse and format the response
    const chunks: KnowledgeBaseChunk[] = [];

    if (response.retrievalResults && response.retrievalResults.length > 0) {
      for (const result of response.retrievalResults) {
        chunks.push({
          content: result.content?.text || '',
          source: result.location?.s3Location?.uri || 'unknown',
          metadata: result.metadata || {},
          score: result.score
        });
      }
    }

    const queryTime = Date.now() - startTime;

    logger.info('Knowledge Base query completed', {
      knowledgeBaseId,
      chunksRetrieved: chunks.length,
      queryTime
    });

    return {
      chunks,
      totalChunks: chunks.length,
      queryTime
    };
  } catch (error) {
    logger.error('Knowledge Base query failed', error as Error, {
      knowledgeBaseId,
      query: query.substring(0, 100)
    });

    throw new Error(
      `Failed to query Knowledge Base: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Query Knowledge Base with retry logic
 * 
 * @param knowledgeBaseId - The Knowledge Base ID
 * @param query - The search query text
 * @param maxRetries - Maximum number of retries (default: 3)
 * @param options - Query options
 * @returns Promise with retrieved chunks
 */
export async function queryKnowledgeBaseWithRetry(
  knowledgeBaseId: string,
  query: string,
  maxRetries: number = 3,
  options: KnowledgeBaseQueryOptions = {}
): Promise<KnowledgeBaseQueryResult> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info('Knowledge Base query attempt', {
        knowledgeBaseId,
        attempt,
        maxRetries
      });

      return await queryKnowledgeBase(knowledgeBaseId, query, options);
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        const delayMs = Math.pow(2, attempt - 1) * 1000;
        logger.warn('Knowledge Base query failed, retrying', {
          knowledgeBaseId,
          attempt,
          delayMs,
          error: lastError.message
        });

        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  logger.error('Knowledge Base query failed after retries', lastError as Error, {
    knowledgeBaseId,
    maxRetries
  });

  throw lastError || new Error('Knowledge Base query failed');
}

/**
 * Format Knowledge Base chunks for use in prompts
 * 
 * @param chunks - Array of Knowledge Base chunks
 * @param maxChunks - Maximum number of chunks to include (default: 5)
 * @returns Formatted string for use in prompts
 */
export function formatChunksForPrompt(
  chunks: KnowledgeBaseChunk[],
  maxChunks: number = 5
): string {
  const selectedChunks = chunks.slice(0, maxChunks);

  if (selectedChunks.length === 0) {
    return 'No relevant context found.';
  }

  const formattedChunks = selectedChunks
    .map((chunk, index) => {
      const source = chunk.source ? ` (Source: ${chunk.source})` : '';
      const score = chunk.score ? ` [Relevance: ${(chunk.score * 100).toFixed(1)}%]` : '';
      return `[Chunk ${index + 1}]${score}\n${chunk.content}${source}`;
    })
    .join('\n\n');

  return `Context from Knowledge Base:\n\n${formattedChunks}`;
}

/**
 * Extract metadata from Knowledge Base chunks
 * 
 * @param chunks - Array of Knowledge Base chunks
 * @returns Extracted metadata
 */
export function extractMetadata(chunks: KnowledgeBaseChunk[]): Record<string, any> {
  const metadata: Record<string, any> = {
    sources: new Set<string>(),
    totalChunks: chunks.length,
    averageScore: 0,
    chunkScores: []
  };

  let totalScore = 0;

  for (const chunk of chunks) {
    if (chunk.source) {
      metadata.sources.add(chunk.source);
    }
    if (chunk.score) {
      totalScore += chunk.score;
      metadata.chunkScores.push(chunk.score);
    }
  }

  metadata.sources = Array.from(metadata.sources);
  metadata.averageScore = chunks.length > 0 ? totalScore / chunks.length : 0;

  return metadata;
}

/**
 * Validate Knowledge Base ID format
 * 
 * @param knowledgeBaseId - The Knowledge Base ID to validate
 * @returns true if valid, false otherwise
 */
export function isValidKnowledgeBaseId(knowledgeBaseId: string): boolean {
  // Knowledge Base IDs typically follow pattern: [A-Z0-9]{10}
  return /^[A-Z0-9]{10}$/.test(knowledgeBaseId);
}

export default {
  queryKnowledgeBase,
  queryKnowledgeBaseWithRetry,
  formatChunksForPrompt,
  extractMetadata,
  isValidKnowledgeBaseId
};
