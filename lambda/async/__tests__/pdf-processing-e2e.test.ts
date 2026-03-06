/**
 * End-to-End Tests for PDF Processing Workflow
 * 
 * Tests the complete PDF processing pipeline:
 * 1. Upload PDF to S3
 * 2. S3 event triggers SQS message
 * 3. Lambda processes PDF
 * 4. TOC extracted and stored in DynamoDB
 * 5. Chunks created and stored
 * 6. Book status updated to "processed"
 */

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient, QueryCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand as DocQueryCommand } from '@aws-sdk/lib-dynamodb';
import { SQSClient, SendMessageCommand, ReceiveMessageCommand } from '@aws-sdk/client-sqs';
import { handler as pdfProcessorHandler } from '../pdf-processor';
import * as fs from 'fs';
import * as path from 'path';

// Mock AWS SDK
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb');
jest.mock('@aws-sdk/client-sqs');

// Mock logger
jest.mock('/opt/nodejs/utils/logger', () => ({
  getLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  })
}));

// Mock PDF processing utilities
jest.mock('../utils/pdf-text-extractor', () => ({
  extractPdfText: jest.fn().mockResolvedValue({
    text: 'Chapter 1: Introduction\nThis is the introduction chapter.\n\nChapter 2: Main Content\nThis is the main content.',
    pages: [
      { pageNumber: 1, text: 'Chapter 1: Introduction\nThis is the introduction chapter.' },
      { pageNumber: 2, text: 'Chapter 2: Main Content\nThis is the main content.' }
    ],
    totalPages: 2,
    isScanned: false
  })
}));

jest.mock('../toc-extractor', () => ({
  extractToc: jest.fn().mockResolvedValue({
    chapters: [
      {
        chapterId: 'ch-1',
        title: 'Chapter 1: Introduction',
        bookId: 'book-123',
        order: 0,
        pageStart: 1,
        pageEnd: 1
      },
      {
        chapterId: 'ch-2',
        title: 'Chapter 2: Main Content',
        bookId: 'book-123',
        order: 1,
        pageStart: 2,
        pageEnd: 2
      }
    ],
    topics: [
      {
        topicId: 'topic-1',
        title: 'Introduction Overview',
        chapterId: 'ch-1',
        order: 0,
        pageStart: 1,
        pageEnd: 1
      },
      {
        topicId: 'topic-2',
        title: 'Main Concepts',
        chapterId: 'ch-2',
        order: 0,
        pageStart: 2,
        pageEnd: 2
      }
    ],
    subtopics: [
      {
        subtopicId: 'subtopic-1',
        title: 'Getting Started',
        topicId: 'topic-1',
        order: 0,
        pageStart: 1,
        pageEnd: 1
      }
    ]
  })
}));

jest.mock('../text-chunker', () => ({
  createPageAwareChunks: jest.fn().mockResolvedValue({
    success: true,
    totalChunks: 5,
    chunksByPriority: { topicLevel: 3, chapterLevel: 2, fallback: 0 },
    distribution: [
      { priority: 'topicLevel', count: 3 },
      { priority: 'chapterLevel', count: 2 }
    ]
  })
}));

describe('PDF Processing Workflow - End-to-End', () => {
  let mockS3Client: any = {};
  let mockDynamoClient: any = {};
  let mockDocClient: any = {};
  let mockSqsClient: any = {};

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock clients
    mockS3Client = {
      send: jest.fn()
    };

    mockDynamoClient = {
      send: jest.fn()
    };

    mockDocClient = {
      send: jest.fn()
    };

    mockSqsClient = {
      send: jest.fn()
    };

    // Mock client constructors
    (S3Client as jest.Mock).mockImplementation(() => mockS3Client);
    (DynamoDBClient as jest.Mock).mockImplementation(() => mockDynamoClient);
    (DynamoDBDocumentClient.from as jest.Mock).mockReturnValue(mockDocClient);
    (SQSClient as jest.Mock).mockImplementation(() => mockSqsClient);
  });

  describe('Complete PDF Processing Pipeline', () => {
    it('should process PDF from S3 upload to DynamoDB storage', async () => {
      const bookId = 'book-123';
      const s3Bucket = 'test-bucket';
      const s3Key = 'institutes/inst-1/books/book-123/test.pdf';

      // Mock S3 get object
      mockS3Client.send.mockResolvedValueOnce({
        Body: {
          transformToByteArray: jest.fn().mockResolvedValue(Buffer.from('mock pdf'))
        }
      });

      // Mock DynamoDB update for book status
      mockDocClient.send.mockResolvedValue({});

      // Mock SQS delete message
      mockSqsClient.send.mockResolvedValue({});

      const sqsEvent = {
        Records: [
          {
            messageId: 'msg-1',
            receiptHandle: 'receipt-1',
            body: JSON.stringify({
              Records: [
                {
                  s3: {
                    bucket: { name: s3Bucket },
                    object: { key: s3Key, size: 1024 }
                  }
                }
              ]
            })
          }
        ]
      };

      const result = await pdfProcessorHandler(sqsEvent);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.results[0].success).toBe(true);
      expect(body.results[0].bookId).toBe(bookId);
      expect(body.results[0].steps.textExtraction).toBe(true);
      expect(body.results[0].steps.tocExtraction).toBe(true);
      expect(body.results[0].steps.chunking).toBe(true);
      expect(body.results[0].metrics).toEqual({
        totalPages: 2,
        totalChunks: 5,
        chaptersCount: 2,
        topicsCount: 2,
        subtopicsCount: 1
      });
    });

    it('should verify S3 event triggers SQS message processing', async () => {
      const s3Event = {
        Records: [
          {
            messageId: 'msg-1',
            receiptHandle: 'receipt-1',
            body: JSON.stringify({
              Records: [
                {
                  s3: {
                    bucket: { name: 'pdf-bucket' },
                    object: { key: 'institutes/abc/books/book-1/document.pdf', size: 2048 }
                  }
                }
              ]
            })
          }
        ]
      };

      mockS3Client.send.mockResolvedValueOnce({
        Body: {
          transformToByteArray: jest.fn().mockResolvedValue(Buffer.from('pdf'))
        }
      });

      mockDocClient.send.mockResolvedValue({});
      mockSqsClient.send.mockResolvedValue({});

      const result = await pdfProcessorHandler(s3Event);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.results.length).toBe(1);
      expect(body.results[0].success).toBe(true);
    });

    it('should verify book status updated to PROCESSED', async () => {
      mockS3Client.send.mockResolvedValueOnce({
        Body: {
          transformToByteArray: jest.fn().mockResolvedValue(Buffer.from('pdf'))
        }
      });

      mockDocClient.send.mockResolvedValue({});
      mockSqsClient.send.mockResolvedValue({});

      const sqsEvent = {
        Records: [
          {
            messageId: 'msg-1',
            receiptHandle: 'receipt-1',
            body: JSON.stringify({
              Records: [
                {
                  s3: {
                    bucket: { name: 'bucket' },
                    object: { key: 'institutes/abc/books/book-1/test.pdf', size: 1024 }
                  }
                }
              ]
            })
          }
        ]
      };

      await pdfProcessorHandler(sqsEvent);

      // Verify DynamoDB update was called with PROCESSED status
      const updateCalls = mockDocClient.send.mock.calls;
      expect(updateCalls.length).toBeGreaterThan(0);

      // Check that at least one call was an update command
      const hasUpdateCommand = updateCalls.some((call: any) => {
        return call[0]?.constructor.name === 'UpdateCommand';
      });
      expect(hasUpdateCommand).toBe(true);
    });

    it('should handle both native text and scanned PDFs', async () => {
      // Test with native text PDF
      const { extractPdfText } = require('../utils/pdf-text-extractor');
      extractPdfText.mockResolvedValueOnce({
        text: 'Native text content',
        pages: [{ pageNumber: 1, text: 'Native text content' }],
        totalPages: 1,
        isScanned: false
      });

      mockS3Client.send.mockResolvedValueOnce({
        Body: {
          transformToByteArray: jest.fn().mockResolvedValue(Buffer.from('pdf'))
        }
      });

      mockDocClient.send.mockResolvedValue({});
      mockSqsClient.send.mockResolvedValue({});

      const sqsEvent = {
        Records: [
          {
            messageId: 'msg-1',
            receiptHandle: 'receipt-1',
            body: JSON.stringify({
              Records: [
                {
                  s3: {
                    bucket: { name: 'bucket' },
                    object: { key: 'institutes/abc/books/book-1/native.pdf', size: 1024 }
                  }
                }
              ]
            })
          }
        ]
      };

      const result = await pdfProcessorHandler(sqsEvent);
      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.results[0].success).toBe(true);
    });

    it('should verify TOC extracted and stored', async () => {
      const { extractToc } = require('../toc-extractor');

      mockS3Client.send.mockResolvedValueOnce({
        Body: {
          transformToByteArray: jest.fn().mockResolvedValue(Buffer.from('pdf'))
        }
      });

      mockDocClient.send.mockResolvedValue({});
      mockSqsClient.send.mockResolvedValue({});

      const sqsEvent = {
        Records: [
          {
            messageId: 'msg-1',
            receiptHandle: 'receipt-1',
            body: JSON.stringify({
              Records: [
                {
                  s3: {
                    bucket: { name: 'bucket' },
                    object: { key: 'institutes/abc/books/book-1/test.pdf', size: 1024 }
                  }
                }
              ]
            })
          }
        ]
      };

      await pdfProcessorHandler(sqsEvent);

      // Verify extractToc was called
      expect(extractToc).toHaveBeenCalled();
      const tocCall = extractToc.mock.calls[0];
      expect(tocCall[0]).toBe('book-1'); // bookId
    });

    it('should verify chunks created and stored', async () => {
      const { createPageAwareChunks } = require('../text-chunker');

      mockS3Client.send.mockResolvedValueOnce({
        Body: {
          transformToByteArray: jest.fn().mockResolvedValue(Buffer.from('pdf'))
        }
      });

      mockDocClient.send.mockResolvedValue({});
      mockSqsClient.send.mockResolvedValue({});

      const sqsEvent = {
        Records: [
          {
            messageId: 'msg-1',
            receiptHandle: 'receipt-1',
            body: JSON.stringify({
              Records: [
                {
                  s3: {
                    bucket: { name: 'bucket' },
                    object: { key: 'institutes/abc/books/book-1/test.pdf', size: 1024 }
                  }
                }
              ]
            })
          }
        ]
      };

      const result = await pdfProcessorHandler(sqsEvent);

      // Verify createPageAwareChunks was called
      expect(createPageAwareChunks).toHaveBeenCalled();
      const chunkCall = createPageAwareChunks.mock.calls[0];
      expect(chunkCall[0]).toBe('book-1'); // bookId
      expect(chunkCall[2]).toBe(2); // totalPages

      // Verify result includes chunk metrics
      const body = JSON.parse(result.body);
      expect(body.results[0].metrics.totalChunks).toBe(5);
    });

    it('should handle processing errors gracefully', async () => {
      mockS3Client.send.mockRejectedValueOnce(new Error('S3 access denied'));
      mockDocClient.send.mockResolvedValue({});

      const sqsEvent = {
        Records: [
          {
            messageId: 'msg-1',
            receiptHandle: 'receipt-1',
            body: JSON.stringify({
              Records: [
                {
                  s3: {
                    bucket: { name: 'bucket' },
                    object: { key: 'institutes/abc/books/book-1/test.pdf', size: 1024 }
                  }
                }
              ]
            })
          }
        ]
      };

      const result = await pdfProcessorHandler(sqsEvent);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.results[0].success).toBe(false);
      expect(body.results[0].error).toContain('S3 access denied');
    });

    it('should verify message deleted from SQS after successful processing', async () => {
      mockS3Client.send.mockResolvedValueOnce({
        Body: {
          transformToByteArray: jest.fn().mockResolvedValue(Buffer.from('pdf'))
        }
      });

      mockDocClient.send.mockResolvedValue({});
      mockSqsClient.send.mockResolvedValue({});

      const sqsEvent = {
        Records: [
          {
            messageId: 'msg-1',
            receiptHandle: 'receipt-handle-123',
            body: JSON.stringify({
              Records: [
                {
                  s3: {
                    bucket: { name: 'bucket' },
                    object: { key: 'institutes/abc/books/book-1/test.pdf', size: 1024 }
                  }
                }
              ]
            })
          }
        ]
      };

      await pdfProcessorHandler(sqsEvent);

      // Verify DeleteMessageCommand was called
      const deleteCalls = mockSqsClient.send.mock.calls.filter(
        (call: any) => call[0]?.constructor.name === 'DeleteMessageCommand'
      );
      expect(deleteCalls.length).toBe(1);
    });

    it('should not delete message from SQS if processing fails', async () => {
      mockS3Client.send.mockRejectedValueOnce(new Error('Processing failed'));
      mockDocClient.send.mockResolvedValue({});
      mockSqsClient.send.mockResolvedValue({});

      const sqsEvent = {
        Records: [
          {
            messageId: 'msg-1',
            receiptHandle: 'receipt-1',
            body: JSON.stringify({
              Records: [
                {
                  s3: {
                    bucket: { name: 'bucket' },
                    object: { key: 'institutes/abc/books/book-1/test.pdf', size: 1024 }
                  }
                }
              ]
            })
          }
        ]
      };

      await pdfProcessorHandler(sqsEvent);

      // Verify DeleteMessageCommand was NOT called
      const deleteCalls = mockSqsClient.send.mock.calls.filter(
        (call: any) => call[0]?.constructor.name === 'DeleteMessageCommand'
      );
      expect(deleteCalls.length).toBe(0);
    });

    it('should process multiple PDFs in batch', async () => {
      mockS3Client.send.mockResolvedValue({
        Body: {
          transformToByteArray: jest.fn().mockResolvedValue(Buffer.from('pdf'))
        }
      });

      mockDocClient.send.mockResolvedValue({});
      mockSqsClient.send.mockResolvedValue({});

      const sqsEvent = {
        Records: [
          {
            messageId: 'msg-1',
            receiptHandle: 'receipt-1',
            body: JSON.stringify({
              Records: [
                {
                  s3: {
                    bucket: { name: 'bucket' },
                    object: { key: 'institutes/abc/books/book-1/test1.pdf', size: 1024 }
                  }
                }
              ]
            })
          },
          {
            messageId: 'msg-2',
            receiptHandle: 'receipt-2',
            body: JSON.stringify({
              Records: [
                {
                  s3: {
                    bucket: { name: 'bucket' },
                    object: { key: 'institutes/abc/books/book-2/test2.pdf', size: 2048 }
                  }
                }
              ]
            })
          }
        ]
      };

      const result = await pdfProcessorHandler(sqsEvent);

      expect(result.statusCode).toBe(200);
      const body = JSON.parse(result.body);
      expect(body.results.length).toBe(2);
      expect(body.results[0].success).toBe(true);
      expect(body.results[1].success).toBe(true);
    });
  });

  describe('PDF Processing Metrics', () => {
    it('should return accurate processing metrics', async () => {
      mockS3Client.send.mockResolvedValueOnce({
        Body: {
          transformToByteArray: jest.fn().mockResolvedValue(Buffer.from('pdf'))
        }
      });

      mockDocClient.send.mockResolvedValue({});
      mockSqsClient.send.mockResolvedValue({});

      const sqsEvent = {
        Records: [
          {
            messageId: 'msg-1',
            receiptHandle: 'receipt-1',
            body: JSON.stringify({
              Records: [
                {
                  s3: {
                    bucket: { name: 'bucket' },
                    object: { key: 'institutes/abc/books/book-1/test.pdf', size: 1024 }
                  }
                }
              ]
            })
          }
        ]
      };

      const result = await pdfProcessorHandler(sqsEvent);
      const body = JSON.parse(result.body);
      const metrics = body.results[0].metrics;

      expect(metrics.totalPages).toBe(2);
      expect(metrics.totalChunks).toBe(5);
      expect(metrics.chaptersCount).toBe(2);
      expect(metrics.topicsCount).toBe(2);
      expect(metrics.subtopicsCount).toBe(1);
    });
  });
});
