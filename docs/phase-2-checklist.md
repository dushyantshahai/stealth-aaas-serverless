# Phase 2: Development Environment Setup - Quick Checklist

## Pre-Flight Check
- [ ] Phase 1 completed (AWS account, IAM user, AWS CLI configured)
- [ ] Windows system with admin access
- [ ] Stable internet connection
- [ ] At least 10 GB free disk space

---

## Task 2.1: Node.js and Development Tools
- [ ] Download Node.js 20.x LTS from nodejs.org
- [ ] Install Node.js with default settings
- [ ] Verify: `node --version` shows v20.x.x
- [ ] Verify: `npm --version` shows 10.x.x+
- [ ] Install TypeScript: `npm install -g typescript`
- [ ] Verify: `tsc --version` shows 5.x.x
- [ ] Install ts-node: `npm install -g ts-node`
- [ ] Verify: `ts-node --version`

---

## Task 2.2: Docker and Docker Compose
- [ ] Download Docker Desktop from docker.com
- [ ] Install Docker Desktop (enable WSL 2 backend)
- [ ] Restart computer
- [ ] Start Docker Desktop application
- [ ] Wait for Docker engine to start (whale icon steady)
- [ ] Verify: `docker --version` shows 24.x.x+
- [ ] Verify: `docker-compose --version` shows v2.x.x+
- [ ] Test: `docker run hello-world` succeeds

---

## Task 2.3: LocalStack
- [ ] Pull LocalStack image: `docker pull localstack/localstack`
- [ ] Verify: `docker images | grep localstack` shows image

---

## Task 2.4: AWS SAM CLI
- [ ] Download SAM CLI MSI installer
- [ ] Install SAM CLI with default settings
- [ ] Restart terminal/Kiro
- [ ] Verify: `sam --version` shows 1.x.x

---

## Task 2.5: Project Structure
- [ ] Navigate to specs directory
- [ ] Create directory: `mkdir stealth-aaas-serverless`
- [ ] Navigate: `cd stealth-aaas-serverless`
- [ ] Initialize Git: `git init`
- [ ] Create directories:
  - [ ] `mkdir cdk lambda frontend docs scripts`
  - [ ] `mkdir lambda\api lambda\async lambda\layers lambda\migrations`
  - [ ] `mkdir lambda\api\auth lambda\api\users lambda\api\subjects lambda\api\books`
  - [ ] `mkdir lambda\api\chapters lambda\api\topics lambda\api\subtopics lambda\api\mcqs`
  - [ ] `mkdir lambda\api\assessments lambda\api\batches lambda\api\assignments`
  - [ ] `mkdir lambda\api\submissions lambda\api\analytics`
  - [ ] `mkdir lambda\async\pdf-processor lambda\async\mcq-generator lambda\async\analytics-aggregator`
  - [ ] `mkdir lambda\layers\common lambda\layers\dependencies`
- [ ] Initialize npm: `npm init -y`
- [ ] Create `tsconfig.json` (see guide for content)
- [ ] Create `.gitignore` (see guide for content)

---

## Task 2.6: Environment Variables
- [ ] Create `.env.example` (see guide for content)
- [ ] Create `.env.local` from example
- [ ] Get AWS account ID: `aws sts get-caller-identity --query Account --output text`
- [ ] Update `.env.local` with your account ID
- [ ] Create `.env.dev` (see guide for content)
- [ ] Create `.env.staging` (see guide for content)
- [ ] Create `.env.prod` (see guide for content)
- [ ] Create `docs/environment-variables.md` (see guide for content)

---

## Task 2.7: Install Dependencies

### AWS SDK v3
- [ ] Run: `npm install @aws-sdk/client-lambda @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb @aws-sdk/client-s3 @aws-sdk/client-bedrock-runtime @aws-sdk/client-sqs @aws-sdk/client-textract @aws-sdk/client-secrets-manager @aws-sdk/client-cognito-identity-provider @aws-sdk/client-cloudwatch`

### AWS CDK
- [ ] Install CDK CLI: `npm install -g aws-cdk`
- [ ] Install CDK libs: `npm install aws-cdk-lib constructs`
- [ ] Verify: `cdk --version` shows 2.x.x

### Testing Frameworks
- [ ] Run: `npm install --save-dev jest @types/jest ts-jest @playwright/test @types/node`

### Utility Libraries
- [ ] Run: `npm install uuid date-fns zod dotenv`
- [ ] Run: `npm install --save-dev @types/uuid`

### Development Tools
- [ ] Run: `npm install --save-dev eslint prettier @typescript-eslint/parser @typescript-eslint/eslint-plugin`

### Configuration Files
- [ ] Create `.eslintrc.json` (see guide for content)
- [ ] Create `.prettierrc` (see guide for content)
- [ ] Update `package.json` scripts (see guide for content)

### Verify Installation
- [ ] Run: `npm list --depth=0`
- [ ] Verify all packages listed without errors

---

## LocalStack Setup
- [ ] Create `docker-compose.yml` in project root (see guide for content)
- [ ] Start LocalStack: `docker-compose up -d`
- [ ] Verify container running: `docker ps`
- [ ] Check health: `curl http://localhost:4566/_localstack/health`
- [ ] Verify JSON response with service statuses

---

## Final Verification

### Commands to Run
```bash
# Verify Node.js
node --version

# Verify npm
npm --version

# Verify TypeScript
tsc --version

# Verify ts-node
ts-node --version

# Verify Docker
docker --version
docker-compose --version

# Verify SAM CLI
sam --version

# Verify CDK
cdk --version

# Verify LocalStack
docker ps | grep localstack
curl http://localhost:4566/_localstack/health

# Verify project dependencies
npm list --depth=0
```

### All Should Pass
- [ ] All version commands return expected versions
- [ ] LocalStack container is running
- [ ] LocalStack health check returns JSON
- [ ] npm dependencies installed without errors

---

## Phase 2 Complete! ✅

You're now ready for **Phase 3: CDK Infrastructure Foundation**

**What you've accomplished:**
- Complete development environment set up
- All tools installed and verified
- Project structure created
- Dependencies installed
- LocalStack running for local AWS testing

**Next Phase Preview:**
Phase 3 will initialize your CDK project and create the infrastructure-as-code foundation for deploying AWS resources.

---

## Quick Commands Reference

### Start/Stop LocalStack
```bash
# Start
docker-compose up -d

# Stop
docker-compose down

# View logs
docker logs stealth-aaas-localstack

# Restart
docker-compose restart
```

### Project Commands
```bash
# Build TypeScript
npm run build

# Run linter
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### AWS CLI with LocalStack
```bash
# List DynamoDB tables in LocalStack
aws dynamodb list-tables --endpoint-url http://localhost:4566

# List S3 buckets in LocalStack
aws s3 ls --endpoint-url http://localhost:4566

# List Lambda functions in LocalStack
aws lambda list-functions --endpoint-url http://localhost:4566
```

---

## Troubleshooting Quick Reference

| Issue | Solution |
|-------|----------|
| Command not found | Restart terminal/Kiro to reload PATH |
| Docker won't start | Check WSL 2 installation, restart Docker Desktop |
| LocalStack exits | Check logs: `docker logs stealth-aaas-localstack` |
| npm permission errors | Run terminal as Administrator |
| Port 4566 in use | Stop other services using port, or change port in docker-compose.yml |
| npm install timeout | Increase timeout: `npm install --timeout=60000` |

---

**Estimated Time**: 2-3 hours
**AWS Costs**: $0 (everything runs locally)
