# Phase 12.7: PDF Processing Workflow End-to-End Testing

## Overview

This document outlines the end-to-end testing strategy for the PDF processing workflow, validating the complete pipeline from S3 upload to DynamoDB storage.

## Testing Scope

The E2E tests validate:
1. ✅ PDF upload to S3 triggers SQS message
2. ✅ Lambda processes PDF from SQS queue
3. ✅ Text extraction using Gemini 3 Flash
4. ✅ TOC extraction and storage in DynamoDB
5. ✅ Page-aware chunking with 3-priority logic
6. ✅ Book status updated to "PROCESSED"
7. ✅ Error handling and graceful failures
8. ✅ Batch processing of multiple PDFs
9. ✅ Message deletion from SQS after success
10. ✅ Message retention on failure (for retry)

## Test Files

### Unit Tests
- `lambda/async/__tests__/pdf-text-extractor.test.ts` - Text extraction logic
- `lambda/async/__tests__/toc-extractor.test.ts` - TOC extraction logic
- `lambda/async/__tests__/text-chunker.test.ts` - Chunking logic
- `lambda/async/__tests__/pdf-processor.test.ts` - Processor orchestration

### Integration Tests
- `lambda/async/__tests__/pdf-processing-e2e.test.ts` - Complete workflow

## Running Tests

### Run all tests
```bash
cd stealth-aaas-serverless
npm test
```

### Run specific test suite
```bash
npm test -- pdf-processing-e2e.test.ts
```

### Run with coverage
```bash
npm test -- --coverage
```

### Run in watch mode
```bash
npm test -- --watch
```

## Test Scenarios

### Scenario 1: Successful PDF Processing
**Input**: Valid PDF file uploaded to S3
**Expected Output**:
- S3 event triggers SQS message
- Lambda processes PDF successfully
- TOC extracted with chapters, topics, subtopics
- Text chunks created with 3-priority logic
- Book status updated to "PROCESSED"
- Message deleted from SQS

### Scenario 2: Native Text PDF
**Input**: PDF with extractable text (not scanned)
**Expected Output**:
- Text extracted using Gemini 3 Flash
- Page information preserved
- Chunks created with accurate page references
- Processing completes within timeout

### Scenario 3: Scanned PDF
**Input**: Scanned PDF (image-based)
**Expected Output**:
- Gemini 3 Flash processes as image
- OCR-like extraction performed
- Chunks created with best-effort page mapping
- Processing completes within timeout

### Scenario 4: Processing Error
**Input**: Invalid PDF or S3 access error
**Expected Output**:
- Error caught and logged
- Book status updated to "FAILED"
- Error message stored in DynamoDB
- Message retained in SQS (not deleted) for retry
- Lambda returns graceful error response

### Scenario 5: Batch Processing
**Input**: Multiple PDFs in single SQS batch
**Expected Output**:
- Each PDF processed independently
- Results aggregated in response
- Failed PDFs don't block successful ones
- Metrics calculated for each PDF

## Test Coverage

Current coverage targets:
- **Unit Tests**: 80%+ code coverage
- **Integration Tests**: All critical paths covered
- **E2E Tests**: Complete workflow validation

## Metrics Validation

Each successful processing should return:
```json
{
  "totalPages": 2,
  "totalChunks": 5,
  "chaptersCount": 2,
  "topicsCount": 2,
  "subtopicsCount": 1
}
```

## Performance Benchmarks

Expected performance metrics:
- Text extraction: < 10 seconds per 100 pages
- TOC extraction: < 5 seconds per document
- Chunking: < 2 seconds per 1000 tokens
- Total processing: < 30 seconds per document (Lambda timeout: 300s)

## Local Testing with LocalStack

### Setup LocalStack
```bash
docker-compose up -d
```

### Deploy to LocalStack
```bash
cdklocal deploy
```

### Upload test PDF
```bash
aws s3 cp test.pdf s3://stealth-aaas-dev-pdfs/institutes/test/books/book-1/ \
  --endpoint-url http://localhost:4566
```

### Verify SQS message
```bash
aws sqs receive-message \
  --queue-url http://localhost:4566/000000000000/stealth-aaas-dev-pdf-processing \
  --endpoint-url http://localhost:4566
```

### Invoke Lambda locally
```bash
sam local invoke PdfProcessorFunction --event test-event.json
```

## Debugging

### Enable debug logging
```bash
export LOG_LEVEL=DEBUG
npm test
```

### Check DynamoDB records
```bash
aws dynamodb scan --table-name stealth-aaas-dev-books \
  --endpoint-url http://localhost:4566
```

### Monitor Lambda execution
```bash
aws logs tail /aws/lambda/stealth-aaas-dev-pdf-processor --follow \
  --endpoint-url http://localhost:4566
```

## Known Limitations

1. **Gemini API Key**: Tests mock Gemini API calls. Real integration requires valid API key in Secrets Manager.
2. **Large PDFs**: Tests use small mock PDFs. Real 400-500 page PDFs should be tested separately.
3. **Scanned PDFs**: OCR accuracy depends on PDF quality. Test with various PDF types.

## Next Steps

After Phase 12.7 completion:
1. Phase 13: Bedrock Knowledge Base Setup
2. Phase 13.5: Test document indexing
3. Phase 13.6: Implement Knowledge Base query utility

## Checklist

- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] E2E tests passing
- [ ] Code coverage > 80%
- [ ] LocalStack testing completed
- [ ] Performance benchmarks met
- [ ] Error scenarios validated
- [ ] Batch processing verified
- [ ] Metrics accuracy confirmed
- [ ] Documentation updated
