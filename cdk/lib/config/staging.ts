import { EnvironmentConfig } from './types';

export const stagingConfig: EnvironmentConfig = {
  account: process.env.AWS_ACCOUNT_ID || '637404140637',
  region: 'us-east-1',
  stage: 'staging',
  
  projectName: 'stealth-aaas',
  
  dynamodb: {
    billingMode: 'PAY_PER_REQUEST',
    pointInTimeRecovery: true,
  },
  
  lambda: {
    defaultMemory: 512,
    defaultTimeout: 30,
    logRetention: 14, // 14 days for staging
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
    logLevel: 'INFO',
  },
  
  tags: {
    Environment: 'staging',
    Project: 'stealth-aaas',
    ManagedBy: 'CDK',
  },
};
