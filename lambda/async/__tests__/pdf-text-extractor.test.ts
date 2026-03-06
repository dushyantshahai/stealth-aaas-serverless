/**
 * Unit Tests for PDF Text Extractor
 */

import { extractPdfText, extractPdfTextFromBuffer, extractTextFromPages, sanitizeText } from '../utils/pdf-text-extractor';

// Mock AWS SDK
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn()
  })),
  GetObjectCommand: jest.fn()
}));

jest.mock('@aws-sdk/client-secrets-manager', () => ({
  SecretsManagerClient: jest.fn().mockImplementation(() => ({
    send: jest.fn()
  })),
  GetSecretValueCommand: jest.fn()
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

describe('PDF Text Extractor', () => {
  describe('sanitizeText', () => {
    it('should remove null bytes', () => {
      const input = 'Hello\x00World';
      const result = sanitizeText(input);
      expect(result).toBe('HelloWorld');
    });

    it('should remove control characters except newlines and tabs', () => {
      const input = 'Hello\x01\x02\x03World\nTest\tValue';
      const result = sanitizeText(input);
      expect(result).toBe('HelloWorld\nTest\tValue');
    });

    it('should handle empty string', () => {
      expect(sanitizeText('')).toBe('');
    });

    it('should handle null input', () => {
      expect(sanitizeText(null as any)).toBe('');
    });

    it('should preserve normal text', () => {
      const input = 'Hello World! This is a test.';
      const result = sanitizeText(input);
      expect(result).toBe(input);
    });
  });

  describe('extractTextFromPages', () => {
    it('should extract text from a range of pages', () => {
      const pageTexts: Record<number, string> = {
        1: 'Page 1 content',
        2: 'Page 2 content',
        3: 'Page 3 content',
        4: 'Page 4 content'
      };

      const result = extractTextFromPages(pageTexts, 1, 3);
      expect(result).toBe('Page 1 content\n\nPage 2 content\n\nPage 3 content');
    });

    it('should handle single page extraction', () => {
      const pageTexts: Record<number, string> = {
        1: 'Single page content'
      };

      const result = extractTextFromPages(pageTexts, 1, 1);
      expect(result).toBe('Single page content');
    });

    it('should skip missing pages', () => {
      const pageTexts: Record<number, string> = {
        1: 'Page 1',
        3: 'Page 3'
      };

      const result = extractTextFromPages(pageTexts, 1, 3);
      expect(result).toBe('Page 1\n\nPage 3');
    });

    it('should return empty string for no matching pages', () => {
      const pageTexts: Record<number, string> = {};
      const result = extractTextFromPages(pageTexts, 1, 5);
      expect(result).toBe('');
    });
  });

  describe('extractPdfTextFromBuffer', () => {
    it('should handle buffer input', async () => {
      // Create a minimal PDF buffer (not a real PDF, but should not throw)
      const mockPdfBuffer = Buffer.from('mock pdf content');

      // Mock the fetch call to Gemini API
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  text: 'Extracted text',
                  pages: [{ pageNumber: 1, text: 'Page 1' }],
                  totalPages: 1,
                  isScanned: false
                })
              }]
            }
          }]
        })
      });

      // Mock Secrets Manager to return API key
      const secretsManagerSend = require('@aws-sdk/client-secrets-manager').SecretsManagerClient.prototype.send as jest.Mock;
      secretsManagerSend.mockResolvedValueOnce({
        SecretString: JSON.stringify({ apiKey: 'test-key' })
      });

      const result = await extractPdfTextFromBuffer(mockPdfBuffer);
      
      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('totalPages');
      expect(result).toHaveProperty('pageTexts');
      expect(result).toHaveProperty('pageTextsIndexed');
    });
  });
});

describe('Text Sanitization Edge Cases', () => {
  it('should handle multiple consecutive null bytes', () => {
    const input = 'Test\x00\x00\x00Value';
    const result = sanitizeText(input);
    expect(result).toBe('TestValue');
  });

  it('should handle mixed valid and invalid characters', () => {
    const input = 'Title\x00: Chapter 1\n\x01Note\x02: Important\n';
    const result = sanitizeText(input);
    expect(result).toBe('Title: Chapter 1\nNote: Important\n');
  });

  it('should handle unicode characters', () => {
    const input = 'Héllo Wörld © 2024';
    const result = sanitizeText(input);
    expect(result).toBe('Héllo Wörld © 2024');
  });
});