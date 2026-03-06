import { EnvironmentConfig } from './types';

export const devConfig: EnvironmentConfig = {
  account: process.env.AWS_ACCOUNT_ID || '637404140637',
  region: 'us-east-1',
  stage: 'dev',
  
  projectName: 'stealth-aaas',
  
  dynamodb: {
    billingMode: 'PAY_PER_REQUEST',
    pointInTimeRecovery: true,
  },
  
  lambda: {
    defaultMemory: 512,
    defaultTimeout: 30,
    logRetention: 7, // 7 days for dev
  },
  
  s3: {
    pdfBucketLifecycle: {
      intelligentTieringDays: 30,
      glacierDays: 90,
    },
  },
  
  sqs: {
    visibilityTimeout: 300, // 5 minutes
    messageRetention: 14, // 14 days
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
      accessToken: 1, // 1 hour
      idToken: 1, // 1 hour
      refreshToken: 30, // 30 days
    },
  },
  
  monitoring: {
    enableXRay: true,
    logLevel: 'DEBUG',
  },
  
  tags: {
    Environment: 'dev',
    Project: 'stealth-aaas',
    ManagedBy: 'CDK',
  },
};
