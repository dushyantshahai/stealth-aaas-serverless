# Phase 13: Manual AWS Console Setup Guide

This guide walks through the manual AWS console tasks for Phase 13 (tasks 13.1-13.5). These must be completed before the Knowledge Base query utility can be tested.

## Prerequisites

- AWS account with appropriate permissions
- Access to AWS Bedrock console
- PDF bucket created (from Phase 5)
- Bedrock model access requested (from Phase 1.5)

## Task 13.1: Create Bedrock Knowledge Base

### Step-by-Step Instructions

1. **Navigate to Bedrock Console**
   - Go to https://console.aws.amazon.com/bedrock/
   - Ensure you're in **us-east-1** region
   - Click on "Knowledge bases" in the left sidebar

2. **Create New Knowledge Base**
   - Click "Create knowledge base" button
   - Choose "Create a new knowledge base"

3. **Configure Knowledge Base Details**
   - **Name**: `stealth-aaas-dev-kb` (or `stealth-aaas-staging-kb`, `stealth-aaas-prod-kb`)
   - **Description**: "Knowledge Base for Stealth AaaS PDF documents and educational content"
   - **IAM permissions**: Select "Create and use a new service role"
   - Click "Next"

4. **Select Embedding Model**
   - Choose **Amazon Titan Embeddings G1 - Text**
   - This model provides 1536-dimensional embeddings
   - Click "Next"

5. **Configure Vector Database**
   - Select **Amazon OpenSearch Serverless** (default)
   - Collection name: `stealth-aaas-dev-kb-vectors`
   - Index name: `stealth-aaas-dev-kb-index`
   - Click "Create knowledge base"

6. **Wait for Creation**
   - Knowledge Base creation takes 2-5 minutes
   - Status will show "Creating" then "Active"
   - Note the **Knowledge Base ID** (format: `XXXXXXXXXX`)

### Output to Save

```
Knowledge Base ID: [COPY THIS]
Knowledge Base Name: stealth-aaas-dev-kb
Embedding Model: amazon.titan-embed-text-v1
Vector Database: Amazon OpenSearch Serverless
Collection Name: stealth-aaas-dev-kb-vectors
```

Add to `.env.dev`:
```bash
BEDROCK_KNOWLEDGE_BASE_ID=<KNOWLEDGE_BASE_ID>
```

---

## Task 13.2: Configure Knowledge Base Data Source

### Step-by-Step Instructions

1. **Open Knowledge Base**
   - Go to Bedrock console → Knowledge bases
   - Click on your newly created Knowledge Base

2. **Add Data Source**
   - Click "Add data source" button
   - Select **S3** as data source type

3. **Configure S3 Bucket**
   - **S3 bucket**: Select `stealth-aaas-dev-pdfs-{account-id}`
   - **S3 bucket path**: Leave empty (to include all PDFs)
   - **Inclusion patterns**: `*.pdf`
   - **Exclusion patterns**: Leave empty
   - Click "Next"

4. **Configure Chunking Strategy**
   - **Chunking strategy**: Fixed-size chunking
   - **Chunk size**: 1000 tokens
   - **Chunk overlap**: 200 tokens
   - **Respect page boundaries**: Enabled
   - Click "Next"

5. **Configure Sync Schedule**
   - **Sync schedule**: Manual (for dev environment)
   - For production, select "Automatic" with 24-hour interval
   - Click "Add data source"

6. **Verify Data Source**
   - Status should show "Ready"
   - You can now manually sync documents

### Configuration Summary

```
Data Source Type: S3
S3 Bucket: stealth-aaas-dev-pdfs-{account-id}
Inclusion Patterns: *.pdf
Exclusion Patterns: (none)
Chunking Strategy: Fixed-size
Chunk Size: 1000 tokens
Chunk Overlap: 200 tokens
Respect Page Boundaries: Yes
Sync Schedule: Manual
```

---

## Task 13.3: Configure Chunking Strategy

### Rationale for Settings

**Chunk Size: 1000 tokens**
- Balances context window with specificity
- Typical PDF page ≈ 250-300 tokens
- 1000 tokens ≈ 3-4 pages of content
- Fits within most LLM context windows

**Chunk Overlap: 200 tokens**
- Ensures continuity between chunks
- Prevents losing context at chunk boundaries
- 20% overlap is industry standard

**Respect Page Boundaries: Enabled**
- Preserves document structure
- Prevents splitting content across pages
- Maintains semantic coherence

### Verification

After configuration:
1. Go to Knowledge Base settings
2. Verify "Chunking strategy" shows:
   - Strategy: Fixed-size chunking
   - Chunk size: 1000 tokens
   - Chunk overlap: 200 tokens
   - Page boundaries: Respected

---

## Task 13.4: Configure Vector Database

### Step-by-Step Instructions

1. **Vector Database Configuration**
   - Knowledge Base automatically creates OpenSearch Serverless collection
   - Collection name: `stealth-aaas-dev-kb-vectors`
   - Vector dimension: 1536 (Titan Embeddings G1)

2. **Verify Collection Created**
   - Go to OpenSearch Serverless console
   - Check "Collections" section
   - Verify `stealth-aaas-dev-kb-vectors` exists
   - Status should be "Active"

3. **Configure Access Policies**
   - Go to collection settings
   - Add access policy for Bedrock service:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Principal": {
           "Service": "bedrock.amazonaws.com"
         },
         "Action": "aoss:*",
         "Resource": "arn:aws:aoss:us-east-1:ACCOUNT_ID:collection/stealth-aaas-dev-kb-vectors"
       }
     ]
   }
   ```

4. **Verify Lambda Access**
   - Lambda execution role needs permissions:
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

### Configuration Summary

```
Vector Database: Amazon OpenSearch Serverless
Collection Name: stealth-aaas-dev-kb-vectors
Vector Dimension: 1536
Index Name: stealth-aaas-dev-kb-index
Status: Active
```

---

## Task 13.5: Test Document Indexing

### Step 1: Prepare Test PDF

Create a simple test PDF or use an existing one:
```bash
# Example: Create a test PDF with sample content
# You can use any PDF file for testing
ls stealth-aaas-serverless/lambda/async/__tests__/
```

### Step 2: Upload Test PDF to S3

```bash
# Set environment variables
export AWS_REGION=us-east-1
export BUCKET_NAME=stealth-aaas-dev-pdfs-{account-id}

# Upload test PDF
aws s3 cp test-document.pdf \
  s3://${BUCKET_NAME}/institutes/test-institute/books/test-book/test-document.pdf \
  --region ${AWS_REGION}

# Verify upload
aws s3 ls s3://${BUCKET_NAME}/institutes/test-institute/books/test-book/ \
  --region ${AWS_REGION}
```

### Step 3: Trigger Knowledge Base Sync

```bash
# Get Knowledge Base ID
export KB_ID=<YOUR_KNOWLEDGE_BASE_ID>

# Trigger sync (via AWS console or CLI)
# Note: CLI sync is not directly available, use console:
# 1. Go to Bedrock console
# 2. Click on your Knowledge Base
# 3. Click "Sync" on the data source
# 4. Wait for sync to complete (30-60 seconds)
```

### Step 4: Verify Embeddings Generated

```bash
# Check OpenSearch collection for documents
aws opensearchserverless batch-get-collection-status \
  --names stealth-aaas-dev-kb-vectors \
  --region us-east-1

# Expected output should show collection is active
```

### Step 5: Test Knowledge Base Query

```bash
# Query the Knowledge Base
aws bedrock-agent-runtime retrieve \
  --knowledge-base-id ${KB_ID} \
  --text "What is the main topic of this document?" \
  --retrieval-configuration vectorSearchConfiguration={numberOfResults=5} \
  --region us-east-1
```

### Expected Response

```json
{
  "retrievalResults": [
    {
      "content": {
        "text": "Document content chunk..."
      },
      "location": {
        "s3Location": {
          "uri": "s3://bucket/path/document.pdf"
        }
      },
      "metadata": {
        "pageNumber": 1
      },
      "score": 0.95
    }
  ]
}
```

### Verification Checklist

- [ ] PDF uploaded to S3 successfully
- [ ] Knowledge Base sync completed
- [ ] OpenSearch collection shows active status
- [ ] Query returns 5 chunks with relevance scores
- [ ] Chunks contain content from uploaded PDF
- [ ] Scores are between 0 and 1
- [ ] Source URIs point to correct S3 location

---

## Troubleshooting

### Knowledge Base Creation Failed

**Problem**: "Failed to create Knowledge Base"

**Solutions**:
1. Verify Bedrock model access (Phase 1.5)
2. Check IAM permissions for service role
3. Ensure us-east-1 region is selected
4. Try again after 5 minutes

### Data Source Sync Not Starting

**Problem**: "Sync button is disabled"

**Solutions**:
1. Verify S3 bucket exists and is accessible
2. Check S3 bucket permissions
3. Ensure PDF files are in correct location
4. Wait for data source to reach "Ready" status

### Query Returns No Results

**Problem**: "retrievalResults is empty"

**Solutions**:
1. Verify PDF was uploaded to correct S3 path
2. Check sync completed successfully
3. Verify PDF file is valid (not corrupted)
4. Try with different query text
5. Check OpenSearch collection has documents

### Slow Query Performance

**Problem**: "Query takes > 5 seconds"

**Solutions**:
1. Check OpenSearch collection capacity
2. Reduce number of results requested
3. Verify network connectivity
4. Check CloudWatch logs for errors

---

## Environment Setup

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

## Next Steps

After completing all manual tasks (13.1-13.5):

1. **Test Knowledge Base Query Utility**
   ```bash
   npm test -- knowledge-base.test.ts
   ```

2. **Verify Integration**
   - Run E2E tests with real Knowledge Base
   - Test query performance
   - Verify error handling

3. **Proceed to Phase 14**
   - MCQ Generation Lambda Functions
   - Knowledge Base retrieval for context
   - Model fallback logic

---

## Cost Estimation

**Monthly costs for dev environment**:
- Bedrock embeddings: ~$0.50 (1M tokens)
- OpenSearch Serverless: ~$5-10 (pay-per-request)
- S3 storage: ~$1-5 (depending on PDF size)
- **Total**: ~$10-20/month

**Optimization tips**:
- Use manual sync to avoid unnecessary indexing
- Cache query results (5-minute TTL)
- Monitor query patterns
- Archive old documents

---

## Support & Documentation

- [AWS Bedrock Knowledge Base Docs](https://docs.aws.amazon.com/bedrock/latest/userguide/knowledge-base.html)
- [OpenSearch Serverless Guide](https://docs.aws.amazon.com/opensearch-service/latest/developerguide/serverless.html)
- [Titan Embeddings Model](https://docs.aws.amazon.com/bedrock/latest/userguide/embeddings.html)
- [Bedrock API Reference](https://docs.aws.amazon.com/bedrock/latest/APIReference/)
