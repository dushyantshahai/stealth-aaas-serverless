/**
 * Integration Tests for Knowledge Base
 * 
 * These tests verify the Knowledge Base query utility works with real Bedrock API
 * Run with: npm test -- knowledge-base-integration.test.ts
 * 
 * Note: Requires BEDROCK_KNOWLEDGE_BASE_ID environment variable
 */

import {
  queryKnowledgeBase,
  queryKnowledgeBaseWithRetry,
  formatChunksForPrompt,
  extractMetadata,
  isValidKnowledgeBaseId
} from '../../layers/common/nodejs/clients/knowledge-base';

// Skip these tests if Knowledge Base ID not configured
const KB_ID = process.env.BEDROCK_KNOWLEDGE_BASE_ID;
const SKIP_INTEGRATION = !KB_ID;

describe('Knowledge Base Integration Tests', () => {
  beforeAll(() => {
    if (SKIP_INTEGRATION) {
      console.log('⚠️  Skipping Knowledge Base integration tests');
      console.log('   Set BEDROCK_KNOWLEDGE_BASE_ID environment variable to run');
    }
  });

  describe.skipIf(SKIP_INTEGRATION)('Real Knowledge Base Queries', () => {
    it('should query Knowledge Base with real API', async () => {
      const query = 'What are the main topics covered in this document?';

      const result = await queryKnowledgeBase(KB_ID!, query, {
        maxResults: 5
      });

      expect(result).toBeDefined();
      expect(result.chunks).toBeDefined();
      expect(Array.isArray(result.chunks)).toBe(true);
      expect(result.totalChunks).toBeGreaterThanOrEqual(0);
      expect(result.queryTime).toBeGreaterThan(0);

      if (result.chunks.length > 0) {
        const chunk = result.chunks[0];
        expect(chunk.content).toBeDefined();
        expect(chunk.source).toBeDefined();
        expect(typeof chunk.score).toBe('number');
      }
    });

    it('should handle different query types', async () => {
      const queries = [
        'What is the introduction?',
        'Summarize the main concepts',
        'List the key topics',
        'What are the examples?'
      ];

      for (const query of queries) {
        const result = await queryKnowledgeBase(KB_ID!, query, {
          maxResults: 3
        });

        expect(result).toBeDefined();
        expect(result.chunks).toBeDefined();
        expect(result.queryTime).toBeGreaterThan(0);
      }
    });

    it('should respect maxResults parameter', async () => {
      const result = await queryKnowledgeBase(KB_ID!, 'test query', {
        maxResults: 3
      });

      expect(result.chunks.length).toBeLessThanOrEqual(3);
    });

    it('should format chunks correctly for prompts', async () => {
      const result = await queryKnowledgeBase(KB_ID!, 'test query', {
        maxResults: 5
      });

      if (result.chunks.length > 0) {
        const formatted = formatChunksForPrompt(result.chunks);

        expect(formatted).toContain('Context from Knowledge Base');
        expect(formatted).toContain(result.chunks[0].content);
      }
    });

    it('should extract metadata from results', async () => {
      const result = await queryKnowledgeBase(KB_ID!, 'test query', {
        maxResults: 5
      });

      if (result.chunks.length > 0) {
        const metadata = extractMetadata(result.chunks);

        expect(metadata.totalChunks).toBe(result.chunks.length);
        expect(metadata.sources).toBeDefined();
        expect(Array.isArray(metadata.sources)).toBe(true);
        expect(metadata.averageScore).toBeGreaterThanOrEqual(0);
        expect(metadata.averageScore).toBeLessThanOrEqual(1);
      }
    });

    it('should handle retry logic on transient failures', async () => {
      const query = 'test query';

      const result = await queryKnowledgeBaseWithRetry(
        KB_ID!,
        query,
        3,
        { maxResults: 5 }
      );

      expect(result).toBeDefined();
      expect(result.chunks).toBeDefined();
    });

    it('should measure query performance', async () => {
      const queries = [
        'What is the main topic?',
        'Summarize the content',
        'List key points'
      ];

      const times: number[] = [];

      for (const query of queries) {
        const result = await queryKnowledgeBase(KB_ID!, query, {
          maxResults: 5
        });
        times.push(result.queryTime);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);

      console.log(`\n📊 Query Performance Metrics:`);
      console.log(`   Average query time: ${avgTime.toFixed(0)}ms`);
      console.log(`   Max query time: ${maxTime.toFixed(0)}ms`);
      console.log(`   Min query time: ${Math.min(...times).toFixed(0)}ms`);

      // Performance assertion: queries should complete in reasonable time
      expect(avgTime).toBeLessThan(5000); // 5 seconds
    });
  });

  describe('Knowledge Base ID Validation', () => {
    it('should validate correct Knowledge Base IDs', () => {
      expect(isValidKnowledgeBaseId('ABCD1234EF')).toBe(true);
      expect(isValidKnowledgeBaseId('0123456789')).toBe(true);
      expect(isValidKnowledgeBaseId('XXXXXXXXXX')).toBe(true);
    });

    it('should reject invalid Knowledge Base IDs', () => {
      expect(isValidKnowledgeBaseId('INVALID')).toBe(false);
      expect(isValidKnowledgeBaseId('abcd1234ef')).toBe(false);
      expect(isValidKnowledgeBaseId('ABCD-1234-EF')).toBe(false);
    });
  });

  describe('Chunk Formatting', () => {
    it('should format chunks with relevance scores', () => {
      const chunks = [
        {
          content: 'First chunk content',
          source: 's3://bucket/doc1.pdf',
          score: 0.95
        },
        {
          content: 'Second chunk content',
          source: 's3://bucket/doc2.pdf',
          score: 0.87
        }
      ];

      const formatted = formatChunksForPrompt(chunks);

      expect(formatted).toContain('95.0%');
      expect(formatted).toContain('87.0%');
      expect(formatted).toContain('First chunk content');
      expect(formatted).toContain('Second chunk content');
    });

    it('should handle empty chunks gracefully', () => {
      const formatted = formatChunksForPrompt([]);

      expect(formatted).toBe('No relevant context found.');
    });
  });

  describe('Metadata Extraction', () => {
    it('should extract and aggregate metadata', () => {
      const chunks = [
        {
          content: 'Content 1',
          source: 's3://bucket/doc1.pdf',
          score: 0.9
        },
        {
          content: 'Content 2',
          source: 's3://bucket/doc2.pdf',
          score: 0.8
        },
        {
          content: 'Content 3',
          source: 's3://bucket/doc1.pdf',
          score: 0.85
        }
      ];

      const metadata = extractMetadata(chunks);

      expect(metadata.totalChunks).toBe(3);
      expect(metadata.sources.length).toBe(2);
      expect(metadata.averageScore).toBeCloseTo(0.85, 2);
      expect(metadata.chunkScores).toEqual([0.9, 0.8, 0.85]);
    });
  });
});

// Helper to skip tests conditionally
declare global {
  namespace jest {
    interface Describe {
      skipIf(condition: boolean): Describe;
    }
  }
}

if (!global.describe.skipIf) {
  global.describe.skipIf = function(condition: boolean) {
    return condition ? describe.skip : describe;
  };
}
