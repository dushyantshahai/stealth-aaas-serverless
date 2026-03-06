# Phase 13: Bedrock Knowledge Base Setup

## Overview

Phase 13 sets up AWS Bedrock Knowledge Base for RAG (Retrieval-Augmented Generation) capabilities. The Knowledge Base will index PDF documents and enable semantic search for MCQ generation and other AI-powered features.

## Architecture

```
PDF Documents (S3)
        ↓
    [S3 Bucket]
        ↓
[Bedrock Knowledge Base]
        ↓
[Amazon OpenSearch Serverless]
        ↓
[Vector Embeddings - Titan Embeddings G1]
        ↓
[Query Interface - Lambda Layer]
```

## Tasks Overview

### 13.1: Create Bedrock Knowledge Base
**Manual AWS Console Task**

Steps:
1. Navigate to AWS Bedrock console in us-east-1
2. Go to Knowledge Bases section
3. Click "Create Knowledge Base"
4. Configure:
   - Name: `stealth-aaas-{env}-kb` (e.g., `stealth-aaas-dev-kb`)
   - Description: "Knowledge Base for Stealth AaaS PDF documents"
5. Select embedding model: **Amazon Titan Embeddings G1 - Text**
6. Click "Create"

**Output**: Knowledge Base ID (format: `[A-Z0-9]{10}`)

### 13.2: Configure Knowledge Base Data Source
**Manual AWS Console Task**

Steps:
1. In the Knowledge Base, go to "Data sources"
2. Click "Add data source"
3. Configure:
   - Data source type: S3
   - S3 bucket: `stealth-aaas-{env}-pdfs-{account-id}`
   - Inclusion patterns: `*.pdf`
   - Exclusion patterns: (leave empty)
   - Sync schedule: Manual (for dev), Automatic (for prod)
4. Click "Add data source"

**Configuration Details**:
- **Inclusion patterns**: `*.pdf` - Only index PDF files
- **Exclusion patterns**: Leave empty to include all PDFs
- **Sync schedule**: 
  - Dev: Manual (sync on demand)
  - Prod: Automatic (sync every 24 hours)
- **Metadata extraction**: Enable to extract document metadata

### 13.3: Configure Chunking Strategy
**Manual AWS Console Task**

Steps:
1. In the Knowledge Base, go to "Chunking strategy"
2. Select: **Fixed-size chunking**
3. Configure:
   - Chunk size: **1000 tokens**
   - Chunk overlap: **200 tokens**
   - Respect page boundaries: **Enabled**
4. Click "Save"

**Rationale**:
- **1000 tokens**: Balances context window with specificity
- **200 tokens overlap**: Ensures continuity between chunks
- **Page boundaries**: Preserves document structure

### 13.4: Configure Vector Database
**Manual AWS Console Task**

Steps:
1. In the Knowledge Base, go to "Vector database"
2. Select: **Amazon OpenSearch Serverless** (default)
3. Configure:
   - Collection name: `stealth-aaas-{env}-kb-vectors`
   - Vector dimension: 1536 (Titan Embeddings G1)
   - Index name: `stealth-aaas-{env}-kb-index`
4. Click "Create"

**Access Policies**:
- Allow Bedrock service to read/write vectors
- Allow Lambda functions to query vectors
- Restrict public access

### 13.5: Test Document Indexing
**Manual Testing Task**

Steps:
1. Upload test PDF to S3:
   ```bash
   aws s3 cp test-document.pdf \
     s3://stealth-aaas-dev-pdfs/institutes/test/books/test-book/
   ```

2. Trigger Knowledge Base sync:
   - Go to Knowledge Base console
   - Click "Sync" on the data source
   - Wait for sync to complete (typically 30-60 seconds)

3. Verify embeddings generated:
   - Check OpenSearch Serverless collection
   - Verify document count increased

4. Test query:
   ```bash
   aws bedrock-agent-runtime retrieve \
     --knowledge-base-id <KB_ID> \
     --text "What is the main topic of this document?" \
     --retrieval-configuration vectorSearchConfiguration={numberOfResults=5}
   ```

5. Verify results:
   - Should return 5 most relevant chunks
   - Each chunk should have relevance score
   - Chunks should be from the uploaded document

### 13.6: Implement Knowledge Base Query Utility
**Code Implementation Task**

File: `lambda/layers/common/nodejs/clients/knowledge-base.ts`

**Features**:
- Query Knowledge Base with semantic search
- Retry logic with exponential backoff
- Format chunks for prompt injection
- Extract metadata from results
- Validate Knowledge Base IDs

**Key Functions**:

```typescript
// Basic query
const result = await queryKnowledgeBase(
  knowledgeBaseId,
  "What are the main topics?",
  { maxResults: 5 }
);

// Query with retry
const result = await queryKnowledgeBaseWithRetry(
  knowledgeBaseId,
  "What are the main topics?",
  3, // max retries
  { maxResults: 5 }
);

// Format for prompts
const context = formatChunksForPrompt(result.chunks, 5);

// Extract metadata
const metadata = extractMetadata(result.chunks);
```

**Response Format**:
```typescript
{
  chunks: [
    {
      content: "Chunk text content...",
      source: "s3://bucket/path/document.pdf",
      metadata: { pageNumber: 1, ... },
      score: 0.95
    }
  ],
  totalChunks: 5,
  queryTime: 234 // milliseconds
}
```

## Environment Variables

Add to `.env.{env}`:

```bash
# Bedrock Knowledge Base
BEDROCK_KNOWLEDGE_BASE_ID=XXXXXXXXXX
BEDROCK_REGION=us-east-1
BEDROCK_EMBEDDING_MODEL=amazon.titan-embed-text-v1
```

## Testing Checklist

- [ ] Knowledge Base created in AWS console
- [ ] Data source configured with S3 bucket
- [ ] Chunking strategy set to 1000 tokens with 200 overlap
- [ ] Vector database (OpenSearch Serverless) created
- [ ] Test PDF uploaded and indexed
- [ ] Knowledge Base query returns relevant chunks
- [ ] Query utility implemented and tested
- [ ] Retry logic working with exponential backoff
- [ ] Metadata extraction working correctly
- [ ] Error handling for invalid Knowledge Base IDs

## Performance Benchmarks

Expected performance:
- Query latency: < 2 seconds for typical queries
- Chunk retrieval: < 1 second
- Embedding generation: < 30 seconds per document
- Vector search: < 500ms for 5 results

## Cost Considerations

**Bedrock Knowledge Base Pricing**:
- Embedding generation: $0.02 per 1M tokens
- Vector search: $0.25 per 1M queries
- OpenSearch Serverless: Pay-per-request pricing

**Optimization Tips**:
- Use batch indexing for multiple documents
- Cache frequently used queries
- Implement query result caching (5-minute TTL)
- Monitor query patterns to optimize chunking

## Troubleshooting

### Knowledge Base not returning results
- Verify data source is synced
- Check S3 bucket permissions
- Verify PDF files are valid
- Check chunking strategy settings

### Slow query performance
- Increase chunk size (may reduce precision)
- Reduce number of results requested
- Check OpenSearch Serverless capacity
- Monitor network latency

### Embedding generation failures
- Verify Bedrock model access
- Check IAM permissions
- Verify S3 bucket accessibility
- Check document file sizes

## Next Steps

After Phase 13 completion:
1. Phase 14: MCQ Generation Lambda Functions
2. Phase 14.2: Knowledge Base retrieval for MCQ context
3. Phase 14.3: MCQ generation with model fallback

## References

- [AWS Bedrock Knowledge Base Documentation](https://docs.aws.amazon.com/bedrock/latest/userguide/knowledge-base.html)
- [Amazon OpenSearch Serverless](https://docs.aws.amazon.com/opensearch-service/latest/developerguide/serverless.html)
- [Titan Embeddings Model](https://docs.aws.amazon.com/bedrock/latest/userguide/embeddings.html)
