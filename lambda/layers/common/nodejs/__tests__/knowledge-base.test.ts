/**
 * Unit Tests for Knowledge Base Client
 */

import {
  queryKnowledgeBase,
  queryKnowledgeBaseWithRetry,
  formatChunksForPrompt,
  extractMetadata,
  isValidKnowledgeBaseId
} from '../clients/knowledge-base';

// Mock Bedrock Agent Runtime
jest.mock('@aws-sdk/client-bedrock-agent-runtime', () => ({
  BedrockAgentRuntimeClient: jest.fn().mockImplementation(() => ({
    send: jest.fn()
  })),
  RetrieveCommand: jest.fn()
}));

// Mock logger
jest.mock('../utils/logger', () => ({
  getLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  })
}));

describe('Knowledge Base Client', () => {
  const mockKnowledgeBaseId = 'ABCD1234EF';
  const mockQuery = 'What is machine learning?';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('queryKnowledgeBase', () => {
    it('should query Knowledge Base successfully', async () => {
      const { BedrockAgentRuntimeClient } = require('@aws-sdk/client-bedrock-agent-runtime');
      const mockClient = {
        send: jest.fn().mockResolvedValue({
          retrievalResults: [
            {
              content: { text: 'Machine learning is a subset of AI...' },
              location: { s3Location: { uri: 's3://bucket/doc1.pdf' } },
              metadata: { pageNumber: 1 },
              score: 0.95
            },
            {
              content: { text: 'Deep learning uses neural networks...' },
              location: { s3Location: { uri: 's3://bucket/doc2.pdf' } },
              metadata: { pageNumber: 2 },
              score: 0.87
            }
          ]
        })
      };
      BedrockAgentRuntimeClient.mockImplementation(() => mockClient);

      const result = await queryKnowledgeBase(mockKnowledgeBaseId, mockQuery);

      expect(result.chunks.length).toBe(2);
      expect(result.chunks[0].content).toContain('Machine learning');
      expect(result.chunks[0].score).toBe(0.95);
      expect(result.totalChunks).toBe(2);
      expect(result.queryTime).toBeGreaterThan(0);
    });

    it('should handle empty results', async () => {
      const { BedrockAgentRuntimeClient } = require('@aws-sdk/client-bedrock-agent-runtime');
      const mockClient = {
        send: jest.fn().mockResolvedValue({
          retrievalResults: []
        })
      };
      BedrockAgentRuntimeClient.mockImplementation(() => mockClient);

      const result = await queryKnowledgeBase(mockKnowledgeBaseId, mockQuery);

      expect(result.chunks.length).toBe(0);
      expect(result.totalChunks).toBe(0);
    });

    it('should respect maxResults option', async () => {
      const { BedrockAgentRuntimeClient } = require('@aws-sdk/client-bedrock-agent-runtime');
      const mockClient = {
        send: jest.fn().mockResolvedValue({
          retrievalResults: [
            {
              content: { text: 'Result 1' },
              location: { s3Location: { uri: 's3://bucket/doc1.pdf' } },
              score: 0.9
            }
          ]
        })
      };
      BedrockAgentRuntimeClient.mockImplementation(() => mockClient);

      const result = await queryKnowledgeBase(mockKnowledgeBaseId, mockQuery, {
        maxResults: 10
      });

      expect(result.chunks.length).toBe(1);
    });

    it('should handle API errors', async () => {
      const { BedrockAgentRuntimeClient } = require('@aws-sdk/client-bedrock-agent-runtime');
      const mockClient = {
        send: jest.fn().mockRejectedValue(new Error('API Error'))
      };
      BedrockAgentRuntimeClient.mockImplementation(() => mockClient);

      await expect(queryKnowledgeBase(mockKnowledgeBaseId, mockQuery)).rejects.toThrow(
        'Failed to query Knowledge Base'
      );
    });
  });

  describe('queryKnowledgeBaseWithRetry', () => {
    it('should succeed on first attempt', async () => {
      const { BedrockAgentRuntimeClient } = require('@aws-sdk/client-bedrock-agent-runtime');
      const mockClient = {
        send: jest.fn().mockResolvedValue({
          retrievalResults: [
            {
              content: { text: 'Result' },
              location: { s3Location: { uri: 's3://bucket/doc.pdf' } },
              score: 0.9
            }
          ]
        })
      };
      BedrockAgentRuntimeClient.mockImplementation(() => mockClient);

      const result = await queryKnowledgeBaseWithRetry(mockKnowledgeBaseId, mockQuery);

      expect(result.chunks.length).toBe(1);
      expect(mockClient.send).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure', async () => {
      const { BedrockAgentRuntimeClient } = require('@aws-sdk/client-bedrock-agent-runtime');
      const mockClient = {
        send: jest
          .fn()
          .mockRejectedValueOnce(new Error('Temporary error'))
          .mockResolvedValueOnce({
            retrievalResults: [
              {
                content: { text: 'Result' },
                location: { s3Location: { uri: 's3://bucket/doc.pdf' } },
                score: 0.9
              }
            ]
          })
      };
      BedrockAgentRuntimeClient.mockImplementation(() => mockClient);

      const result = await queryKnowledgeBaseWithRetry(mockKnowledgeBaseId, mockQuery, 3);

      expect(result.chunks.length).toBe(1);
      expect(mockClient.send).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries', async () => {
      const { BedrockAgentRuntimeClient } = require('@aws-sdk/client-bedrock-agent-runtime');
      const mockClient = {
        send: jest.fn().mockRejectedValue(new Error('Persistent error'))
      };
      BedrockAgentRuntimeClient.mockImplementation(() => mockClient);

      await expect(queryKnowledgeBaseWithRetry(mockKnowledgeBaseId, mockQuery, 2)).rejects.toThrow(
        'Persistent error'
      );

      expect(mockClient.send).toHaveBeenCalledTimes(2);
    });
  });

  describe('formatChunksForPrompt', () => {
    it('should format chunks correctly', () => {
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

      expect(formatted).toContain('Context from Knowledge Base');
      expect(formatted).toContain('First chunk content');
      expect(formatted).toContain('Second chunk content');
      expect(formatted).toContain('95.0%');
      expect(formatted).toContain('87.0%');
    });

    it('should handle empty chunks', () => {
      const formatted = formatChunksForPrompt([]);

      expect(formatted).toBe('No relevant context found.');
    });

    it('should respect maxChunks parameter', () => {
      const chunks = [
        { content: 'Chunk 1', source: 's3://bucket/doc1.pdf', score: 0.9 },
        { content: 'Chunk 2', source: 's3://bucket/doc2.pdf', score: 0.8 },
        { content: 'Chunk 3', source: 's3://bucket/doc3.pdf', score: 0.7 }
      ];

      const formatted = formatChunksForPrompt(chunks, 2);

      expect(formatted).toContain('Chunk 1');
      expect(formatted).toContain('Chunk 2');
      expect(formatted).not.toContain('Chunk 3');
    });
  });

  describe('extractMetadata', () => {
    it('should extract metadata from chunks', () => {
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
        }
      ];

      const metadata = extractMetadata(chunks);

      expect(metadata.totalChunks).toBe(2);
      expect(metadata.sources).toContain('s3://bucket/doc1.pdf');
      expect(metadata.sources).toContain('s3://bucket/doc2.pdf');
      expect(metadata.averageScore).toBe(0.85);
      expect(metadata.chunkScores).toEqual([0.9, 0.8]);
    });

    it('should handle chunks without scores', () => {
      const chunks = [
        {
          content: 'Content 1',
          source: 's3://bucket/doc1.pdf'
        }
      ];

      const metadata = extractMetadata(chunks);

      expect(metadata.totalChunks).toBe(1);
      expect(metadata.averageScore).toBe(0);
      expect(metadata.chunkScores).toEqual([]);
    });

    it('should handle empty chunks', () => {
      const metadata = extractMetadata([]);

      expect(metadata.totalChunks).toBe(0);
      expect(metadata.sources).toEqual([]);
      expect(metadata.averageScore).toBe(0);
    });
  });

  describe('isValidKnowledgeBaseId', () => {
    it('should validate correct Knowledge Base ID format', () => {
      expect(isValidKnowledgeBaseId('ABCD1234EF')).toBe(true);
      expect(isValidKnowledgeBaseId('XXXXXXXXXX')).toBe(true);
      expect(isValidKnowledgeBaseId('0123456789')).toBe(true);
    });

    it('should reject invalid Knowledge Base ID format', () => {
      expect(isValidKnowledgeBaseId('ABCD123')).toBe(false); // Too short
      expect(isValidKnowledgeBaseId('ABCD1234EF1')).toBe(false); // Too long
      expect(isValidKnowledgeBaseId('abcd1234ef')).toBe(false); // Lowercase
      expect(isValidKnowledgeBaseId('ABCD-1234-EF')).toBe(false); // Invalid characters
    });
  });
});
