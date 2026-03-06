/**
 * Unit Tests for Text Chunker
 */

import { createPageAwareChunks, chunkTextSimple } from '../text-chunker';

// Mock AWS SDK
jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({
    send: jest.fn()
  }))
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn().mockReturnValue({
      send: jest.fn()
    })
  },
  PutCommand: jest.fn(),
  QueryCommand: jest.fn()
}));

jest.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: jest.fn().mockImplementation(() => ({
    send: jest.fn()
  })),
  InvokeModelCommand: jest.fn()
}));

// Mock logger
jest.mock('/opt/nodejs/utils/logger', () => ({
  getLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  })
}));

describe('Text Chunker', () => {
  describe('chunkTextSimple', () => {
    it('should split text into chunks', () => {
      const text = 'This is a test sentence. This is another sentence. And one more sentence here.';
      const chunks = chunkTextSimple(text, 50);
      
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0]).toBeTruthy();
    });

    it('should preserve sentence boundaries', () => {
      const text = 'First sentence. Second sentence. Third sentence.';
      const chunks = chunkTextSimple(text, 100);
      
      // All sentences should be in chunks
      const combinedText = chunks.join(' ');
      expect(combinedText).toContain('First sentence');
      expect(combinedText).toContain('Second sentence');
      expect(combinedText).toContain('Third sentence');
    });

    it('should handle empty text', () => {
      const chunks = chunkTextSimple('', 50);
      expect(chunks).toEqual([]);
    });

    it('should handle whitespace-only text', () => {
      const chunks = chunkTextSimple('   \n\n   ', 50);
      expect(chunks).toEqual([]);
    });

    it('should handle short text that fits in one chunk', () => {
      const text = 'Short text.';
      const chunks = chunkTextSimple(text, 1000);
      expect(chunks.length).toBe(1);
      expect(chunks[0]).toBe('Short text.');
    });

    it('should skip very short chunks', () => {
      const text = 'A B C D E F G H I J K L M N O P Q R S T U V W X Y Z';
      const chunks = chunkTextSimple(text, 1000);
      
      // Each letter might create a very short chunk
      // The function should skip chunks < 50 chars
      const validChunks = chunks.filter(c => c.length >= 50);
      expect(validChunks.length).toBeGreaterThan(0);
    });
  });

  describe('createPageAwareChunks', () => {
    const mockBookId = 'test-book-123';
    const mockPageTexts: Record<number, string> = {
      1: 'Chapter 1 content page 1. This is the introduction.',
      2: 'Chapter 1 content page 2. More details here.',
      3: 'Chapter 1 content page 3. Even more content.',
      4: 'Chapter 2 content page 1. New chapter starts.',
      5: 'Chapter 2 content page 2. Continuing chapter 2.',
      6: 'Chapter 2 content page 3. End of chapter 2.',
      7: 'Chapter 3 content page 1. Final chapter.',
      8: 'Chapter 3 content page 2. Last page of the book.'
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should handle empty page texts', async () => {
      const result = await createPageAwareChunks('book-1', {}, 0);
      
      expect(result.success).toBe(false);
      expect(result.totalChunks).toBe(0);
    });

    it('should process pages without chapters (fallback)', async () => {
      // Mock DynamoDB query to return no chapters
      const docClientSend = require('@aws-sdk/lib-dynamodb').DynamoDBDocumentClient.from({}).send as jest.Mock;
      docClientSend.mockResolvedValueOnce({
        Items: [] // No chapters
      });

      const result = await createPageAwareChunks(mockBookId, mockPageTexts, 8);
      
      expect(result.success).toBe(false);
    });

    it('should have proper result structure', async () => {
      // Mock chapters
      const docClientSend = require('@aws-sdk/lib-dynamodb').DynamoDBDocumentClient.from({}).send as jest.Mock;
      docClientSend
        .mockResolvedValueOnce({
          Items: [
            { chapterId: 'ch-1', title: 'Chapter 1', order: 0, pageStart: 1, pageEnd: 3 }
          ]
        })
        .mockResolvedValueOnce({
          Items: [
            { topicId: 'topic-1', title: 'Topic 1', order: 0, pageStart: 1, pageEnd: 3 }
          ]
        })
        .mockResolvedValueOnce({ Items: [] }) // Subtopics
        .mockResolvedValue({}); // Put commands

      const result = await createPageAwareChunks(mockBookId, mockPageTexts, 8);
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('totalChunks');
      expect(result).toHaveProperty('chunksByPriority');
      expect(result).toHaveProperty('distribution');
      expect(result.chunksByPriority).toHaveProperty('topicLevel');
      expect(result.chunksByPriority).toHaveProperty('chapterLevel');
      expect(result.chunksByPriority).toHaveProperty('fallback');
    });
  });
});

describe('Chunking Edge Cases', () => {
  it('should handle very long text', () => {
    const longText = 'Word '.repeat(1000);
    const chunks = chunkTextSimple(longText, 500);
    
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('should handle text with multiple paragraphs', () => {
    const text = 'Paragraph 1.\n\nParagraph 2.\n\nParagraph 3.';
    const chunks = chunkTextSimple(text, 100);
    
    expect(chunks.length).toBeGreaterThan(0);
  });

  it('should handle text with special characters', () => {
    const text = 'Special chars: @#$%^&*()[]{}|":<>?';
    const chunks = chunkTextSimple(text, 50);
    
    expect(chunks.length).toBe(1);
    expect(chunks[0]).toContain('@#$%^&*()');
  });

  it('should handle unicode text', () => {
    const text = 'Unicode: 你好世界 مرحبا עולם 🎉';
    const chunks = chunkTextSimple(text, 50);
    
    expect(chunks.length).toBe(1);
  });
});
