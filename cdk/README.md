# Stealth AaaS - CDK Infrastructure

This directory contains the AWS CDK infrastructure code for the Stealth AaaS platform.

## Structure

```
cdk/
├── bin/
│   └── cdk.ts              # CDK app entry point
├── lib/
│   ├── config/             # Environment configurations
│   │   ├── types.ts        # Configuration types
│   │   ├── dev.ts          # Development config
│   │   ├── staging.ts      # Staging config
│   │   ├── prod.ts         # Production config
│   │   └── index.ts        # Config loader
│   ├── utils/
│   │   └── naming.ts       # Resource naming utilities
│   ├── base-stack.ts       # Base stack class
│   ├── storage-stack.ts    # DynamoDB + S3
│   ├── auth-stack.ts       # Cognito
│   └── messaging-stack.ts  # SQS
└── cdk.json                # CDK configuration

## Stacks

### Storage Stack
- 13 DynamoDB tables with GSIs
- 2 S3 buckets (PDFs and Frontend)
- Point-in-time recovery enabled
- Encryption at rest

### Auth Stack
- Cognito User Pool
- User Pool Client
- Custom attributes (instituteId, userRole)
- Password policies

### Messaging Stack
- 3 SQS queues (PDF processing, MCQ generation, Analytics)
- Dead letter queue
- Encryption at rest

## Commands

### Bootstrap (First Time Only)
```bash
cd ..
./scripts/bootstrap.sh
```

### Deploy to Dev
```bash
cd ..
./scripts/deploy.sh dev
```

### Deploy to Staging
```bash
cd ..
./scripts/deploy.sh staging
```

### Deploy to Production
```bash
cd ..
./scripts/deploy.sh prod
```

### Synthesize CloudFormation
```bash
npm run build
npx cdk synth --context stage=dev
```

### Show Diff
```bash
npx cdk diff --context stage=dev
```

### Destroy Stacks
```bash
npx cdk destroy --all --context stage=dev
```

## Environment Variables

Set these in your `.env.local` file:
- `AWS_ACCOUNT_ID` - Your AWS account ID
- `AWS_REGION` - AWS region (default: us-east-1)

## Resource Naming Convention

All resources follow the pattern:
```
{project}-{stage}-{resource-type}-{name}
```

Example: `stealth-aaas-dev-lambda-pdf-processor`

## Outputs

After deployment, stack outputs are saved to:
- `cdk-outputs-dev.json`
- `cdk-outputs-staging.json`
- `cdk-outputs-prod.json`

These contain resource ARNs, names, and URLs needed by Lambda functions.
