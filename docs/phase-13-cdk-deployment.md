# Phase 13: CDK Deployment Guide

## Overview

This guide explains how to deploy the Bedrock Knowledge Base using AWS CDK. The CDK stack automates all manual tasks (13.1-13.5) from Phase 13.

## What Gets Deployed

The CDK stack automatically creates:

1. **Bedrock Knowledge Base**
   - Name: `stealth-aaas-{env}-kb`
   - Embedding model: Amazon Titan Embeddings G1 - Text
   - Vector dimension: 1536

2. **OpenSearch Serverless Collection**
   - Name: `stealth-aaas-{env}-kb-vectors`
   - Type: VECTORSEARCH
   - Automatically configured for Knowledge Base

3. **S3 Data Source**
   - Bucket: `stealth-aaas-{env}-pdfs-{account-id}`
   - Inclusion patterns: `*.pdf`
   - Chunking: 1000 tokens with 200 token overlap

4. **IAM Roles and Policies**
   - Knowledge Base service role
   - Custom resource Lambda execution role
   - Proper permissions for S3, OpenSearch, and Bedrock

## Prerequisites

### AWS Account Setup
- [ ] AWS account with appropriate permissions
- [ ] AWS CLI configured with credentials
- [ ] Region set to us-east-1
- [ ] Bedrock model access approved (Phase 1.5)

### Local Setup
- [ ] Node.js 20.x installed
- [ ] AWS CDK CLI installed: `npm install -g aws-cdk`
- [ ] Project dependencies installed: `npm install`

### Verify Prerequisites

```bash
# Check AWS CLI
aws sts get-caller-identity

# Check CDK
cdk --version

# Check Node.js
node --version

# Check AWS region
aws configure get region
# Should output: us-east-1
```

## Deployment Steps

### Step 1: Bootstrap CDK (First Time Only)

```bash
cd stealth-aaas-serverless

# Bootstrap CDK in your AWS account
cdk bootstrap aws://ACCOUNT_ID/us-east-1

# Replace ACCOUNT_ID with your AWS account ID
# You can get it from: aws sts get-caller-identity --query Account
```

### Step 2: Synthesize CDK Stack

```bash
# Generate CloudFormation template
cdk synth -c stage=dev

# This creates cdk.out/ directory with CloudFormation templates
```

### Step 3: Review Changes

```bash
# See what will be deployed
cdk diff -c stage=dev

# This shows:
# - Resources to be created
# - IAM policy changes
# - Other modifications
```

### Step 4: Deploy Stack

```bash
# Deploy the Knowledge Base stack
cdk deploy -c stage=dev

# You'll be prompted to approve IAM changes
# Review and type 'y' to proceed
```

### Step 5: Wait for Deployment

The deployment takes approximately **5-10 minutes**:

1. **Lambda function creation** (1-2 min)
2. **OpenSearch collection creation** (2-3 min)
3. **Knowledge Base creation** (2-3 min)
4. **Data source configuration** (1-2 min)

Monitor progress in the terminal or AWS CloudFormation console.

### Step 6: Verify Deployment

```bash
# Get stack outputs
cdk output -c stage=dev

# Or use AWS CLI
aws cloudformation describe-stacks \
  --stack-name stealth-aaas-dev-kb \
  --query 'Stacks[0].Outputs' \
  --region us-east-1
```

Expected outputs:
```
KnowledgeBaseId: XXXXXXXXXX
KnowledgeBaseArn: arn:aws:bedrock:us-east-1:ACCOUNT_ID:knowledge-base/XXXXXXXXXX
DataSourceId: XXXXXXXXXX
OpenSearchCollectionName: stealth-aaas-dev-kb-vectors
ServiceRoleArn: arn:aws:iam::ACCOUNT_ID:role/stealth-aaas-dev-kb-service-role
```

## Configuration

### Environment Variables

Add to `.env.dev`:

```bash
# Get these from CDK outputs
BEDROCK_KNOWLEDGE_BASE_ID=<KnowledgeBaseId from output>
BEDROCK_REGION=us-east-1
BEDROCK_EMBEDDING_MODEL=amazon.titan-embed-text-v1
OPENSEARCH_COLLECTION_NAME=stealth-aaas-dev-kb-vectors
OPENSEARCH_INDEX_NAME=stealth-aaas-dev-kb-index
```

### Update Lambda Execution Role

The CDK stack creates the Knowledge Base service role, but Lambda functions need permissions to query it.

Add to your Lambda execution role policy:

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

## Testing Deployment

### Test 1: Verify Knowledge Base Created

```bash
# Get Knowledge Base ID from outputs
export KB_ID=<KnowledgeBaseId>

# Describe Knowledge Base
aws bedrock describe-knowledge-base \
  --knowledge-base-id ${KB_ID} \
  --region us-east-1
```

Expected response:
```json
{
  "knowledgeBase": {
    "knowledgeBaseId": "XXXXXXXXXX",
    "name": "stealth-aaas-dev-kb",
    "status": "ACTIVE",
    "embeddingModelArn": "arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v1"
  }
}
```

### Test 2: Verify Data Source Created

```bash
# List data sources
aws bedrock list-data-sources \
  --knowledge-base-id ${KB_ID} \
  --region us-east-1
```

Expected response:
```json
{
  "dataSourceSummaries": [
    {
      "dataSourceId": "XXXXXXXXXX",
      "name": "stealth-aaas-dev-pdf-source",
      "status": "AVAILABLE"
    }
  ]
}
```

### Test 3: Verify OpenSearch Collection

```bash
# List OpenSearch collections
aws opensearchserverless list-collections \
  --region us-east-1
```

Expected response should include:
```json
{
  "collectionSummaries": [
    {
      "name": "stealth-aaas-dev-kb-vectors",
      "status": "ACTIVE"
    }
  ]
}
```

### Test 4: Upload Test PDF and Query

```bash
# Upload test PDF
aws s3 cp test-document.pdf \
  s3://stealth-aaas-dev-pdfs-{account-id}/institutes/test/books/test-book/

# Trigger data source sync (via console or wait for automatic sync)

# Query Knowledge Base
aws bedrock-agent-runtime retrieve \
  --knowledge-base-id ${KB_ID} \
  --text "What is the main topic?" \
  --retrieval-configuration vectorSearchConfiguration={numberOfResults=5} \
  --region us-east-1
```

## Troubleshooting

### Deployment Fails: "Access Denied"

**Problem**: CDK deployment fails with access denied errors

**Solutions**:
1. Verify AWS credentials: `aws sts get-caller-identity`
2. Check IAM permissions for Bedrock, OpenSearch, Lambda
3. Ensure region is us-east-1: `aws configure get region`
4. Try again with explicit credentials: `AWS_PROFILE=your-profile cdk deploy`

### Deployment Fails: "Bedrock Model Not Available"

**Problem**: "Foundation model not available"

**Solutions**:
1. Verify Bedrock model access (Phase 1.5)
2. Check region is us-east-1
3. Request model access in Bedrock console
4. Wait 24-48 hours for approval

### Knowledge Base Creation Timeout

**Problem**: Deployment times out during Knowledge Base creation

**Solutions**:
1. Check CloudFormation events in AWS console
2. Verify Lambda function logs in CloudWatch
3. Increase Lambda timeout (currently 15 minutes)
4. Try deployment again

### OpenSearch Collection Not Created

**Problem**: OpenSearch collection not appearing

**Solutions**:
1. Check Lambda function logs for errors
2. Verify IAM permissions for OpenSearch
3. Check AWS service quotas for OpenSearch
4. Try manual creation in OpenSearch console

## Updating Deployment

### Update Stack

```bash
# Make changes to CDK code
# Then redeploy

cdk deploy -c stage=dev
```

### Delete Stack

```bash
# Remove all resources
cdk destroy -c stage=dev

# You'll be prompted to confirm
# Type 'y' to proceed
```

**Warning**: This will delete:
- Knowledge Base
- OpenSearch collection
- All associated data
- IAM roles

## Cost Estimation

**Monthly costs for dev environment**:
- Bedrock embeddings: ~$0.50 (1M tokens)
- OpenSearch Serverless: ~$5-10 (pay-per-request)
- Lambda custom resource: ~$0.20 (one-time)
- **Total**: ~$10-20/month

**Optimization tips**:
- Use manual sync to avoid unnecessary indexing
- Archive old documents
- Monitor query patterns
- Use caching for frequent queries

## Monitoring

### CloudWatch Logs

View Lambda function logs:
```bash
aws logs tail /aws/lambda/stealth-aaas-dev-kb-KBCustomResourceFunction \
  --follow \
  --region us-east-1
```

### CloudFormation Events

Monitor stack creation:
```bash
aws cloudformation describe-stack-events \
  --stack-name stealth-aaas-dev-kb \
  --region us-east-1
```

### Knowledge Base Metrics

Check Knowledge Base status:
```bash
aws bedrock describe-knowledge-base \
  --knowledge-base-id ${KB_ID} \
  --region us-east-1
```

## Next Steps

After successful deployment:

1. **Test Knowledge Base Query Utility**
   ```bash
   npm test -- knowledge-base.test.ts
   ```

2. **Run Integration Tests**
   ```bash
   export BEDROCK_KNOWLEDGE_BASE_ID=<KB_ID>
   npm test -- knowledge-base-integration.test.ts
   ```

3. **Upload Real PDFs**
   - Upload your actual PDF documents to S3
   - Trigger data source sync
   - Test queries with real content

4. **Proceed to Phase 14**
   - MCQ Generation Lambda Functions
   - Knowledge Base retrieval for context
   - Model fallback logic

## Support

For issues:
1. Check CloudWatch logs
2. Review CloudFormation events
3. Check AWS service quotas
4. Consult AWS documentation
5. Contact AWS support

## References

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/latest/guide/)
- [Bedrock Knowledge Base API](https://docs.aws.amazon.com/bedrock/latest/APIReference/)
- [OpenSearch Serverless](https://docs.aws.amazon.com/opensearch-service/latest/developerguide/serverless.html)
- [CloudFormation User Guide](https://docs.aws.amazon.com/cloudformation/latest/userguide/)
