export interface EnvironmentConfig {
  account: string;
  region: string;
  stage: 'dev' | 'staging' | 'prod';
  
  // Resource naming
  projectName: string;
  
  // DynamoDB
  dynamodb: {
    billingMode: 'PAY_PER_REQUEST' | 'PROVISIONED';
    pointInTimeRecovery: boolean;
  };
  
  // Lambda
  lambda: {
    defaultMemory: number;
    defaultTimeout: number;
    logRetention: number; // days
  };
  
  // S3
  s3: {
    pdfBucketLifecycle: {
      intelligentTieringDays: number;
      glacierDays: number;
    };
  };
  
  // SQS
  sqs: {
    visibilityTimeout: number; // seconds
    messageRetention: number; // days
    maxReceiveCount: number;
  };
  
  // Cognito
  cognito: {
    passwordPolicy: {
      minLength: number;
      requireLowercase: boolean;
      requireUppercase: boolean;
      requireNumbers: boolean;
      requireSymbols: boolean;
    };
    tokenValidity: {
      accessToken: number; // hours
      idToken: number; // hours
      refreshToken: number; // days
    };
  };
  
  // Monitoring
  monitoring: {
    enableXRay: boolean;
    logLevel: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  };
  
  // Tags
  tags: {
    [key: string]: string;
  };
}
