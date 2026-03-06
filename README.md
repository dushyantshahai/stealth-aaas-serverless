# Stealth AaaS - AWS Serverless Migration

Complete migration of the Stealth AaaS (Assessment as a Service) platform from Express.js/PostgreSQL to AWS serverless architecture.

## 🎯 Project Overview

This project migrates the existing educational assessment platform to a fully serverless AWS architecture using:

- **Compute**: AWS Lambda (40+ functions)
- **API**: API Gateway (50+ REST endpoints)
- **Database**: DynamoDB (13 tables)
- **Storage**: S3 (PDFs + frontend hosting)
- **AI/ML**: Amazon Bedrock (Claude 3.5 Sonnet, Nova, Titan)
- **Auth**: Amazon Cognito
- **Async**: SQS queues
- **OCR**: Amazon Textract
- **Monitoring**: CloudWatch + X-Ray
- **CDN**: CloudFront
- **IaC**: AWS CDK (TypeScript)

## 📋 Prerequisites

Before starting, ensure you have:

- ✅ AWS account (see Phase 1 setup guide)
- ✅ Node.js 20.x LTS
- ✅ Docker Desktop
- ✅ Git
- ✅ Code editor (VS Code recommended)
- ✅ Password manager (for storing credentials)

## 🚀 Getting Started

### Step 1: Complete AWS Account Setup

Follow the comprehensive guide in `docs/aws-setup-guide.md`:

```bash
# Open the guide
cat docs/aws-setup-guide.md
```

Or use the quick checklist:

```bash
# Track your progress
cat docs/phase-1-checklist.md
```

**Estimated time**: 1.5 - 2 hours

### Step 2: Wait for Bedrock Access

After requesting Bedrock model access:

1. Check your email for approval notification
2. Verify access in AWS Console: Bedrock → Model access
3. Expected wait time: 5 minutes to 24 hours

### Step 3: Verify Setup

Run these commands to verify Phase 1 completion:

```bash
# Check AWS CLI
aws --version

# Check your identity
aws sts get-caller-identity

# Check Bedrock access (once approved)
aws bedrock list-foundation-models --region us-east-1
```

## 📁 Project Structure

```
stealth-aaas-serverless/
├── docs/                          # Documentation
│   ├── aws-setup-guide.md        # Phase 1: AWS account setup
│   ├── phase-1-checklist.md      # Quick checklist
│   └── ...                        # More guides coming
├── cdk/                           # AWS CDK infrastructure code
│   ├── lib/                       # CDK stack definitions
│   └── bin/                       # CDK app entry point
├── lambda/                        # Lambda function code
│   ├── api/                       # API handler functions
│   ├── async/                     # Async processor functions
│   ├── layers/                    # Lambda layers
│   └── migrations/                # Data migration scripts
├── frontend/                      # Next.js frontend (static export)
├── scripts/                       # Deployment and utility scripts
├── tests/                         # Test suites
│   ├── unit/                      # Unit tests
│   ├── integration/               # Integration tests
│   ├── e2e/                       # End-to-end tests
│   └── load/                      # Load tests
└── README.md                      # This file
```

## 📚 Documentation

### Phase Guides

- [Phase 1: AWS Account Setup](docs/aws-setup-guide.md) ← **START HERE**
- Phase 2: Development Environment Setup (coming next)
- Phase 3: CDK Infrastructure Foundation (coming soon)
- ... (35 phases total)

### Reference Documents

Located in `.kiro/specs/aws-serverless-migration/`:

- **requirements.md**: 67 detailed requirements
- **design.md**: Complete architecture and design
- **tasks.md**: 200+ implementation tasks across 35 phases

## 🎓 Learning Resources

### AWS Services Used

- [AWS Lambda](https://docs.aws.amazon.com/lambda/)
- [Amazon API Gateway](https://docs.aws.amazon.com/apigateway/)
- [Amazon DynamoDB](https://docs.aws.amazon.com/dynamodb/)
- [Amazon S3](https://docs.aws.amazon.com/s3/)
- [Amazon Bedrock](https://docs.aws.amazon.com/bedrock/)
- [Amazon Cognito](https://docs.aws.amazon.com/cognito/)
- [AWS CDK](https://docs.aws.amazon.com/cdk/)

### Tutorials

- [AWS Getting Started](https://aws.amazon.com/getting-started/)
- [Serverless Framework](https://www.serverless.com/framework/docs)
- [AWS CDK Workshop](https://cdkworkshop.com/)

## 🔒 Security Best Practices

### Credentials Management

**NEVER commit these to Git**:
- ❌ AWS access keys
- ❌ Secret access keys
- ❌ API keys
- ❌ Passwords
- ❌ `.env` files with secrets

**DO**:
- ✅ Use `.env.example` for templates
- ✅ Store secrets in AWS Secrets Manager
- ✅ Use IAM roles for Lambda functions
- ✅ Enable MFA on all accounts
- ✅ Use password manager for credentials

### .gitignore

Already configured to exclude:
```
.env
.env.local
*.pem
*.key
aws-credentials.csv
node_modules/
dist/
.aws-sam/
cdk.out/
```

## 💰 Cost Estimation

### Free Tier (First 12 months)

- Lambda: 1M requests/month free
- DynamoDB: 25 GB storage free
- S3: 5 GB storage free
- API Gateway: 1M requests/month free
- CloudFront: 1 TB data transfer free

### Estimated Monthly Cost (After Free Tier)

**Development Environment**: $10-20/month
- Lambda: ~$5
- DynamoDB: ~$5
- S3: ~$2
- Bedrock: ~$5 (depends on usage)

**Production Environment**: $50-100/month
- Lambda: ~$20
- DynamoDB: ~$15
- S3: ~$5
- Bedrock: ~$30 (depends on usage)
- CloudFront: ~$10

**Cost Optimization**:
- Use on-demand pricing for DynamoDB
- Implement Bedrock response caching
- Set up billing alerts
- Monitor usage with Cost Explorer

## 🧪 Testing Strategy

### Test Levels

1. **Unit Tests**: Jest for Lambda functions (80%+ coverage)
2. **Integration Tests**: Test AWS service integrations
3. **E2E Tests**: Playwright for full user workflows
4. **Load Tests**: Artillery for performance validation

### Running Tests

```bash
# Unit tests
npm run test:unit

# Integration tests (requires LocalStack)
npm run test:integration

# E2E tests
npm run test:e2e

# Load tests
npm run test:load
```

## 🚢 Deployment

### Environments

- **Local**: LocalStack for development
- **Dev**: Development environment in AWS
- **Staging**: Pre-production testing
- **Production**: Live environment

### Deployment Commands

```bash
# Deploy to dev
npm run deploy:dev

# Deploy to staging
npm run deploy:staging

# Deploy to production (requires approval)
npm run deploy:prod
```

## 📊 Monitoring

### CloudWatch Dashboards

- System Health: API metrics, Lambda metrics, error rates
- Performance: Response times, processing durations
- Cost: Lambda invocations, DynamoDB usage, Bedrock calls
- Business: Assessments created, submissions, MCQs generated

### Alarms

- API Gateway 5xx error rate > 1%
- Lambda error rate > 5%
- DynamoDB throttling events
- SQS DLQ message count > 10

## 🐛 Troubleshooting

### Common Issues

**AWS CLI not working**
```bash
# Verify installation
aws --version

# Reconfigure
aws configure
```

**Access Denied errors**
```bash
# Check your identity
aws sts get-caller-identity

# Verify IAM permissions in AWS Console
```

**Bedrock access issues**
```bash
# Check model access status
aws bedrock list-foundation-models --region us-east-1
```

**LocalStack not starting**
```bash
# Check Docker is running
docker ps

# Restart LocalStack
docker-compose down
docker-compose up -d
```

## 📞 Support

### Getting Help

1. **Documentation**: Check `docs/` folder
2. **AWS Support**: Open case in AWS Console
3. **Community**: AWS forums and Stack Overflow
4. **Team**: Ask in your team chat

### Useful Links

- [AWS Documentation](https://docs.aws.amazon.com/)
- [AWS Support](https://console.aws.amazon.com/support/)
- [AWS Free Tier](https://aws.amazon.com/free/)
- [AWS Architecture Center](https://aws.amazon.com/architecture/)

## 🎯 Current Status

### Phase 1: AWS Account Setup ✅ (Complete this first!)

- [ ] Task 1.1: Create AWS account
- [ ] Task 1.2: Set up billing alerts
- [ ] Task 1.3: Create IAM user
- [ ] Task 1.4: Install AWS CLI
- [ ] Task 1.5: Configure AWS CLI
- [ ] Task 1.6: Request Bedrock model access
- [ ] Task 1.7: Configure Bedrock Guardrails
- [ ] Task 1.8: Verify service quotas

**Next**: Phase 2 - Development Environment Setup

## 📝 License

[Add your license here]

## 👥 Contributors

[Add contributors here]

---

**Ready to start?** Open `docs/aws-setup-guide.md` and begin Phase 1!

**Questions?** Check the troubleshooting section or ask for help.

**Good luck!** 🚀
