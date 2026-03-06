import { EnvironmentConfig } from '../config';

export class NamingUtils {
  private config: EnvironmentConfig;
  
  constructor(config: EnvironmentConfig) {
    this.config = config;
  }
  
  /**
   * Generate resource name following pattern: {project}-{stage}-{resourceType}-{name}
   * Example: stealth-aaas-dev-lambda-pdf-processor
   */
  resourceName(resourceType: string, name: string): string {
    return `${this.config.projectName}-${this.config.stage}-${resourceType}-${name}`;
  }
  
  /**
   * Generate DynamoDB table name
   */
  dynamoTableName(tableName: string): string {
    return this.resourceName('table', tableName);
  }
  
  /**
   * Generate Lambda function name
   */
  lambdaName(functionName: string): string {
    return this.resourceName('lambda', functionName);
  }
  
  /**
   * Generate S3 bucket name (must be globally unique and lowercase)
   */
  s3BucketName(bucketPurpose: string): string {
    return `${this.config.projectName}-${this.config.stage}-${bucketPurpose}-${this.config.account}`.toLowerCase();
  }
  
  /**
   * Generate SQS queue name
   */
  sqsQueueName(queueName: string): string {
    return this.resourceName('queue', queueName);
  }
  
  /**
   * Generate Cognito User Pool name
   */
  cognitoPoolName(poolName: string): string {
    return this.resourceName('pool', poolName);
  }
  
  /**
   * Generate API Gateway name
   */
  apiGatewayName(apiName: string): string {
    return this.resourceName('api', apiName);
  }
  
  /**
   * Generate CloudWatch Log Group name
   */
  logGroupName(serviceName: string): string {
    return `/aws/${this.config.projectName}/${this.config.stage}/${serviceName}`;
  }
  
  /**
   * Generate IAM role name
   */
  iamRoleName(rolePurpose: string): string {
    return this.resourceName('role', rolePurpose);
  }
  
  /**
   * Generate stack name
   */
  stackName(stackPurpose: string): string {
    return `${this.config.projectName}-${this.config.stage}-${stackPurpose}`;
  }
}
