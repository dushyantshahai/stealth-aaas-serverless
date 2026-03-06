# Phase 13: Bedrock Knowledge Base Setup - Checklist

## Overview

Phase 13 consists of 6 tasks:
- **13.1-13.5**: Manual AWS console setup (requires user interaction)
- **13.6**: Code implementation (Knowledge Base query utility)

## Task 13.1: Create Bedrock Knowledge Base

**Status**: ⬜ Not Started

### Prerequisites
- [ ] AWS account with Bedrock access
- [ ] us-east-1 region selected
- [ ] Bedrock model access approved (Phase 1.5)

### Steps
- [ ] Navigate to Bedrock console
- [ ] Click "Knowledge bases" → "Create knowledge base"
- [ ] Enter name: `stealth-aaas-dev-kb`
- [ ] Select embedding model: Amazon Titan Embeddings G1 - Text
- [ ] Create service role
- [ ] Wait for Knowledge Base creation (2-5 minutes)
- [ ] Copy Knowledge Base ID

### Verification
- [ ] Knowledge Base status shows "Active"
- [ ] Knowledge Base ID format: `XXXXXXXXXX` (10 characters)
- [ ] Embedding model: amazon.titan-embed-text-v1

### Output
```
Knowledge Base ID: ___________________
Knowledge Base ARN: arn:aws:bedrock:us-east-1:ACCOUNT_ID:knowledge-base/KB_ID
```

---

## Task 13.2: Configure Knowledge Base Data Source

**Status**: ⬜ Not Started

### Prerequisites
- [ ] Task 13.1 completed
- [ ] S3 PDF bucket exists (Phase 5.1)
- [ ] PDF bucket name: `stealth-aaas-dev-pdfs-{account-id}`

### Steps
- [ ] Open Knowledge Base from console
- [ ] Click "Add data source"
- [ ] Select S3 as data source type
- [ ] Select PDF bucket: `stealth-aaas-dev-pdfs-{account-id}`
- [ ] Set inclusion patterns: `*.pdf`
- [ ] Leave exclusion patterns empty
- [ ] Click "Next"

### Verification
- [ ] Data source status shows "Ready"
- [ ] S3 bucket is accessible
- [ ] Inclusion patterns set to `*.pdf`

### Output
```
Data Source Type: S3
S3 Bucket: stealth-aaas-dev-pdfs-{account-id}
Status: Ready
```

---

## Task 13.3: Configure Chunking Strategy

**Status**: ⬜ Not Started

### Prerequisites
- [ ] Task 13.2 completed
- [ ] Data source is in "Ready" status

### Steps
- [ ] In Knowledge Base, go to "Chunking strategy"
- [ ] Select: Fixed-size chunking
- [ ] Set chunk size: 1000 tokens
- [ ] Set chunk overlap: 200 tokens
- [ ] Enable: Respect page boundaries
- [ ] Click "Save"

### Verification
- [ ] Chunking strategy: Fixed-size
- [ ] Chunk size: 1000 tokens
- [ ] Chunk overlap: 200 tokens
- [ ] Page boundaries: Respected

### Rationale
- **1000 tokens**: ~3-4 pages, fits in LLM context
- **200 tokens**: 20% overlap for continuity
- **Page boundaries**: Preserves document structure

---

## Task 13.4: Configure Vector Database

**Status**: ⬜ Not Started

### Prerequisites
- [ ] Task 13.3 completed
- [ ] OpenSearch Serverless service available

### Steps
- [ ] Verify OpenSearch Serverless collection created
- [ ] Collection name: `stealth-aaas-dev-kb-vectors`
- [ ] Go to collection settings
- [ ] Add access policy for Bedrock service
- [ ] Add access policy for Lambda execution role

### Verification
- [ ] Collection status: Active
- [ ] Vector dimension: 1536
- [ ] Index name: `stealth-aaas-dev-kb-index`
- [ ] Access policies configured

### IAM Policies Required

**Bedrock Service Policy**:
```json
{
  "Effect": "Allow",
  "Principal": {
    "Service": "bedrock.amazonaws.com"
  },
  "Action": "aoss:*",
  "Resource": "arn:aws:aoss:us-east-1:ACCOUNT_ID:collection/stealth-aaas-dev-kb-vectors"
}
```

**Lambda Execution Role Policy**:
```json
{
  "Effect": "Allow",
  "Action": [
    "bedrock-agent-runtime:Retrieve",
    "bedrock-agent-runtime:RetrieveAndGenerate"
  ],
  "Resource": "arn:aws:bedrock:us-east-1:ACCOUNT_ID:knowledge-base/*"
}
```

---

## Task 13.5: Test Document Indexing

**Status**: ⬜ Not Started

### Prerequisites
- [ ] Task 13.4 completed
- [ ] Test PDF file available
- [ ] AWS CLI configured

### Steps

#### Step 1: Upload Test PDF
```bash
export BUCKET_NAME=stealth-aaas-dev-pdfs-{account-id}
export KB_ID=<YOUR_KNOWLEDGE_BASE_ID>

aws s3 cp test-document.pdf \
  s3://${BUCKET_NAME}/institutes/test-institute/books/test-book/test-document.pdf
```

#### Step 2: Trigger Sync
- [ ] Go to Bedrock console
- [ ] Open your Knowledge Base
- [ ] Click "Sync" on the data source
- [ ] Wait for sync to complete (30-60 seconds)

#### Step 3: Verify Embeddings
```bash
aws opensearchserverless batch-get-collection-status \
  --names stealth-aaas-dev-kb-vectors \
  --region us-east-1
```

#### Step 4: Test Query
```bash
aws bedrock-agent-runtime retrieve \
  --knowledge-base-id ${KB_ID} \
  --text "What is the main topic?" \
  --retrieval-configuration vectorSearchConfiguration={numberOfResults=5} \
  --region us-east-1
```

### Verification
- [ ] PDF uploaded successfully
- [ ] Sync completed without errors
- [ ] Query returns 5 chunks
- [ ] Chunks contain document content
- [ ] Relevance scores between 0-1
- [ ] Source URIs point to S3

### Expected Query Response
```json
{
  "retrievalResults": [
    {
      "content": {
        "text": "Document content..."
      },
      "location": {
        "s3Location": {
          "uri": "s3://bucket/path/document.pdf"
        }
      },
      "score": 0.95
    }
  ]
}
```

---

## Task 13.6: Implement Knowledge Base Query Utility

**Status**: ✅ Completed

### Implementation Details

**File**: `lambda/layers/common/nodejs/clients/knowledge-base.ts`

**Functions Implemented**:
- ✅ `queryKnowledgeBase()` - Basic semantic search
- ✅ `queryKnowledgeBaseWithRetry()` - Retry with exponential backoff
- ✅ `formatChunksForPrompt()` - Format for prompt injection
- ✅ `extractMetadata()` - Extract metadata from results
- ✅ `isValidKnowledgeBaseId()` - Validate KB ID format

**Unit Tests**: `lambda/layers/common/nodejs/__tests__/knowledge-base.test.ts`
- ✅ 13 test cases
- ✅ 100% function coverage
- ✅ Error handling tests
- ✅ Retry logic tests

**Integration Tests**: `lambda/async/__tests__/knowledge-base-integration.test.ts`
- ✅ Real API query tests (requires KB_ID env var)
- ✅ Performance benchmarks
- ✅ Chunk formatting tests
- ✅ Metadata extraction tests

### Testing

**Run Unit Tests**:
```bash
npm test -- knowledge-base.test.ts
```

**Run Integration Tests** (requires BEDROCK_KNOWLEDGE_BASE_ID):
```bash
export BEDROCK_KNOWLEDGE_BASE_ID=<YOUR_KB_ID>
npm test -- knowledge-base-integration.test.ts
```

---

## Environment Configuration

### Add to `.env.dev`

```bash
# Bedrock Knowledge Base
BEDROCK_KNOWLEDGE_BASE_ID=<YOUR_KB_ID>
BEDROCK_REGION=us-east-1
BEDROCK_EMBEDDING_MODEL=amazon.titan-embed-text-v1

# OpenSearch Serverless
OPENSEARCH_COLLECTION_NAME=stealth-aaas-dev-kb-vectors
OPENSEARCH_INDEX_NAME=stealth-aaas-dev-kb-index
```

### Update Lambda Execution Role

Add to IAM policy:
```json
{
  "Effect": "Allow",
  "Action": [
    "bedrock-agent-runtime:Retrieve",
    "bedrock-agent-runtime:RetrieveAndGenerate"
  ],
  "Resource": "arn:aws:bedrock:us-east-1:*:knowledge-base/*"
}
```

---

## Documentation

### Files Created
- ✅ `docs/phase-13-knowledge-base-setup.md` - Overview and architecture
- ✅ `docs/phase-13-manual-setup-guide.md` - Step-by-step manual setup
- ✅ `docs/phase-13-checklist.md` - This checklist
- ✅ `cdk/lib/knowledge-base-stack.ts` - CDK infrastructure code

### Files Modified
- ✅ `lambda/layers/common/nodejs/clients/knowledge-base.ts` - Query utility
- ✅ `lambda/layers/common/nodejs/__tests__/knowledge-base.test.ts` - Unit tests
- ✅ `lambda/async/__tests__/knowledge-base-integration.test.ts` - Integration tests

---

## Completion Checklist

### Manual Setup (Tasks 13.1-13.5)
- [ ] Task 13.1: Knowledge Base created
- [ ] Task 13.2: Data source configured
- [ ] Task 13.3: Chunking strategy set
- [ ] Task 13.4: Vector database configured
- [ ] Task 13.5: Document indexing tested

### Code Implementation (Task 13.6)
- [ ] Task 13.6: Query utility implemented
- [ ] Unit tests passing
- [ ] Integration tests passing (if KB configured)
- [ ] Code committed to GitHub

### Environment Setup
- [ ] `.env.dev` updated with KB_ID
- [ ] Lambda execution role updated
- [ ] IAM policies configured

### Documentation
- [ ] Manual setup guide reviewed
- [ ] Architecture documented
- [ ] Troubleshooting guide available
- [ ] Cost estimation documented

---

## Performance Benchmarks

**Expected Performance**:
- Query latency: < 2 seconds
- Chunk retrieval: < 1 second
- Embedding generation: < 30 seconds per document
- Vector search: < 500ms for 5 results

**Monitoring**:
- [ ] Query times logged
- [ ] Error rates monitored
- [ ] Cost tracked

---

## Troubleshooting

### Common Issues

**Knowledge Base creation fails**
- [ ] Check Bedrock model access (Phase 1.5)
- [ ] Verify IAM permissions
- [ ] Ensure us-east-1 region
- [ ] Try again after 5 minutes

**Data source sync not starting**
- [ ] Verify S3 bucket exists
- [ ] Check S3 permissions
- [ ] Ensure PDF files present
- [ ] Wait for "Ready" status

**Query returns no results**
- [ ] Verify PDF uploaded
- [ ] Check sync completed
- [ ] Verify PDF is valid
- [ ] Try different query

**Slow query performance**
- [ ] Check OpenSearch capacity
- [ ] Reduce results requested
- [ ] Verify network connectivity
- [ ] Check CloudWatch logs

---

## Next Steps

After Phase 13 completion:

1. **Phase 14: MCQ Generation**
   - Implement MCQ generation Lambda
   - Use Knowledge Base for context
   - Model fallback logic

2. **Phase 15: Integration Testing**
   - End-to-end PDF → MCQ pipeline
   - Performance testing
   - Cost optimization

3. **Phase 16: Deployment**
   - Deploy to staging
   - Deploy to production
   - Monitor and optimize

---

## References

- [AWS Bedrock Knowledge Base](https://docs.aws.amazon.com/bedrock/latest/userguide/knowledge-base.html)
- [OpenSearch Serverless](https://docs.aws.amazon.com/opensearch-service/latest/developerguide/serverless.html)
- [Titan Embeddings](https://docs.aws.amazon.com/bedrock/latest/userguide/embeddings.html)
- [Bedrock API Reference](https://docs.aws.amazon.com/bedrock/latest/APIReference/)

---

## Support

For issues or questions:
1. Check troubleshooting guide
2. Review AWS documentation
3. Check CloudWatch logs
4. Contact AWS support

**Last Updated**: 2026-03-06
**Phase Status**: In Progress
