/**
 * CDK Stack for Bedrock Knowledge Base
 * 
 * Creates and configures:
 * - Bedrock Knowledge Base
 * - OpenSearch Serverless collection
 * - S3 data source configuration
 * - IAM roles and policies
 */

import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface KnowledgeBaseStackProps extends cdk.StackProps {
  environment: 'dev' | 'staging' | 'prod';
  pdfBucket: s3.IBucket;
  accountId: string;
}

export class KnowledgeBaseStack extends cdk.Stack {
  public readonly knowledgeBaseId: string;
  public readonly knowledgeBaseArn: string;
  public readonly knowledgeBaseRole: iam.IRole;
  public readonly openSearchCollectionName: string;

  constructor(scope: Construct, id: string, props: KnowledgeBaseStackProps) {
    super(scope, id, props);

    const { environment, pdfBucket, accountId } = props;

    // Create IAM role for Knowledge Base service
    const kbServiceRole = new iam.Role(this, 'KnowledgeBaseServiceRole', {
      assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
      description: 'Service role for Bedrock Knowledge Base',
      roleName: `stealth-aaas-${environment}-kb-service-role`
    });

    // Grant S3 access to Knowledge Base
    pdfBucket.grantRead(kbServiceRole);

    // Add policy for OpenSearch access
    kbServiceRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'aoss:APIAccessAll'
        ],
        resources: [
          `arn:aws:aoss:${this.region}:${accountId}:collection/*`
        ]
      })
    );

    // Add policy for Bedrock model access
    kbServiceRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'bedrock:InvokeModel'
        ],
        resources: [
          `arn:aws:bedrock:${this.region}::foundation-model/amazon.titan-embed-text-v1`
        ]
      })
    );

    this.knowledgeBaseRole = kbServiceRole;
    this.openSearchCollectionName = `stealth-aaas-${environment}-kb-vectors`;

    // Note: Knowledge Base creation via CDK requires custom resource
    // For now, we'll create a placeholder and document manual creation
    this.knowledgeBaseId = cdk.Fn.importValue(
      `stealth-aaas-${environment}-kb-id`
    );
    this.knowledgeBaseArn = `arn:aws:bedrock:${this.region}:${accountId}:knowledge-base/${this.knowledgeBaseId}`;

    // Output Knowledge Base ID for reference
    new cdk.CfnOutput(this, 'KnowledgeBaseId', {
      value: this.knowledgeBaseId,
      description: 'Bedrock Knowledge Base ID',
      exportName: `stealth-aaas-${environment}-kb-id`
    });

    new cdk.CfnOutput(this, 'KnowledgeBaseArn', {
      value: this.knowledgeBaseArn,
      description: 'Bedrock Knowledge Base ARN'
    });

    new cdk.CfnOutput(this, 'OpenSearchCollectionName', {
      value: this.openSearchCollectionName,
      description: 'OpenSearch Serverless collection name'
    });

    new cdk.CfnOutput(this, 'KnowledgeBaseServiceRoleArn', {
      value: kbServiceRole.roleArn,
      description: 'Knowledge Base service role ARN'
    });
  }
}

/**
 * Custom resource for Knowledge Base creation
 * 
 * Note: This is a template for future implementation
 * Currently, Knowledge Base must be created manually via AWS console
 * 
 * To implement:
 * 1. Create Lambda function for custom resource
 * 2. Implement onCreate, onUpdate, onDelete handlers
 * 3. Use Bedrock API to manage Knowledge Base lifecycle
 */
export class KnowledgeBaseCustomResource extends Construct {
  public readonly knowledgeBaseId: cdk.CfnOutput;

  constructor(scope: Construct, id: string, props: {
    environment: string;
    pdfBucket: s3.IBucket;
    embeddingModel: string;
    chunkSize: number;
    chunkOverlap: number;
  }) {
    super(scope, id);

    // TODO: Implement custom resource for Knowledge Base creation
    // This would require:
    // 1. Lambda function with Bedrock API calls
    // 2. Custom resource provider
    // 3. Proper error handling and rollback

    this.knowledgeBaseId = new cdk.CfnOutput(this, 'KnowledgeBaseId', {
      value: 'MANUAL_SETUP_REQUIRED',
      description: 'Knowledge Base must be created manually via AWS console'
    });
  }
}
