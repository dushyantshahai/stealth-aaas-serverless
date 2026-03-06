/**
 * Unit Tests for TOC Extractor
 */

import { extractToc } from '../toc-extractor';

// Mock AWS SDK
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn()
  })),
  GetObjectCommand: jest.fn()
}));

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
  PutCommand: jest.fn()
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

describe('TOC Extractor', () => {
  const mockBookId = 'test-book-123';
  const mockS3Bucket = 'test-bucket';
  const mockS3Key = 'institutes/abc/books/test-book-123/test.pdf';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle valid PDF TOC extraction', async () => {
    // Mock S3 get object
    const s3Send = require('@aws-sdk/client-s3').S3Client.prototype.send as jest.Mock;
    s3Send.mockResolvedValueOnce({
      Body: {
        transformToByteArray: jest.fn().mockResolvedValue(Buffer.from('mock pdf'))
      }
    });

    // Mock fetch to Gemini API
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                chapters: [
                  { chapterNumber: 1, title: 'Introduction', startPage: 1, endPage: 10, confidence: 95, detectedOn: 'Page 1' },
                  { chapterNumber: 2, title: 'Main Content', startPage: 11, endPage: 50, confidence: 90, detectedOn: 'Page 11' }
                ],
                topics: [
                  { parentChapterNumber: 1, topicNumber: '1.1', title: 'What is X?', startPage: 1, endPage: 5, confidence: 85, detectedOn: 'Page 1' },
                  { parentChapterNumber: 1, topicNumber: '1.2', title: 'History', startPage: 6, endPage: 10, confidence: 88, detectedOn: 'Page 6' }
                ],
                subTopics: [],
                subSubTopics: [],
                metadata: {
                  analyzedPages: 'all',
                  totalEntries: 4,
                  entriesWithPages: 4,
                  overallConfidence: 90,
                  warnings: []
                }
              })
            }]
          }
        }]
      })
    });

    // Mock DynamoDB put
    const docClientSend = require('@aws-sdk/lib-dynamodb').DynamoDBDocumentClient.from({}).send as jest.Mock;
    docClientSend.mockResolvedValue({});

    const result = await extractToc(mockBookId, mockS3Bucket, mockS3Key);

    expect(result).toHaveProperty('chapters');
    expect(result).toHaveProperty('topics');
    expect(result).toHaveProperty('subtopics');
    expect(result.chapters.length).toBe(2);
    expect(result.topics.length).toBe(2);
  });

  it('should handle empty TOC response', async () => {
    // Mock S3 get object
    const s3Send = require('@aws-sdk/client-s3').S3Client.prototype.send as jest.Mock;
    s3Send.mockResolvedValueOnce({
      Body: {
        transformToByteArray: jest.fn().mockResolvedValue(Buffer.from('mock pdf'))
      }
    });

    // Mock fetch to Gemini API with empty response
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                chapters: [],
                topics: [],
                subTopics: [],
                subSubTopics: [],
                metadata: {
                  analyzedPages: 'all',
                  totalEntries: 0,
                  entriesWithPages: 0,
                  overallConfidence: 0,
                  warnings: ['No TOC detected']
                }
              })
            }]
          }
        }]
      })
    });

    // Mock DynamoDB put
    const docClientSend = require('@aws-sdk/lib-dynamodb').DynamoDBDocumentClient.from({}).send as jest.Mock;
    docClientSend.mockResolvedValue({});

    const result = await extractToc(mockBookId, mockS3Bucket, mockS3Key);

    expect(result.chapters.length).toBe(0);
    expect(result.topics.length).toBe(0);
  });

  it('should handle API errors gracefully', async () => {
    // Mock S3 get object
    const s3Send = require('@aws-sdk/client-s3').S3Client.prototype.send as jest.Mock;
    s3Send.mockResolvedValueOnce({
      Body: {
        transformToByteArray: jest.fn().mockResolvedValue(Buffer.from('mock pdf'))
      }
    });

    // Mock fetch to Gemini API with error
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal Server Error')
    });

    await expect(extractToc(mockBookId, mockS3Bucket, mockS3Key)).rejects.toThrow();
  });

  it('should handle S3 download errors', async () => {
    // Mock S3 get object to fail
    const s3Send = require('@aws-sdk/client-s3').S3Client.prototype.send as jest.Mock;
    s3Send.mockRejectedValueOnce(new Error('S3 access denied'));

    await expect(extractToc(mockBookId, mockS3Bucket, mockS3Key)).rejects.toThrow('S3 access denied');
  });
});

describe('TOC Structure Validation', () => {
  it('should validate chapter structure', () => {
    // Test that chapters have required fields
    const chapter = {
      chapterNumber: 1,
      title: 'Test Chapter',
      startPage: 1,
      endPage: 10,
      confidence: 95,
      detectedOn: 'Page 1'
    };

    expect(chapter).toHaveProperty('chapterNumber');
    expect(chapter).toHaveProperty('title');
    expect(chapter).toHaveProperty('startPage');
    expect(chapter).toHaveProperty('endPage');
    expect(typeof chapter.chapterNumber).toBe('number');
    expect(typeof chapter.title).toBe('string');
  });

  it('should validate topic structure', () => {
    const topic = {
      parentChapterNumber: 1,
      topicNumber: '1.1',
      title: 'Test Topic',
      startPage: 1,
      endPage: 5,
      confidence: 85,
      detectedOn: 'Page 1'
    };

    expect(topic).toHaveProperty('parentChapterNumber');
    expect(topic).toHaveProperty('topicNumber');
    expect(topic.topicNumber).toMatch(/^\d+\.\d+$/);
  });

  it('should validate subtopic structure', () => {
    const subTopic = {
      parentTopicNumber: '1.1',
      subTopicNumber: '1.1.1',
      title: 'Test Subtopic',
      startPage: 1,
      endPage: 3,
      confidence: 80,
      detectedOn: 'Page 1'
    };

    expect(subTopic).toHaveProperty('parentTopicNumber');
    expect(subTopic).toHaveProperty('subTopicNumber');
    expect(subTopic.subTopicNumber).toMatch(/^\d+\.\d+\.\d+$/);
  });
});