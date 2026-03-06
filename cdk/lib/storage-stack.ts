import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { BaseStack, BaseStackProps } from './base-stack';

export class StorageStack extends BaseStack {
  public readonly institutesTable: dynamodb.Table;
  public readonly usersTable: dynamodb.Table;
  public readonly subjectsTable: dynamodb.Table;
  public readonly booksTable: dynamodb.Table;
  public readonly chaptersTable: dynamodb.Table;
  public readonly topicsTable: dynamodb.Table;
  public readonly subtopicsTable: dynamodb.Table;
  public readonly chunksTable: dynamodb.Table;
  public readonly mcqsTable: dynamodb.Table;
  public readonly assessmentsTable: dynamodb.Table;
  public readonly batchesTable: dynamodb.Table;
  public readonly assignmentsTable: dynamodb.Table;
  public readonly submissionsTable: dynamodb.Table;
  
  public readonly pdfBucket: s3.Bucket;
  public readonly frontendBucket: s3.Bucket;
  
  constructor(scope: Construct, id: string, props: BaseStackProps) {
    super(scope, id, props);
    
    // DynamoDB Tables
    this.institutesTable = this.createTable('institutes', 'instituteId');
    this.usersTable = this.createTableWithGSI('users', 'userId', [
      { indexName: 'instituteId-index', partitionKey: 'instituteId' },
      { indexName: 'email-index', partitionKey: 'email' },
    ]);
    this.subjectsTable = this.createTableWithGSI('subjects', 'subjectId', [
      { indexName: 'instituteId-index', partitionKey: 'instituteId' },
    ]);
    this.booksTable = this.createTableWithGSI('books', 'bookId', [
      { indexName: 'subjectId-index', partitionKey: 'subjectId' },
    ]);
    this.chaptersTable = this.createTableWithGSI('chapters', 'chapterId', [
      { indexName: 'bookId-index', partitionKey: 'bookId' },
    ]);
    this.topicsTable = this.createTableWithGSI('topics', 'topicId', [
      { indexName: 'chapterId-index', partitionKey: 'chapterId' },
    ]);
    this.subtopicsTable = this.createTableWithGSI('subtopics', 'subtopicId', [
      { indexName: 'topicId-index', partitionKey: 'topicId' },
    ]);
    this.chunksTable = this.createTableWithGSI('chunks', 'chunkId', [
      { indexName: 'subtopicId-index', partitionKey: 'subtopicId' },
    ]);
    this.mcqsTable = this.createTableWithGSI('mcqs', 'mcqId', [
      { indexName: 'chunkId-index', partitionKey: 'chunkId' },
    ]);
    this.assessmentsTable = this.createTableWithGSI('assessments', 'assessmentId', [
      { indexName: 'instituteId-index', partitionKey: 'instituteId' },
    ]);
    this.batchesTable = this.createTableWithGSI('batches', 'batchId', [
      { indexName: 'instituteId-index', partitionKey: 'instituteId' },
    ]);
    this.assignmentsTable = this.createTableWithGSI('assignments', 'assignmentId', [
      { indexName: 'assessmentId-index', partitionKey: 'assessmentId' },
      { indexName: 'batchId-index', partitionKey: 'batchId' },
    ]);
    this.submissionsTable = this.createTableWithGSI('submissions', 'submissionId', [
      { indexName: 'assessmentId-index', partitionKey: 'assessmentId' },
      { indexName: 'studentId-index', partitionKey: 'studentId' },
    ]);
    
    // S3 Buckets
    this.pdfBucket = new s3.Bucket(this, 'PdfBucket', {
      bucketName: this.naming.s3BucketName('pdfs'),
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      lifecycleRules: [
        {
          transitions: [
            {
              storageClass: s3.StorageClass.INTELLIGENT_TIERING,
              transitionAfter: cdk.Duration.days(this.config.s3.pdfBucketLifecycle.intelligentTieringDays),
            },
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(this.config.s3.pdfBucketLifecycle.glacierDays),
            },
          ],
        },
      ],
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
          allowedOrigins: ['*'], // TODO: Restrict to frontend domain
          allowedHeaders: ['*'],
          maxAge: 3600,
        },
      ],
      removalPolicy: this.config.stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });
    
    this.frontendBucket = new s3.Bucket(this, 'FrontendBucket', {
      bucketName: this.naming.s3BucketName('frontend'),
      encryption: s3.BucketEncryption.S3_MANAGED,
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: '404.html',
      publicReadAccess: true,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: false,
        blockPublicPolicy: false,
        ignorePublicAcls: false,
        restrictPublicBuckets: false,
      }),
      removalPolicy: this.config.stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });
    
    // Outputs
    new cdk.CfnOutput(this, 'PdfBucketName', {
      value: this.pdfBucket.bucketName,
      exportName: this.naming.resourceName('export', 'pdf-bucket-name'),
    });
    
    new cdk.CfnOutput(this, 'FrontendBucketName', {
      value: this.frontendBucket.bucketName,
      exportName: this.naming.resourceName('export', 'frontend-bucket-name'),
    });
    
    // Table name exports
    new cdk.CfnOutput(this, 'UsersTableName', {
      value: this.usersTable.tableName,
      exportName: this.naming.resourceName('export', 'users-table-name'),
    });
    
    new cdk.CfnOutput(this, 'InstitutesTableName', {
      value: this.institutesTable.tableName,
      exportName: this.naming.resourceName('export', 'institutes-table-name'),
    });
    
    new cdk.CfnOutput(this, 'SubjectsTableName', {
      value: this.subjectsTable.tableName,
      exportName: this.naming.resourceName('export', 'subjects-table-name'),
    });
    
    new cdk.CfnOutput(this, 'BooksTableName', {
      value: this.booksTable.tableName,
      exportName: this.naming.resourceName('export', 'books-table-name'),
    });
    
    new cdk.CfnOutput(this, 'ChaptersTableName', {
      value: this.chaptersTable.tableName,
      exportName: this.naming.resourceName('export', 'chapters-table-name'),
    });
    
    new cdk.CfnOutput(this, 'TopicsTableName', {
      value: this.topicsTable.tableName,
      exportName: this.naming.resourceName('export', 'topics-table-name'),
    });
    
    new cdk.CfnOutput(this, 'SubtopicsTableName', {
      value: this.subtopicsTable.tableName,
      exportName: this.naming.resourceName('export', 'subtopics-table-name'),
    });
    
    new cdk.CfnOutput(this, 'ChunksTableName', {
      value: this.chunksTable.tableName,
      exportName: this.naming.resourceName('export', 'chunks-table-name'),
    });
    
    new cdk.CfnOutput(this, 'McqsTableName', {
      value: this.mcqsTable.tableName,
      exportName: this.naming.resourceName('export', 'mcqs-table-name'),
    });
    
    new cdk.CfnOutput(this, 'AssessmentsTableName', {
      value: this.assessmentsTable.tableName,
      exportName: this.naming.resourceName('export', 'assessments-table-name'),
    });
    
    new cdk.CfnOutput(this, 'BatchesTableName', {
      value: this.batchesTable.tableName,
      exportName: this.naming.resourceName('export', 'batches-table-name'),
    });
    
    new cdk.CfnOutput(this, 'AssignmentsTableName', {
      value: this.assignmentsTable.tableName,
      exportName: this.naming.resourceName('export', 'assignments-table-name'),
    });
    
    new cdk.CfnOutput(this, 'SubmissionsTableName', {
      value: this.submissionsTable.tableName,
      exportName: this.naming.resourceName('export', 'submissions-table-name'),
    });
  }
  
  private createTable(tableName: string, partitionKey: string): dynamodb.Table {
    return new dynamodb.Table(this, `${tableName}Table`, {
      tableName: this.naming.dynamoTableName(tableName),
      partitionKey: {
        name: partitionKey,
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: this.config.dynamodb.billingMode === 'PAY_PER_REQUEST'
        ? dynamodb.BillingMode.PAY_PER_REQUEST
        : dynamodb.BillingMode.PROVISIONED,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: this.config.dynamodb.pointInTimeRecovery,
      },
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: this.config.stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });
  }
  
  private createTableWithGSI(
    tableName: string,
    partitionKey: string,
    gsis: Array<{ indexName: string; partitionKey: string; sortKey?: string }>
  ): dynamodb.Table {
    const table = this.createTable(tableName, partitionKey);
    
    gsis.forEach((gsi) => {
      table.addGlobalSecondaryIndex({
        indexName: gsi.indexName,
        partitionKey: {
          name: gsi.partitionKey,
          type: dynamodb.AttributeType.STRING,
        },
        sortKey: gsi.sortKey
          ? {
              name: gsi.sortKey,
              type: dynamodb.AttributeType.STRING,
            }
          : undefined,
      });
    });
    
    return table;
  }
}
