# Phase 2: Development Environment Setup

## Overview

This guide walks you through setting up your complete development environment for building the AWS serverless platform. You'll install all necessary tools, configure local AWS emulation, and create the project structure.

**Estimated Time**: 2-3 hours

**Prerequisites**: 
- Phase 1 completed (AWS account setup, AWS CLI configured)
- Windows system with admin access
- Stable internet connection

## What You'll Set Up

1. Node.js and TypeScript development tools
2. Docker for running LocalStack (local AWS emulation)
3. LocalStack for testing AWS services locally
4. AWS SAM CLI for Lambda function testing
5. Project structure and dependencies
6. Environment configuration

---

## Task 2.1: Install Node.js and Development Tools

### Step 1: Install Node.js 20.x LTS

1. Visit [Node.js official website](https://nodejs.org/)
2. Download the **LTS version** (20.x) for Windows
3. Run the installer:
   - Accept the license agreement
   - Use default installation path: `C:\Program Files\nodejs\`
   - Check "Automatically install necessary tools" (includes Python, Visual Studio Build Tools)
   - Complete the installation

4. Verify installation:
   ```bash
   node --version
   # Should show: v20.x.x
   
   npm --version
   # Should show: 10.x.x or higher
   ```

### Step 2: Install TypeScript Globally

```bash
npm install -g typescript
```

Verify:
```bash
tsc --version
# Should show: Version 5.x.x
```

### Step 3: Install ts-node for TypeScript Execution

```bash
npm install -g ts-node
```

Verify:
```bash
ts-node --version
# Should show version number
```

### Troubleshooting

**Issue**: "npm command not found"
- **Solution**: Restart your terminal/Kiro to reload PATH environment variables

**Issue**: Permission errors during global install
- **Solution**: Run terminal as Administrator

---

## Task 2.2: Install Docker and Docker Compose

### Step 1: Install Docker Desktop

1. Visit [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/)
2. Download Docker Desktop installer
3. Run the installer:
   - Enable WSL 2 backend (recommended)
   - Complete installation
   - Restart your computer when prompted

4. Start Docker Desktop:
   - Launch Docker Desktop from Start menu
   - Wait for Docker engine to start (whale icon in system tray should be steady)
   - Accept the Docker Subscription Service Agreement

### Step 2: Verify Docker Installation

```bash
docker --version
# Should show: Docker version 24.x.x or higher

docker-compose --version
# Should show: Docker Compose version v2.x.x or higher
```

### Step 3: Test Docker

```bash
docker run hello-world
```

You should see:
```
Hello from Docker!
This message shows that your installation appears to be working correctly.
```

### Troubleshooting

**Issue**: "Docker daemon is not running"
- **Solution**: Start Docker Desktop application

**Issue**: WSL 2 installation errors
- **Solution**: Follow Docker's WSL 2 installation guide: https://docs.docker.com/desktop/windows/wsl/

**Issue**: Hyper-V conflicts
- **Solution**: Ensure Hyper-V is enabled in Windows Features

---

## Task 2.3: Install LocalStack for Local AWS Emulation

LocalStack allows you to test AWS services locally without incurring costs or needing internet connectivity.

### Step 1: Pull LocalStack Docker Image

```bash
docker pull localstack/localstack
```

This will download the LocalStack image (may take a few minutes).

### Step 2: Create LocalStack Configuration

We'll create this in the next task when we set up the project structure. For now, just verify the image is downloaded:

```bash
docker images | grep localstack
# Should show: localstack/localstack
```

### What LocalStack Provides

LocalStack will emulate these AWS services locally:
- Lambda (serverless functions)
- API Gateway (HTTP endpoints)
- DynamoDB (NoSQL database)
- S3 (object storage)
- SQS (message queues)
- Secrets Manager (secrets storage)
- CloudWatch (logging)

---

## Task 2.4: Install AWS SAM CLI for Lambda Testing

AWS SAM (Serverless Application Model) CLI helps you test Lambda functions locally.

### Step 1: Install AWS SAM CLI

1. Visit [AWS SAM CLI installation guide](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)

2. For Windows, download the MSI installer:
   - [AWS SAM CLI Windows 64-bit](https://github.com/aws/aws-sam-cli/releases/latest/download/AWS_SAM_CLI_64_PY3.msi)

3. Run the installer with default settings

4. Restart your terminal/Kiro

### Step 2: Verify SAM CLI Installation

```bash
sam --version
# Should show: SAM CLI, version 1.x.x
```

### Step 3: Test SAM CLI (Optional)

```bash
# Create a test directory
mkdir sam-test
cd sam-test

# Initialize a sample SAM project
sam init --runtime nodejs20.x --name hello-world --app-template hello-world

# This creates a sample Lambda function
# You can delete this directory after verification
cd ..
rm -rf sam-test
```

---

## Task 2.5: Set Up Project Structure and Monorepo

### Step 1: Create Project Root Directory

```bash
# Navigate to where you want to create the project
cd "C:\Users\Siddhant Shah\OneDrive\AI\Kiro\.kiro\specs"

# Create project directory
mkdir stealth-aaas-serverless
cd stealth-aaas-serverless
```

### Step 2: Initialize Git Repository

```bash
git init
```

### Step 3: Create Directory Structure

```bash
# Create main directories
mkdir cdk lambda frontend docs scripts

# Create Lambda subdirectories
mkdir lambda\api lambda\async lambda\layers lambda\migrations

# Create Lambda API subdirectories
mkdir lambda\api\auth lambda\api\users lambda\api\subjects lambda\api\books lambda\api\chapters lambda\api\topics lambda\api\subtopics lambda\api\mcqs lambda\api\assessments lambda\api\batches lambda\api\assignments lambda\api\submissions lambda\api\analytics

# Create Lambda async subdirectories
mkdir lambda\async\pdf-processor lambda\async\mcq-generator lambda\async\analytics-aggregator

# Create Lambda layers subdirectories
mkdir lambda\layers\common lambda\layers\dependencies
```

### Step 4: Initialize package.json

```bash
npm init -y
```

This creates a `package.json` file. We'll add dependencies in the next task.

### Step 5: Create TypeScript Configuration

Create `tsconfig.json`:

```bash
# In Kiro, create a new file: tsconfig.json
```

Add this content:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "types": ["node"]
  },
  "include": ["lambda/**/*", "cdk/**/*", "scripts/**/*"],
  "exclude": ["node_modules", "dist", "cdk.out"]
}
```

### Step 6: Create .gitignore

Create `.gitignore`:

```
# Dependencies
node_modules/
package-lock.json
yarn.lock

# Build outputs
dist/
build/
*.js
*.d.ts
*.js.map
!jest.config.js

# CDK
cdk.out/
cdk.context.json
.cdk.staging/

# Environment variables
.env
.env.local
.env.*.local

# AWS
.aws-sam/

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Logs
logs/
*.log
npm-debug.log*

# Test coverage
coverage/
.nyc_output/

# Temporary files
tmp/
temp/
```

### Step 7: Verify Project Structure

Your directory structure should look like this:

```
stealth-aaas-serverless/
├── cdk/
├── lambda/
│   ├── api/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── subjects/
│   │   ├── books/
│   │   ├── chapters/
│   │   ├── topics/
│   │   ├── subtopics/
│   │   ├── mcqs/
│   │   ├── assessments/
│   │   ├── batches/
│   │   ├── assignments/
│   │   ├── submissions/
│   │   └── analytics/
│   ├── async/
│   │   ├── pdf-processor/
│   │   ├── mcq-generator/
│   │   └── analytics-aggregator/
│   ├── layers/
│   │   ├── common/
│   │   └── dependencies/
│   └── migrations/
├── frontend/
├── docs/
├── scripts/
├── .gitignore
├── tsconfig.json
└── package.json
```

---

## Task 2.6: Configure Environment Variables and Secrets

### Step 1: Create .env.example Template

Create `.env.example` in project root:

```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=your-account-id-here

# Environment
NODE_ENV=development
STAGE=dev

# Bedrock Configuration
BEDROCK_CLAUDE_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0
BEDROCK_NOVA_MODEL_ID=amazon.nova-pro-v1:0
BEDROCK_TITAN_MODEL_ID=amazon.titan-text-premier-v1:0
BEDROCK_GUARDRAIL_ID=your-guardrail-id-here
BEDROCK_GUARDRAIL_VERSION=1

# Cognito Configuration (will be populated after CDK deployment)
COGNITO_USER_POOL_ID=
COGNITO_CLIENT_ID=

# DynamoDB Table Names (will be populated after CDK deployment)
DYNAMODB_INSTITUTES_TABLE=
DYNAMODB_USERS_TABLE=
DYNAMODB_SUBJECTS_TABLE=
DYNAMODB_BOOKS_TABLE=
DYNAMODB_CHAPTERS_TABLE=
DYNAMODB_TOPICS_TABLE=
DYNAMODB_SUBTOPICS_TABLE=
DYNAMODB_CHUNKS_TABLE=
DYNAMODB_MCQS_TABLE=
DYNAMODB_ASSESSMENTS_TABLE=
DYNAMODB_BATCHES_TABLE=
DYNAMODB_ASSIGNMENTS_TABLE=
DYNAMODB_SUBMISSIONS_TABLE=

# S3 Bucket Names (will be populated after CDK deployment)
S3_PDF_BUCKET=
S3_FRONTEND_BUCKET=

# SQS Queue URLs (will be populated after CDK deployment)
SQS_PDF_PROCESSING_QUEUE=
SQS_MCQ_GENERATION_QUEUE=
SQS_ANALYTICS_AGGREGATION_QUEUE=

# LocalStack Configuration (for local development)
LOCALSTACK_ENDPOINT=http://localhost:4566
USE_LOCALSTACK=true

# Logging
LOG_LEVEL=info
```

### Step 2: Create .env.local for Local Development

```bash
# Copy the example file
cp .env.example .env.local
```

Edit `.env.local` and fill in your AWS account ID:

```bash
AWS_ACCOUNT_ID=123456789012  # Replace with your actual account ID
```

To get your AWS account ID:
```bash
aws sts get-caller-identity --query Account --output text
```

### Step 3: Create Environment-Specific Templates

Create `.env.dev`:
```bash
NODE_ENV=development
STAGE=dev
LOG_LEVEL=debug
USE_LOCALSTACK=false
```

Create `.env.staging`:
```bash
NODE_ENV=staging
STAGE=staging
LOG_LEVEL=info
USE_LOCALSTACK=false
```

Create `.env.prod`:
```bash
NODE_ENV=production
STAGE=prod
LOG_LEVEL=warn
USE_LOCALSTACK=false
```

### Step 4: Document Environment Variable Conventions

Create `docs/environment-variables.md`:

```markdown
# Environment Variables

## Naming Conventions

- Use UPPER_SNAKE_CASE for all environment variables
- Prefix with service name: `DYNAMODB_`, `S3_`, `SQS_`, etc.
- Use descriptive names: `COGNITO_USER_POOL_ID` not `POOL_ID`

## Required Variables

See `.env.example` for complete list of required variables.

## Security

- NEVER commit `.env.local`, `.env.dev`, `.env.staging`, or `.env.prod` with real values
- Use AWS Secrets Manager for sensitive production values
- Rotate credentials regularly

## Loading Environment Variables

Environment variables are loaded using the `dotenv` package in Lambda functions.
```

---

## Task 2.7: Install Project Dependencies

### Step 1: Install AWS SDK v3 Clients

```bash
npm install @aws-sdk/client-lambda @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb @aws-sdk/client-s3 @aws-sdk/client-bedrock-runtime @aws-sdk/client-sqs @aws-sdk/client-textract @aws-sdk/client-secrets-manager @aws-sdk/client-cognito-identity-provider @aws-sdk/client-cloudwatch
```

### Step 2: Install AWS CDK

```bash
# Install CDK CLI globally
npm install -g aws-cdk

# Install CDK libraries for the project
npm install aws-cdk-lib constructs
```

Verify CDK installation:
```bash
cdk --version
# Should show: 2.x.x
```

### Step 3: Install Testing Frameworks

```bash
npm install --save-dev jest @types/jest ts-jest @playwright/test @types/node
```

### Step 4: Install Utility Libraries

```bash
npm install uuid date-fns zod dotenv
npm install --save-dev @types/uuid
```

### Step 5: Install Development Tools

```bash
npm install --save-dev eslint prettier @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

### Step 6: Create ESLint Configuration

Create `.eslintrc.json`:

```json
{
  "parser": "@typescript-eslint/parser",
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "parserOptions": {
    "ecmaVersion": 2022,
    "sourceType": "module"
  },
  "rules": {
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }]
  }
}
```

### Step 7: Create Prettier Configuration

Create `.prettierrc`:

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2
}
```

### Step 8: Update package.json Scripts

Edit `package.json` and add these scripts:

```json
{
  "scripts": {
    "build": "tsc",
    "lint": "eslint . --ext .ts",
    "lint:fix": "eslint . --ext .ts --fix",
    "format": "prettier --write \"**/*.{ts,json,md}\"",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "cdk": "cdk"
  }
}
```

### Step 9: Verify All Dependencies

```bash
npm list --depth=0
```

You should see all installed packages listed.

---

## Create LocalStack Docker Compose Configuration

Create `docker-compose.yml` in project root:

```yaml
version: '3.8'

services:
  localstack:
    image: localstack/localstack:latest
    container_name: stealth-aaas-localstack
    ports:
      - "4566:4566"            # LocalStack Gateway
      - "4510-4559:4510-4559"  # External services port range
    environment:
      - SERVICES=lambda,apigateway,dynamodb,s3,sqs,secretsmanager,cloudwatch,sts,iam
      - DEBUG=1
      - DATA_DIR=/tmp/localstack/data
      - LAMBDA_EXECUTOR=docker
      - DOCKER_HOST=unix:///var/run/docker.sock
    volumes:
      - "./localstack-data:/tmp/localstack"
      - "/var/run/docker.sock:/var/run/docker.sock"
    networks:
      - localstack-network

networks:
  localstack-network:
    driver: bridge
```

### Start LocalStack

```bash
docker-compose up -d
```

### Verify LocalStack is Running

```bash
# Check container status
docker ps

# Check LocalStack health
curl http://localhost:4566/_localstack/health
```

You should see JSON output showing service statuses.

### Stop LocalStack

When you're done:
```bash
docker-compose down
```

---

## Phase 2 Completion Checklist

Before moving to Phase 3, verify:

- [ ] Node.js 20.x installed and verified
- [ ] TypeScript and ts-node installed globally
- [ ] Docker Desktop installed and running
- [ ] LocalStack Docker image pulled
- [ ] AWS SAM CLI installed and verified
- [ ] Project directory structure created
- [ ] Git repository initialized
- [ ] TypeScript configuration created
- [ ] .gitignore created
- [ ] Environment variable templates created
- [ ] All npm dependencies installed
- [ ] ESLint and Prettier configured
- [ ] docker-compose.yml created
- [ ] LocalStack started and health check passed

---

## Next Steps

Once Phase 2 is complete, you'll move to **Phase 3: CDK Infrastructure Foundation**, where you'll:

1. Initialize the CDK project
2. Create CDK stack structure
3. Define environment configurations
4. Set up deployment scripts

---

## Troubleshooting

### Docker Issues on Windows

**Issue**: Docker Desktop won't start
- Ensure WSL 2 is installed and updated
- Check Windows version (requires Windows 10 version 2004 or higher)
- Restart Docker Desktop service

**Issue**: LocalStack container exits immediately
- Check Docker logs: `docker logs stealth-aaas-localstack`
- Ensure ports 4566 is not in use by another application
- Try pulling the latest image: `docker pull localstack/localstack:latest`

### npm Install Issues

**Issue**: EACCES permission errors
- Run terminal as Administrator
- Or use: `npm install --unsafe-perm`

**Issue**: Network timeout errors
- Check internet connection
- Try using npm registry mirror
- Increase timeout: `npm install --timeout=60000`

### Path Issues

**Issue**: Commands not found after installation
- Restart terminal/Kiro to reload PATH
- Manually add to PATH if needed:
  - Node.js: `C:\Program Files\nodejs\`
  - npm global: `C:\Users\<username>\AppData\Roaming\npm`

---

## Estimated Costs

Phase 2 has **zero AWS costs** - everything runs locally:
- LocalStack: Free (community edition)
- Docker: Free
- All development tools: Free

---

## Time Estimate

- Task 2.1 (Node.js): 15 minutes
- Task 2.2 (Docker): 30 minutes
- Task 2.3 (LocalStack): 10 minutes
- Task 2.4 (SAM CLI): 10 minutes
- Task 2.5 (Project structure): 15 minutes
- Task 2.6 (Environment config): 15 minutes
- Task 2.7 (Dependencies): 20 minutes
- LocalStack setup: 10 minutes

**Total: 2-3 hours** (including download times)

---

## Support

If you encounter issues:
1. Check the Troubleshooting section above
2. Review Docker Desktop logs
3. Check LocalStack logs: `docker logs stealth-aaas-localstack`
4. Verify all prerequisites from Phase 1 are complete
