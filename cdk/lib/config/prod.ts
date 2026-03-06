import { EnvironmentConfig } from './types';

export const prodConfig: EnvironmentConfig = {
  account: process.env.AWS_ACCOUNT_ID || '637404140637',
  region: 'us-east-1',
  stage: 'prod',
  
  projectName: 'stealth-aaas',
  
  dynamodb: {
    billingMode: 'PAY_PER_REQUEST',
    pointInTimeRecovery: true,
  },
  
  lambda: {
    defaultMemory: 1024, // More memory for production
    defaultTimeout: 30,
    logRetention: 30, // 30 days for production
  },
  
  s3: {
    pdfBucketLifecycle: {
      intelligentTieringDays: 30,
      glacierDays: 90,
    },
  },
  
  sqs: {
    visibilityTimeout: 300,
    messageRetention: 14,
    maxReceiveCount: 3,
  },
  
  cognito: {
    passwordPolicy: {
      minLength: 8,
      requireLowercase: true,
      requireUppercase: true,
      requireNumbers: true,
      requireSymbols: true,
    },
    tokenValidity: {
      accessToken: 1,
      idToken: 1,
      refreshToken: 30,
    },
  },
  
  monitoring: {
    enableXRay: true,
    logLevel: 'WARN',
  },
  
  tags: {
    Environment: 'prod',
    Project: 'stealth-aaas',
    ManagedBy: 'CDK',
    CostCenter: 'Engineering',
  },
};
