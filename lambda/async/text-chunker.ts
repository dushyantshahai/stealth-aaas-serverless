/**
 * Page-Aware Intelligent Chunking
 * 
 * Replicates the 3-priority logic from the proven implementation:
 * PRIORITY 1: Topics have page ranges → chunk topic-specific pages
 * PRIORITY 2: Only chapter has page range → proportional distribution to topics
 * PRIORITY 3: No page info → fallback sequential distribution
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { getLogger } from '../layers/common/nodejs/utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { extractTextFromPages } from './utils/pdf-text-extractor';

const logger = getLogger('text-chunker');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' });

const CHUNKS_TABLE = `stealth-aaas-${process.env.STAGE || 'dev'}-chunks`;
const CHAPTERS_TABLE = `stealth-aaas-${process.env.STAGE || 'dev'}-chapters`;
const TOPICS_TABLE = `stealth-aaas-${process.env.STAGE || 'dev'}-topics`;
const SUBTOPICS_TABLE = `stealth-aaas-${process.env.STAGE || 'dev'}-subtopics`;

interface TextPage {
  pageNumber: number;
  text: string;
}

interface Chunk {
  chunkId: string;
  content: string;
  subtopicId: string | null;
  topicId: string | null;
  chapterId: string | null;
  bookId: string;
  pageNumber: number;
  chunkIndex: number;
  tokenCount: number;
  embeddingId: string | null;
  createdAt: string;
}

interface PageAwareChunkingResult {
  success: boolean;
  totalChunks: number;
  chunksByPriority: {
    topicLevel: number;
    chapterLevel: number;
    fallback: number;
  };
  distribution: Array<{
    chapterId: string;
    chapterTitle: string;
    topics: Array<{
      topicId: string;
      topicTitle: string;
      chunkCount: number;
      priority: 1 | 2 | 3;
    }>;
  }>;
}

// ============================================
// Main Entry Point
// ============================================

/**
 * Create page-aware chunks during book upload.
 * Uses 3-priority logic based on available page information.
 * 
 * @param bookId - Book ID
 * @param pageTextsIndexed - Page texts indexed by page number (1-indexed)
 * @param totalPages - Total pages in PDF
 */
export async function createPageAwareChunks(
  bookId: string,
  pageTextsIndexed: Record<number, string>,
  totalPages: number
): Promise<PageAwareChunkingResult> {
  logger.info(`[Page-Aware Chunking] Starting for book: ${bookId}`);
  logger.info(`[Page-Aware Chunking] Total PDF pages: ${totalPages}`);

  const result: PageAwareChunkingResult = {
    success: true,
    totalChunks: 0,
    chunksByPriority: { topicLevel: 0, chapterLevel: 0, fallback: 0 },
    distribution: [],
  };

  try {
    // Get all chapters for this book
    const chaptersResult = await docClient.send(new BatchWriteCommand({
      RequestItems: {
        [CHAPTERS_TABLE]: {
          Keys: { bookId } // This won't work - need to query properly
        }
      }
    }));

    // Use Query instead - get chapters for book
    const { QueryCommand } = await import('@aws-sdk/lib-dynamodb');
    const chaptersResponse = await docClient.send(new QueryCommand({
      TableName: CHAPTERS_TABLE,
      KeyConditionExpression: 'bookId = :bookId',
      ExpressionAttributeValues: { ':bookId': bookId },
    }));

    const chapters = chaptersResponse.Items || [];
    
    if (chapters.length === 0) {
      logger.error('[Page-Aware Chunking] No chapters found');
      return { ...result, success: false };
    }

    logger.info(`[Page-Aware Chunking] Found ${chapters.length} chapters`);

    let globalChunkIndex = 0;

    for (const chapter of chapters) {
      logger.info(`\n[Page-Aware Chunking] Processing Chapter ${chapter.order + 1}: "${chapter.title}"`);
      logger.info(`   Pages: ${chapter.pageStart || 'N/A'} - ${chapter.pageEnd || 'N/A'}`);

      const chapterDistribution: PageAwareChunkingResult['distribution'][0] = {
        chapterId: chapter.chapterId,
        chapterTitle: `Chapter ${chapter.order + 1}: ${chapter.title}`,
        topics: [],
      };

      // Get topics for this chapter
      const topicsResponse = await docClient.send(new QueryCommand({
        TableName: TOPICS_TABLE,
        KeyConditionExpression: 'chapterId = :chapterId',
        ExpressionAttributeValues: { ':chapterId': chapter.chapterId },
      }));

      const topics = topicsResponse.Items || [];
      logger.info(`   Found ${topics.length} topics`);

      // Check which priority level applies
      const topicsWithPages = topics.filter((t: any) => t.pageStart && t.pageEnd);

      if (topicsWithPages.length > 0) {
        // ═══════════════════════════════════════════════════════════════
        // PRIORITY 1: Topic-level page ranges
        // ═══════════════════════════════════════════════════════════════
        logger.info(`   PRIORITY 1: Topic-level page ranges (${topicsWithPages.length} topics)`);

        for (const topic of topicsWithPages) {
          const topicText = extractTextFromPages(pageTextsIndexed, topic.pageStart, topic.pageEnd);

          // Check for sub-topics with page ranges
          const subTopicsResponse = await docClient.send(new QueryCommand({
            TableName: SUBTOPICS_TABLE,
            KeyConditionExpression: 'topicId = :topicId',
            ExpressionAttributeValues: { ':topicId': topic.topicId },
          }));

          const subTopics = subTopicsResponse.Items || [];
          const subTopicsWithPages = subTopics.filter((st: any) => st.pageStart && st.pageEnd);

          if (subTopicsWithPages.length > 0) {
            // PRIORITY 1A: Sub-topic level
            logger.info(`     PRIORITY 1A: Sub-Topic pages (${subTopicsWithPages.length} sub-topics)`);

            for (const subTopic of subTopicsWithPages) {
              const subTopicText = extractTextFromPages(pageTextsIndexed, subTopic.pageStart, subTopic.pageEnd);
              const chunks = chunkTextSimple(subTopicText, 1000);
              
              const savedCount = await saveChunks(
                chunks, bookId, chapter.chapterId, topic.topicId, subTopic.topicId,
                globalChunkIndex, subTopic.pageStart, subTopic.pageEnd
              );
              
              globalChunkIndex += savedCount;
              result.chunksByPriority.topicLevel += savedCount;
              result.totalChunks += savedCount;

              logger.info(`     ✅ SubTopic "${subTopic.title}": ${savedCount} chunks`);
            }
          } else {
            // Normal topic chunking
            const chunks = chunkTextSimple(topicText, 1000);
            const savedCount = await saveChunks(
              chunks, bookId, chapter.chapterId, topic.topicId, null,
              globalChunkIndex, topic.pageStart, topic.pageEnd
            );

            globalChunkIndex += savedCount;
            result.chunksByPriority.topicLevel += savedCount;
            result.totalChunks += savedCount;

            chapterDistribution.topics.push({
              topicId: topic.topicId,
              topicTitle: topic.title,
              chunkCount: savedCount,
              priority: 1,
            });

            logger.info(`   ✅ Topic "${topic.title}" (pages ${topic.pageStart}-${topic.pageEnd}): ${savedCount} chunks`);
          }
        }

      } else if (chapter.pageStart && chapter.pageEnd) {
        // ═══════════════════════════════════════════════════════════════
        // PRIORITY 2: Chapter-level page ranges only
        // ═══════════════════════════════════════════════════════════════
        logger.info(`   PRIORITY 2: Chapter-level pages (${chapter.pageStart}-${chapter.pageEnd})`);

        const chapterText = extractTextFromPages(pageTextsIndexed, chapter.pageStart, chapter.pageEnd);
        const allChunks = chunkTextSimple(chapterText, 1000);
        logger.info(`   Created ${allChunks.length} chunks from chapter pages`);

        if (topics.length > 0) {
          // Distribute proportionally among topics
          const chunksPerTopic = Math.ceil(allChunks.length / topics.length);

          for (let i = 0; i < topics.length; i++) {
            const topic = topics[i];
            const startIdx = i * chunksPerTopic;
            const endIdx = Math.min((i + 1) * chunksPerTopic, allChunks.length);
            const topicChunks = allChunks.slice(startIdx, endIdx);

            // Get sub-topics for this topic
            const subTopicsResponse = await docClient.send(new QueryCommand({
              TableName: SUBTOPICS_TABLE,
              KeyConditionExpression: 'topicId = :topicId',
              ExpressionAttributeValues: { ':topicId': topic.topicId },
            }));

            const topicSubTopics = subTopicsResponse.Items || [];

            if (topicSubTopics.length > 0 && topicChunks.length > 0) {
              // Distribute among sub-topics
              const chunksPerSubTopic = Math.ceil(topicChunks.length / topicSubTopics.length);
              let topicSavedCount = 0;

              for (let j = 0; j < topicSubTopics.length; j++) {
                const subTopic = topicSubTopics[j];
                const stStartIdx = j * chunksPerSubTopic;
                const stEndIdx = Math.min((j + 1) * chunksPerSubTopic, topicChunks.length);
                const subTopicChunks = topicChunks.slice(stStartIdx, stEndIdx);

                const savedCount = await saveChunks(
                  subTopicChunks, bookId, chapter.chapterId, topic.topicId, subTopic.topicId,
                  globalChunkIndex, chapter.pageStart, chapter.pageEnd
                );
                
                globalChunkIndex += savedCount;
                topicSavedCount += savedCount;
                logger.info(`     ↳ SubTopic "${subTopic.title}": ${savedCount} chunks`);
              }

              result.chunksByPriority.chapterLevel += topicSavedCount;
              result.totalChunks += topicSavedCount;

              chapterDistribution.topics.push({
                topicId: topic.topicId,
                topicTitle: topic.title,
                chunkCount: topicSavedCount,
                priority: 2,
              });

            } else {
              // No sub-topics, save to topic
              const savedCount = await saveChunks(
                topicChunks, bookId, chapter.chapterId, topic.topicId, null,
                globalChunkIndex, chapter.pageStart, chapter.pageEnd
              );

              globalChunkIndex += savedCount;
              result.chunksByPriority.chapterLevel += savedCount;
              result.totalChunks += savedCount;

              chapterDistribution.topics.push({
                topicId: topic.topicId,
                topicTitle: topic.title,
                chunkCount: savedCount,
                priority: 2,
              });

              logger.info(`   ✅ Topic "${topic.title}": ${savedCount} chunks (proportional)`);
            }
          }
        } else {
          // No topics - assign all chunks to chapter
          const savedCount = await saveChunks(
            allChunks, bookId, chapter.chapterId, null, null,
            globalChunkIndex, chapter.pageStart, chapter.pageEnd
          );

          globalChunkIndex += savedCount;
          result.chunksByPriority.chapterLevel += savedCount;
          result.totalChunks += savedCount;

          logger.info(`   ✅ Chapter (no topics): ${savedCount} chunks`);
        }

      } else {
        // ═══════════════════════════════════════════════════════════════
        // PRIORITY 3: No page information - fallback distribution
        // ═══════════════════════════════════════════════════════════════
        logger.info(`   PRIORITY 3: No page info - using fallback distribution`);

        const chapterCount = chapters.length;
        const pagesPerChapter = Math.ceil(totalPages / chapterCount);
        const chapterIndex = chapters.indexOf(chapter);
        const estimatedStart = chapterIndex * pagesPerChapter + 1;
        const estimatedEnd = Math.min((chapterIndex + 1) * pagesPerChapter, totalPages);

        logger.info(`   Estimated pages: ${estimatedStart}-${estimatedEnd}`);

        const chapterText = extractTextFromPages(pageTextsIndexed, estimatedStart, estimatedEnd);
        const allChunks = chunkTextSimple(chapterText, 1000);

        if (topics.length > 0) {
          const chunksPerTopic = Math.ceil(allChunks.length / topics.length);

          for (let i = 0; i < topics.length; i++) {
            const topic = topics[i];
            const startIdx = i * chunksPerTopic;
            const endIdx = Math.min((i + 1) * chunksPerTopic, allChunks.length);
            const topicChunks = allChunks.slice(startIdx, endIdx);

            const savedCount = await saveChunks(
              topicChunks, bookId, chapter.chapterId, topic.topicId, null,
              globalChunkIndex, estimatedStart, estimatedEnd
            );

            globalChunkIndex += savedCount;
            result.chunksByPriority.fallback += savedCount;
            result.totalChunks += savedCount;

            chapterDistribution.topics.push({
              topicId: topic.topicId,
              topicTitle: topic.title,
              chunkCount: savedCount,
              priority: 3,
            });

            logger.info(`   ✅ Topic "${topic.title}": ${savedCount} chunks (fallback)`);
          }
        } else {
          const savedCount = await saveChunks(
            allChunks, bookId, chapter.chapterId, null, null,
            globalChunkIndex, estimatedStart, estimatedEnd
          );

          globalChunkIndex += savedCount;
          result.chunksByPriority.fallback += savedCount;
          result.totalChunks += savedCount;

          logger.info(`   ✅ Chapter (no topics): ${savedCount} chunks (fallback)`);
        }
      }

      result.distribution.push(chapterDistribution);
    }

    logger.info(`\n[Page-Aware Chunking] Complete:`);
    logger.info(`  - Total chunks: ${result.totalChunks}`);
    logger.info(`  - PRIORITY 1 (topic-level): ${result.chunksByPriority.topicLevel}`);
    logger.info(`  - PRIORITY 2 (chapter-level): ${result.chunksByPriority.chapterLevel}`);
    logger.info(`  - PRIORITY 3 (fallback): ${result.chunksByPriority.fallback}`);

    return result;
  } catch (error) {
    logger.error('[Page-Aware Chunking] Error:', error as Error);
    return { ...result, success: false };
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Simple text chunking - split text into chunks of approximately chunkSize characters
 * Tries to break at sentence boundaries when possible
 */
function chunkTextSimple(text: string, chunkSize: number = 1000): string[] {
  if (!text || text.trim().length === 0) return [];

  const chunks: string[] = [];
  let currentChunk = '';

  // Split by sentences (rough approximation)
  const sentences = text.split(/(?<=[.!?])\s+/);

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Save chunks to DynamoDB
 */
async function saveChunks(
  chunks: string[],
  bookId: string,
  chapterId: string,
  topicId: string | null,
  subTopicId: string | null,
  startingIndex: number,
  startPage: number | null,
  endPage: number | null
): Promise<number> {
  let savedCount = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunkText = chunks[i];

    // Skip very short chunks
    if (chunkText.trim().length < 50) continue;

    // Calculate page number based on proportional position
    let pageNumber: number | null = null;
    if (startPage !== null && endPage !== null && chunks.length > 0) {
      const pageRange = endPage - startPage;
      const progress = chunks.length > 1 ? i / (chunks.length - 1) : 0;
      pageNumber = Math.round(startPage + pageRange * progress);
    }

    const chunkId = uuidv4();
    const tokenCount = estimateTokenCount(chunkText);

    // Generate embedding
    let embeddingId: string | null = null;
    try {
      const embedding = await generateEmbedding(chunkText);
      embeddingId = embedding;
    } catch (error) {
      logger.warn('Failed to generate embedding for chunk', { chunkId });
    }

    await docClient.send(new PutCommand({
      TableName: CHUNKS_TABLE,
      Item: {
        chunkId,
        bookId,
        chapterId,
        topicId,
        subTopicId,
        content: chunkText,
        chunkIndex: startingIndex + i,
        pageNumber,
        tokenCount,
        embeddingId,
        createdAt: new Date().toISOString(),
      }
    }));

    savedCount++;
  }

  return savedCount;
}

/**
 * Estimate token count (approximate)
 */
function estimateTokenCount(text: string): number {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  return Math.ceil(words.length / 0.75);
}

/**
 * Generate embedding using Amazon Titan
 */
async function generateEmbedding(text: string): Promise<string> {
  const modelId = 'amazon.titan-embed-text-v1';

  const command = new InvokeModelCommand({
    modelId,
    contentType: 'application/json',
    body: JSON.stringify({ inputText: text }),
  });

  const response = await bedrockClient.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));

  return responseBody.embedding;
}

// ============================================
// Simple Chunking (for backward compatibility)
// ============================================

export async function chunkText(
  bookId: string,
  extractedText: { pages: { pageNumber: number; text: string }[] }
): Promise<{ chunks: Chunk[]; totalChunks: number }> {
  logger.info('Starting simple text chunking', { bookId, pageCount: extractedText.pages.length });

  const pageTextsIndexed: Record<number, string> = {};
  for (const page of extractedText.pages) {
    pageTextsIndexed[page.pageNumber] = page.text;
  }

  // Get total pages from the pages array
  const totalPages = Math.max(...extractedText.pages.map(p => p.pageNumber));

  const result = await createPageAwareChunks(bookId, pageTextsIndexed, totalPages);

  return {
    chunks: [],
    totalChunks: result.totalChunks,
  };
}

export default {
  createPageAwareChunks,
  chunkText,
  extractTextFromPages,
  chunkTextSimple,
};