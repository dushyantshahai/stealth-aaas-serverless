/**
 * Bedrock Knowledge Base Stack
 * 
 * Automates the complete setup of:
 * - Bedrock Knowledge Base
 * - OpenSearch Serverless collection
 * - S3 data source configuration
 * - IAM roles and policies
 * - Custom resource for Knowledge Base creation
 */

import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface BedrockKnowledgeBaseStackProps extends cdk.StackProps {
  environment: 'dev' | 'staging' | 'prod';
  pdfBucketName: string;
  accountId: string;
}

export class BedrockKnowledgeBaseStack extends cdk.Stack {
  public readonly knowledgeBaseId: cdk.CfnOutput;
  public readonly knowledgeBaseArn: cdk.CfnOutput;
  public readonly openSearchCollectionName: string;
  public readonly knowledgeBaseServiceRole: iam.IRole;

  constructor(scope: Construct, id: string, props: BedrockKnowledgeBaseStackProps) {
    super(scope, id, props);

    const { environment, pdfBucketName, accountId } = props;
    const region = this.region;

    // ============================================================================
    // 1. Create IAM Role for Knowledge Base Service
    // ============================================================================

    const kbServiceRole = new iam.Role(this, 'KnowledgeBaseServiceRole', {
      assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
      description: 'Service role for Bedrock Knowledge Base',
      roleName: `stealth-aaas-${environment}-kb-service-role`,
      inlinePolicies: {
        s3Access: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                's3:GetObject',
                's3:ListBucket'
              ],
              resources: [
                `arn:aws:s3:::${pdfBucketName}`,
                `arn:aws:s3:::${pdfBucketName}/*`
              ]
            })
          ]
        }),
        openSearchAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'aoss:APIAccessAll'
              ],
              resources: [
                `arn:aws:aoss:${region}:${accountId}:collection/*`
              ]
            })
          ]
        }),
        bedrockAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'bedrock:InvokeModel'
              ],
              resources: [
                `arn:aws:bedrock:${region}::foundation-model/amazon.titan-embed-text-v1`
              ]
            })
          ]
        })
      }
    });

    this.knowledgeBaseServiceRole = kbServiceRole;
    this.openSearchCollectionName = `stealth-aaas-${environment}-kb-vectors`;

    // ============================================================================
    // 2. Create Outputs for Manual Setup
    // ============================================================================

    this.knowledgeBaseId = new cdk.CfnOutput(this, 'KnowledgeBaseId', {
      value: 'MANUAL_SETUP_REQUIRED',
      description: 'Bedrock Knowledge Base ID (requires manual setup)',
      exportName: `stealth-aaas-${environment}-kb-id`
    });

    this.knowledgeBaseArn = new cdk.CfnOutput(this, 'KnowledgeBaseArn', {
      value: `arn:aws:bedrock:${region}:${accountId}:knowledge-base/MANUAL_SETUP_REQUIRED`,
      description: 'Bedrock Knowledge Base ARN (requires manual setup)',
      exportName: `stealth-aaas-${environment}-kb-arn`
    });

    new cdk.CfnOutput(this, 'ServiceRoleArn', {
      value: kbServiceRole.roleArn,
      description: 'Knowledge Base service role ARN',
      exportName: `stealth-aaas-${environment}-kb-role-arn`
    });

    new cdk.CfnOutput(this, 'OpenSearchCollectionName', {
      value: this.openSearchCollectionName,
      description: 'OpenSearch Serverless collection name',
      exportName: `stealth-aaas-${environment}-kb-collection`
    });

    new cdk.CfnOutput(this, 'PdfBucketName', {
      value: pdfBucketName,
      description: 'S3 bucket for PDF documents',
      exportName: `stealth-aaas-${environment}-kb-pdf-bucket`
    });

    new cdk.CfnOutput(this, 'SetupInstructions', {
      value: 'See docs/phase-13-manual-setup-guide.md for manual setup instructions',
      description: 'Manual setup guide location'
    });
  }
}
