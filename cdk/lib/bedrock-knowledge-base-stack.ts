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
import * as s3 from 'aws-sdk/clients/s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import * as path from 'path';

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
    // 2. Create Lambda Function for Custom Resource
    // ============================================================================

    const kbCustomResourceRole = new iam.Role(this, 'KBCustomResourceRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')
      ],
      inlinePolicies: {
        bedrockAccess: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'bedrock:CreateKnowledgeBase',
                'bedrock:DescribeKnowledgeBase',
                'bedrock:DeleteKnowledgeBase',
                'bedrock:CreateDataSource',
                'bedrock:DescribeDataSource',
                'bedrock:DeleteDataSource',
                'bedrock:UpdateKnowledgeBase'
              ],
              resources: ['*']
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'iam:PassRole'
              ],
              resources: [kbServiceRole.roleArn]
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'aoss:CreateCollection',
                'aoss:DescribeCollection',
                'aoss:DeleteCollection',
                'aoss:UpdateCollection'
              ],
              resources: ['*']
            })
          ]
        })
      }
    });

    const kbCustomResourceFunction = new lambda.Function(
      this,
      'KBCustomResourceFunction',
      {
        runtime: lambda.Runtime.PYTHON_3_11,
        handler: 'index.handler',
        role: kbCustomResourceRole,
        timeout: cdk.Duration.minutes(15),
        memorySize: 512,
        code: lambda.Code.fromInline(`
import json
import boto3
import cfnresponse
import time

bedrock = boto3.client('bedrock')
aoss = boto3.client('opensearchserverless')

def handler(event, context):
    try:
        request_type = event['RequestType']
        props = event['ResourceProperties']
        
        kb_name = props['KnowledgeBaseName']
        kb_description = props['KnowledgeBaseDescription']
        service_role_arn = props['ServiceRoleArn']
        s3_bucket = props['S3Bucket']
        collection_name = props['CollectionName']
        environment = props['Environment']
        
        if request_type == 'Create':
            # Create OpenSearch collection
            print(f"Creating OpenSearch collection: {collection_name}")
            try:
                aoss.create_collection(
                    name=collection_name,
                    type='VECTORSEARCH'
                )
                print(f"OpenSearch collection created: {collection_name}")
            except aoss.exceptions.CollectionAlreadyExistsException:
                print(f"OpenSearch collection already exists: {collection_name}")
            
            # Wait for collection to be active
            time.sleep(10)
            
            # Create Knowledge Base
            print(f"Creating Knowledge Base: {kb_name}")
            response = bedrock.create_knowledge_base(
                name=kb_name,
                description=kb_description,
                roleArn=service_role_arn,
                knowledgeBaseConfiguration={
                    'type': 'VECTOR',
                    'vectorKnowledgeBaseConfiguration': {
                        'embeddingModelArn': f'arn:aws:bedrock:{props["Region"]}::foundation-model/amazon.titan-embed-text-v1'
                    }
                },
                storageConfiguration={
                    'type': 'OPENSEARCH_SERVERLESS',
                    'opensearchServerlessConfiguration': {
                        'collectionArn': f'arn:aws:aoss:{props["Region"]}:{props["AccountId"]}:collection/{collection_name}',
                        'vectorIndexName': f'stealth-aaas-{environment}-kb-index',
                        'fieldMapping': {
                            'vectorField': 'vector',
                            'textField': 'text',
                            'metadataField': 'metadata'
                        }
                    }
                }
            )
            
            kb_id = response['knowledgeBaseId']
            print(f"Knowledge Base created: {kb_id}")
            
            # Wait for KB to be active
            time.sleep(5)
            
            # Create Data Source
            print(f"Creating Data Source for S3 bucket: {s3_bucket}")
            ds_response = bedrock.create_data_source(
                knowledgeBaseId=kb_id,
                name=f'stealth-aaas-{environment}-pdf-source',
                description='PDF documents from S3',
                dataSourceConfiguration={
                    'type': 'S3',
                    's3Configuration': {
                        'bucketArn': f'arn:aws:s3:::{s3_bucket}',
                        'inclusionPatterns': ['*.pdf'],
                        'exclusionPatterns': []
                    }
                },
                vectorIngestionConfiguration={
                    'chunkingConfiguration': {
                        'chunkingStrategy': 'FIXED_SIZE',
                        'fixedSizeChunkingConfiguration': {
                            'maxTokens': 1000,
                            'overlapPercentage': 20
                        }
                    }
                }
            )
            
            data_source_id = ds_response['dataSource']['dataSourceId']
            print(f"Data Source created: {data_source_id}")
            
            response_data = {
                'KnowledgeBaseId': kb_id,
                'DataSourceId': data_source_id,
                'CollectionName': collection_name
            }
            
            cfnresponse.send(event, context, cfnresponse.SUCCESS, response_data, kb_id)
            
        elif request_type == 'Delete':
            kb_id = event['PhysicalResourceId']
            print(f"Deleting Knowledge Base: {kb_id}")
            
            try:
                # Get data sources
                ds_response = bedrock.list_data_sources(knowledgeBaseId=kb_id)
                
                # Delete data sources
                for ds in ds_response.get('dataSourceSummaries', []):
                    print(f"Deleting Data Source: {ds['dataSourceId']}")
                    bedrock.delete_data_source(
                        knowledgeBaseId=kb_id,
                        dataSourceId=ds['dataSourceId']
                    )
                
                # Delete Knowledge Base
                bedrock.delete_knowledge_base(knowledgeBaseId=kb_id)
                print(f"Knowledge Base deleted: {kb_id}")
            except Exception as e:
                print(f"Error deleting Knowledge Base: {str(e)}")
            
            # Delete OpenSearch collection
            try:
                print(f"Deleting OpenSearch collection: {collection_name}")
                aoss.delete_collection(name=collection_name)
                print(f"OpenSearch collection deleted: {collection_name}")
            except Exception as e:
                print(f"Error deleting OpenSearch collection: {str(e)}")
            
            cfnresponse.send(event, context, cfnresponse.SUCCESS, {}, kb_id)
            
        else:
            cfnresponse.send(event, context, cfnresponse.SUCCESS, {}, event['PhysicalResourceId'])
            
    except Exception as e:
        print(f"Error: {str(e)}")
        cfnresponse.send(event, context, cfnresponse.FAILED, {}, 'Error')
`)
      }
    );

    // ============================================================================
    // 3. Create Custom Resource for Knowledge Base
    // ============================================================================

    const kbCustomResource = new cr.AwsCustomResource(this, 'KBCustomResource', {
      onCreate: {
        service: 'lambda',
        action: 'invoke',
        parameters: {
          FunctionName: kbCustomResourceFunction.functionName,
          InvocationType: 'RequestResponse',
          Payload: JSON.stringify({
            RequestType: 'Create',
            ResourceProperties: {
              KnowledgeBaseName: `stealth-aaas-${environment}-kb`,
              KnowledgeBaseDescription: 'Knowledge Base for Stealth AaaS PDF documents',
              ServiceRoleArn: kbServiceRole.roleArn,
              S3Bucket: pdfBucketName,
              CollectionName: this.openSearchCollectionName,
              Environment: environment,
              Region: region,
              AccountId: accountId
            }
          })
        },
        physicalResourceId: cr.PhysicalResourceId.fromResponse('Payload.knowledgeBaseId')
      },
      onDelete: {
        service: 'lambda',
        action: 'invoke',
        parameters: {
          FunctionName: kbCustomResourceFunction.functionName,
          InvocationType: 'RequestResponse',
          Payload: JSON.stringify({
            RequestType: 'Delete',
            PhysicalResourceId: kbCustomResource.getResponseField('Payload.knowledgeBaseId')
          })
        }
      },
      policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
        resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE
      })
    });

    kbCustomResourceFunction.grantInvoke(kbCustomResource);

    // ============================================================================
    // 4. Create Outputs
    // ============================================================================

    this.knowledgeBaseId = new cdk.CfnOutput(this, 'KnowledgeBaseId', {
      value: kbCustomResource.getResponseField('Payload.knowledgeBaseId'),
      description: 'Bedrock Knowledge Base ID',
      exportName: `stealth-aaas-${environment}-kb-id`
    });

    this.knowledgeBaseArn = new cdk.CfnOutput(this, 'KnowledgeBaseArn', {
      value: `arn:aws:bedrock:${region}:${accountId}:knowledge-base/${kbCustomResource.getResponseField('Payload.knowledgeBaseId')}`,
      description: 'Bedrock Knowledge Base ARN',
      exportName: `stealth-aaas-${environment}-kb-arn`
    });

    new cdk.CfnOutput(this, 'DataSourceId', {
      value: kbCustomResource.getResponseField('Payload.dataSourceId'),
      description: 'Knowledge Base Data Source ID',
      exportName: `stealth-aaas-${environment}-kb-ds-id`
    });

    new cdk.CfnOutput(this, 'OpenSearchCollectionName', {
      value: this.openSearchCollectionName,
      description: 'OpenSearch Serverless collection name',
      exportName: `stealth-aaas-${environment}-kb-collection`
    });

    new cdk.CfnOutput(this, 'ServiceRoleArn', {
      value: kbServiceRole.roleArn,
      description: 'Knowledge Base service role ARN',
      exportName: `stealth-aaas-${environment}-kb-role-arn`
    });
  }
}
