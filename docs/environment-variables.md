# Environment Variables

## Naming Conventions

- Use UPPER_SNAKE_CASE for all environment variables
- Prefix with service name: `DYNAMODB_`, `S3_`, `SQS_`, etc.
- Use descriptive names: `COGNITO_USER_POOL_ID` not `POOL_ID`

## Required Variables

See `.env.example` for complete list of required variables.

## Environment Files

- `.env.example` - Template with all variables (commit to git)
- `.env.local` - Local development (DO NOT commit)
- `.env.dev` - Development environment settings
- `.env.staging` - Staging environment settings
- `.env.prod` - Production environment settings

## Security

- NEVER commit `.env.local`, `.env.dev`, `.env.staging`, or `.env.prod` with real values
- Use AWS Secrets Manager for sensitive production values
- Rotate credentials regularly
- Use IAM roles instead of access keys when possible

## Loading Environment Variables

Environment variables are loaded using the `dotenv` package in Lambda functions.

## Getting Your AWS Account ID

Run this command in your terminal:

```bash
aws sts get-caller-identity --query Account --output text
```

Then update `.env.local` with your account ID.

## After CDK Deployment

After deploying your CDK stacks, you'll need to populate these variables:

- `COGNITO_USER_POOL_ID` - From Cognito User Pool
- `COGNITO_CLIENT_ID` - From Cognito User Pool Client
- `DYNAMODB_*_TABLE` - DynamoDB table names
- `S3_*_BUCKET` - S3 bucket names
- `SQS_*_QUEUE` - SQS queue URLs
- `BEDROCK_GUARDRAIL_ID` - From Bedrock Guardrails

CDK outputs will provide these values after deployment.
