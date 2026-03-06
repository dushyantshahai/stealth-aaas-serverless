# Deployment Guide

## Quick Deploy

### Windows
```powershell
.\deploy-api.ps1 dev
```

### Linux/Mac
```bash
./deploy-api.sh dev
```

## Manual Deployment Steps

1. **Navigate to CDK directory**
   ```bash
   cd stealth-aaas-serverless/cdk
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the CDK app**
   ```bash
   npm run build
   ```

4. **Synthesize CloudFormation templates**
   ```bash
   npx cdk synth --context stage=dev
   ```

5. **Deploy all stacks**
   ```bash
   npx cdk deploy --all --context stage=dev --require-approval never
   ```

## Verify Deployment

After deployment completes, you should see outputs including:
- API Gateway endpoint URL
- API Gateway ID
- API Key ID

## Test the API

Run the test script:
```bash
cd stealth-aaas-serverless
node test-content-apis.js
```

## Troubleshooting

### 502 Errors
If you still see 502 errors after deployment:
1. Check that all stacks deployed successfully
2. Verify the API Gateway has routes in AWS Console
3. Check Lambda function logs in CloudWatch

### Routes Not Showing
If routes aren't appearing in API Gateway:
1. Ensure you deployed AFTER the fix was applied
2. Check that FunctionsStack is created before ApiStack
3. Verify configureRoutes is called in the ApiStack constructor

### Stack Dependencies
The correct deployment order is:
1. StorageStack (DynamoDB + S3)
2. AuthStack (Cognito)
3. MessagingStack (SQS)
4. LayersStack (Lambda Layers)
5. FunctionsStack (Lambda Functions)
6. ApiStack (API Gateway with routes)

## Clean Up

To destroy all resources:
```bash
cd cdk
npx cdk destroy --all --context stage=dev
```
