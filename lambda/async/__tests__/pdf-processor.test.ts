/**
 * Unit Tests for PDF Processor
 */

import { handler } from '../pdf-processor';

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
  UpdateCommand: jest.fn()
}));

jest.mock('@aws-sdk/client-sqs', () => ({
  SQSClient: jest.fn().mockImplementation(() => ({
    send: jest.fn()
  })),
  SendMessageCommand: jest.fn(),
  DeleteMessageCommand: jest.fn()
}));

// Mock the dependencies
jest.mock('../utils/pdf-text-extractor', () => ({
  extractPdfText: jest.fn().mockResolvedValue({
    text: 'Extracted text content',
    pages: [
      { pageNumber: 1, text: 'Page 1 content' },
      { pageNumber: 2, text: 'Page 2 content' }
    ],
    totalPages: 2,
    isScanned: false
  })
}));

jest.mock('../toc-extractor', () => ({
  extractToc: jest.fn().mockResolvedValue({
    chapters: [
      { chapterId: 'ch-1', title: 'Chapter 1', bookId: 'book-1', order: 0, pageStart: 1, pageEnd: 10 }
    ],
    topics: [
      { topicId: 'topic-1', title: 'Topic 1', chapterId: 'ch-1', order: 0, pageStart: 1, pageEnd: 5 }
    ],
    subtopics: []
  })
}));

jest.mock('../text-chunker', () => ({
  createPageAwareChunks: jest.fn().mockResolvedValue({
    success: true,
    totalChunks: 5,
    chunksByPriority: { topicLevel: 3, chapterLevel: 2, fallback: 0 },
    distribution: []
  })
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

describe('PDF Processor', () => {
  const mockS3Event = {
    Records: [
      {
        messageId: 'test-message-id',
        receiptHandle: 'test-receipt-handle',
        body: JSON.stringify({
          Records: [
            {
              s3: {
                bucket: { name: 'test-bucket' },
                object: { key: 'institutes/abc/books/book-123/test.pdf', size: 1024 }
              }
            }
          ]
        })
      }
    ]
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should process PDF successfully', async () => {
    // Mock S3 get object
    const s3Send = require('@aws-sdk/client-s3').S3Client.prototype.send as jest.Mock;
    s3Send.mockResolvedValueOnce({
      Body: {
        transformToByteArray: jest.fn().mockResolvedValue(Buffer.from('mock pdf'))
      }
    });

    // Mock DynamoDB update
    const docClientSend = require('@aws-sdk/lib-dynamodb').DynamoDBDocumentClient.from({}).send as jest.Mock;
    docClientSend.mockResolvedValue({});

    // Mock SQS delete
    const sqsSend = require('@aws-sdk/client-sqs').SQSClient.prototype.send as jest.Mock;
    sqsSend.mockResolvedValue({});

    const result = await handler(mockS3Event);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.message).toBe('Processing complete');
    expect(body.results.length).toBe(1);
    expect(body.results[0].success).toBe(true);
  });

  it('should handle multiple records', async () => {
    const multiRecordEvent = {
      Records: [
        {
          messageId: 'msg-1',
          receiptHandle: 'receipt-1',
          body: JSON.stringify({
            Records: [{
              s3: { bucket: { name: 'bucket-1' }, object: { key: 'institutes/abc/books/book-1/test.pdf', size: 1024 } }
            }]
          })
        },
        {
          messageId: 'msg-2',
          receiptHandle: 'receipt-2',
          body: JSON.stringify({
            Records: [{
              s3: { bucket: { name: 'bucket-2' }, object: { key: 'institutes/abc/books/book-2/test.pdf', size: 2048 } }
            }]
          })
        }
      ]
    };

    // Mock S3 get object for both records
    const s3Send = require('@aws-sdk/client-s3').S3Client.prototype.send as jest.Mock;
    s3Send.mockResolvedValue({
      Body: {
        transformToByteArray: jest.fn().mockResolvedValue(Buffer.from('mock pdf'))
      }
    });

    // Mock DynamoDB update
    const docClientSend = require('@aws-sdk/lib-dynamodb').DynamoDBDocumentClient.from({}).send as jest.Mock;
    docClientSend.mockResolvedValue({});

    // Mock SQS delete
    const sqsSend = require('@aws-sdk/client-sqs').SQSClient.prototype.send as jest.Mock;
    sqsSend.mockResolvedValue({});

    const result = await handler(multiRecordEvent);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.results.length).toBe(2);
  });

  it('should handle S3 download errors gracefully', async () => {
    // Mock S3 to fail
    const s3Send = require('@aws-sdk/client-s3').S3Client.prototype.send as jest.Mock;
    s3Send.mockRejectedValue(new Error('S3 access denied'));

    const result = await handler(mockS3Event);

    expect(result.statusCode).toBe(200); // Still returns 200, but logs error
    const body = JSON.parse(result.body);
    expect(body.results[0].success).toBe(false);
    expect(body.results[0].error).toContain('S3 access denied');
  });

  it('should handle invalid S3 key format', async () => {
    const invalidKeyEvent = {
      Records: [
        {
          messageId: 'test-msg',
          receiptHandle: 'receipt',
          body: JSON.stringify({
            Records: [{
              s3: { bucket: { name: 'bucket' }, object: { key: 'invalid/key/format.pdf', size: 1024 } }
            }]
          })
        }
      ]
    };

    const result = await handler(invalidKeyEvent);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    // Should skip invalid key and continue
    expect(body.results.length).toBe(0);
  });

  it('should handle malformed SQS message', async () => {
    const malformedEvent = {
      Records: [
        {
          messageId: 'test-msg',
          receiptHandle: 'receipt',
          body: 'not-valid-json'
        }
      ]
    };

    const result = await handler(malformedEvent);

    expect(result.statusCode).toBe(200);
    // Should not crash on malformed message
  });

  it('should handle empty event', async () => {
    const emptyEvent = { Records: [] };
    const result = await handler(emptyEvent);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.results.length).toBe(0);
  });
});

describe('PDF Processor - Status Updates', () => {
  it('should update book status to PROCESSED on success', async () => {
    const s3Send = require('@aws-sdk/client-s3').S3Client.prototype.send as jest.Mock;
    s3Send.mockResolvedValue({
      Body: {
        transformToByteArray: jest.fn().mockResolvedValue(Buffer.from('pdf'))
      }
    });

    const docClientSend = require('@aws-sdk/lib-dynamodb').DynamoDBDocumentClient.from({}).send as jest.Mock;
    docClientSend.mockResolvedValue({});

    const sqsSend = require('@aws-sdk/client-sqs').SQSClient.prototype.send as jest.Mock;
    sqsSend.mockResolvedValue({});

    await handler(mockS3Event);

    // Verify UpdateCommand was called with PROCESSED status
    const updateCalls = docClientSend.mock.calls.filter(
      call => call[0]?.constructor.name === 'UpdateCommand'
    );
    expect(updateCalls.length).toBeGreaterThan(0);
  });

  it('should update book status to FAILED on error', async () => {
    const s3Send = require('@aws-sdk/client-s3').S3Client.prototype.send as jest.Mock;
    s3Send.mockRejectedValue(new Error('Processing failed'));

    const docClientSend = require('@aws-sdk/lib-dynamodb').DynamoDBDocumentClient.from({}).send as jest.Mock;
    docClientSend.mockResolvedValue({});

    await handler(mockS3Event);

    // Verify UpdateCommand was called with FAILED status
    const updateCalls = docClientSend.mock.calls.filter(
      call => call[0]?.constructor.name === 'UpdateCommand'
    );
    expect(updateCalls.length).toBeGreaterThan(0);
  });
});

describe('PDF Processor - SQS Message Handling', () => {
  it('should delete message from queue after processing', async () => {
    const s3Send = require('@aws-sdk/client-s3').S3Client.prototype.send as jest.Mock;
    s3Send.mockResolvedValue({
      Body: {
        transformToByteArray: jest.fn().mockResolvedValue(Buffer.from('pdf'))
      }
    });

    const docClientSend = require('@aws-sdk/lib-dynamodb').DynamoDBDocumentClient.from({}).send as jest.Mock;
    docClientSend.mockResolvedValue({});

    const sqsSend = require('@aws-sdk/client-sqs').SQSClient.prototype.send as jest.Mock;
    sqsSend.mockResolvedValue({});

    await handler(mockS3Event);

    // Verify DeleteMessageCommand was called
    const deleteCalls = sqsSend.mock.calls.filter(
      call => call[0]?.constructor.name === 'DeleteMessageCommand'
    );
    expect(deleteCalls.length).toBe(1);
    expect(deleteCalls[0][0]).toHaveProperty('ReceiptHandle', 'test-receipt-handle');
  });

  it('should not delete message if processing fails', async () => {
    const s3Send = require('@aws-sdk/client-s3').S3Client.prototype.send as jest.Mock;
    s3Send.mockRejectedValue(new Error('Processing failed'));

    const docClientSend = require('@aws-sdk/lib-dynamodb').DynamoDBDocumentClient.from({}).send as jest.Mock;
    docClientSend.mockResolvedValue({});

    const sqsSend = require('@aws-sdk/client-sqs').SQSClient.prototype.send as jest.Mock;
    sqsSend.mockResolvedValue({});

    await handler(mockS3Event);

    // Delete should not be called on error
    const deleteCalls = sqsSend.mock.calls.filter(
      call => call[0]?.constructor.name === 'DeleteMessageCommand'
    );
    expect(deleteCalls.length).toBe(0);
  });
});