/**
 * PDF Text Extractor using Gemini 3 Flash
 * 
 * Uses Gemini 3 Flash's native PDF understanding to extract text
 * from entire document in a single request (1M token context window).
 * 
 * Also includes fallback to pdf-parse with proper page tracking
 * and text sanitization (matching existing implementation).
 */

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { getLogger } from '/opt/nodejs/utils/logger';

const logger = getLogger('pdf-text-extractor');

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });

// Cache for Gemini API key to avoid Secrets Manager latency
let apiKeyCache: string | null = null;
let cacheExpiry: number = 0;

// ============================================
// Text Sanitization (from existing implementation)
// ============================================

/**
 * Sanitize text to remove null bytes and other invalid UTF-8 characters
 * that cause database encoding errors
 */
function sanitizeText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\x00/g, '')  // Remove null bytes
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');  // Remove control chars except \t, \n, \r
}

export interface PDFExtractionResult {
  text: string;
  totalPages: number;
  pageTexts: string[]; // 0-indexed array
  pageTextsIndexed: Record<number, string>; // 1-indexed Record
  metadata: {
    title?: string;
    author?: string;
    subject?: string;
    creator?: string;
    producer?: string;
    creationDate?: string;
  };
}

/**
 * Convert 0-indexed array to 1-indexed Record
 */
function arrayToIndexedRecord(pageTexts: string[]): Record<number, string> {
  const indexed: Record<number, string> = {};
  for (let i = 0; i < pageTexts.length; i++) {
    indexed[i + 1] = pageTexts[i];
  }
  return indexed;
}

// ============================================
// Secrets Manager with Caching
// ============================================

async function getGeminiApiKey(): Promise<string> {
  const now = Date.now();
  
  if (apiKeyCache && now < cacheExpiry) {
    return apiKeyCache;
  }

  const secretName = process.env.GEMINI_API_KEY_SECRET || 'stealth-aaas-gemini-api-key';
  
  try {
    const response = await secretsClient.send(new GetSecretValueCommand({
      SecretId: secretName,
    }));

    const secret = JSON.parse(response.SecretString || '{}');
    apiKeyCache = secret.apiKey || secret.GEMINI_API_KEY;
    cacheExpiry = now + 5 * 60 * 1000; // 5 minutes

    if (!apiKeyCache) {
      throw new Error('API key not found in secret');
    }

    logger.info('Retrieved Gemini API key from Secrets Manager');
    return apiKeyCache;
  } catch (error) {
    logger.error('Error retrieving Gemini API key from Secrets Manager', error as Error);
    throw error;
  }
}

// ============================================
// Main Extraction Functions
// ============================================

export async function extractPdfText(s3Bucket: string, s3Key: string): Promise<PDFExtractionResult> {
  logger.info('Starting PDF text extraction with Gemini 3 Flash', { s3Bucket, s3Key });

  try {
    // Download PDF from S3
    const getObjectCommand = new GetObjectCommand({
      Bucket: s3Bucket,
      Key: s3Key,
    });

    const response = await s3Client.send(getObjectCommand);
    const pdfBytes = await response.Body?.transformToByteArray();

    if (!pdfBytes) {
      throw new Error('Failed to download PDF from S3');
    }

    const pdfBuffer = Buffer.from(pdfBytes);
    const result = await extractPdfTextFromBuffer(pdfBuffer);
    
    logger.info('Text extraction complete', { 
      totalPages: result.totalPages, 
      textLength: result.text.length 
    });

    return result;
  } catch (error) {
    logger.error('Error extracting PDF text', error as Error);
    throw error;
  }
}

export async function extractPdfTextFromBuffer(pdfBuffer: Buffer): Promise<PDFExtractionResult> {
  logger.info('Starting PDF text extraction from buffer');

  try {
    // Try Gemini first for best accuracy
    const base64Pdf = pdfBuffer.toString('base64');
    const geminiResult = await extractWithGemini(base64Pdf);
    
    if (geminiResult.success) {
      return geminiResult.result;
    }
    
    // Fallback to pdf-parse if Gemini fails
    logger.warn('Gemini extraction failed, falling back to pdf-parse');
    return await extractWithPdfParse(pdfBuffer);
    
  } catch (error) {
    logger.error('All extraction methods failed', error as Error);
    // Final fallback to pdf-parse
    return await extractWithPdfParse(pdfBuffer);
  }
}

/**
 * Extract text using Gemini 3 Flash
 */
async function extractWithGemini(base64Pdf: string): Promise<{ success: boolean; result?: PDFExtractionResult }> {
  const apiKey = await getGeminiApiKey();
  const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview-0409:generateContent?key=${apiKey}`;

  const prompt = buildTextExtractionPrompt();

  try {
    const response = await fetch(geminiApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType: 'application/pdf', data: base64Pdf } },
              { text: prompt },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: 8192,
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const responseData = await response.json();
    const responseText = responseData.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!responseText) {
      throw new Error('Gemini returned empty response');
    }

    // Parse JSON response
    const cleanedText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleanedText) as {
      text: string;
      pages: Array<{ pageNumber: number; text: string }>;
      totalPages: number;
      isScanned: boolean;
    };

    // Convert to our format
    const pageTexts: string[] = [];
    const pageTextsIndexed: Record<number, string> = {};
    
    for (const page of parsed.pages || []) {
      const sanitized = sanitizeText(page.text);
      pageTexts[page.pageNumber - 1] = sanitized;
      pageTextsIndexed[page.pageNumber] = sanitized;
    }

    return {
      success: true,
      result: {
        text: sanitizeText(parsed.text || ''),
        totalPages: parsed.totalPages || pageTexts.length,
        pageTexts,
        pageTextsIndexed,
        metadata: {},
      },
    };
  } catch (error) {
    logger.error('Gemini extraction error', error as Error);
    return { success: false };
  }
}

/**
 * Fallback extraction using pdf-parse with proper page tracking
 */
async function extractWithPdfParse(buffer: Buffer): Promise<PDFExtractionResult> {
  logger.info('Using pdf-parse fallback extraction');

  try {
    const pdfjs = await import('pdf-parse');
    
    // Track text per page with custom renderer
    const pageTexts: string[] = [];

    const renderPage = (pageData: any) => {
      const textContent = pageData.getTextContent();
      return textContent.then((textItems: any) => {
        let pageText = '';
        let lastY: number | null = null;

        for (const item of textItems.items) {
          if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) {
            pageText += '\n';
          }
          pageText += item.str;
          lastY = item.transform[5];
        }

        const sanitized = sanitizeText(pageText);
        pageTexts.push(sanitized);
        return sanitized;
      });
    };

    const data = await pdfjs.default(buffer, { pagerender: renderPage });

    // Fallback if pageTexts is empty
    if (pageTexts.length === 0 && data.text) {
      const estimatedCharsPerPage = Math.ceil(data.text.length / data.numpages);
      for (let i = 0; i < data.numpages; i++) {
        const start = i * estimatedCharsPerPage;
        const end = Math.min((i + 1) * estimatedCharsPerPage, data.text.length);
        pageTexts.push(sanitizeText(data.text.slice(start, end)));
      }
    }

    const sanitizedPageTexts = pageTexts.map(sanitizeText);
    const sanitizedFullText = sanitizeText(data.text);

    return {
      text: sanitizedFullText,
      totalPages: data.numpages,
      pageTexts: sanitizedPageTexts,
      pageTextsIndexed: arrayToIndexedRecord(sanitizedPageTexts),
      metadata: {
        title: data.info?.Title,
        author: data.info?.Author,
        subject: data.info?.Subject,
        creator: data.info?.Creator,
        producer: data.info?.Producer,
        creationDate: data.info?.CreationDate,
      },
    };
  } catch (error) {
    logger.error('pdf-parse fallback also failed', error as Error);
    throw error;
  }
}

function buildTextExtractionPrompt(): string {
  return `You are a PDF text extraction engine. Extract ALL text from the attached PDF document.

TASK:
1. Read the entire PDF document
2. Extract all text content, preserving the logical reading order
3. Track which page each piece of text appears on (1-indexed)
4. Return structured JSON with the full text and per-page breakdown

OUTPUT FORMAT:
Return ONLY valid JSON (no markdown, no explanations):
{
  "text": "Complete extracted text with paragraphs preserved...",
  "pages": [
    { "pageNumber": 1, "text": "Text on page 1..." },
    { "pageNumber": 2, "text": "Text on page 2..." }
  ],
  "totalPages": 10,
  "isScanned": false
}

RULES:
- Preserve paragraph structure and line breaks
- Include all text content including headers and footers
- If the PDF is image-only (scanned), set isScanned to true
- Maximum 5000 characters per page text field
- Return empty arrays if no text found

Begin extraction now. Return ONLY the JSON.`;
}

// ============================================
// Page Range Helpers (matching existing implementation)
// ============================================

/**
 * Extract text from a specific range of pages (1-indexed, inclusive)
 */
export function extractTextFromPages(
  pageTextsIndexed: Record<number, string>,
  startPage: number,
  endPage: number
): string {
  const textParts: string[] = [];

  for (let page = startPage; page <= endPage; page++) {
    if (pageTextsIndexed[page]) {
      textParts.push(pageTextsIndexed[page]);
    }
  }

  return textParts.join('\n\n');
}

/**
 * Extract text from pages using 0-indexed array
 */
export function extractTextFromPageArray(
  pageTexts: string[],
  startPage: number,
  endPage: number
): string {
  const textParts: string[] = [];
  const startIdx = startPage - 1;
  const endIdx = endPage - 1;

  for (let i = startIdx; i <= endIdx && i < pageTexts.length; i++) {
    if (pageTexts[i]) {
      textParts.push(pageTexts[i]);
    }
  }

  return textParts.join('\n\n');
}

/**
 * Get text for a single page (1-indexed)
 */
export function getPageText(
  pageTextsIndexed: Record<number, string>,
  pageNumber: number
): string {
  return pageTextsIndexed[pageNumber] || '';
}

export default {
  extractPdfText,
  extractPdfTextFromBuffer,
  extractTextFromPages,
  extractTextFromPageArray,
  getPageText,
};