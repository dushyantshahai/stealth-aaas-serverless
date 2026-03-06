import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { BaseStack, BaseStackProps } from './base-stack';

export class MessagingStack extends BaseStack {
  public readonly pdfProcessingQueue: sqs.Queue;
  public readonly mcqGenerationQueue: sqs.Queue;
  public readonly analyticsAggregationQueue: sqs.Queue;
  public readonly deadLetterQueue: sqs.Queue;
  
  constructor(scope: Construct, id: string, props: BaseStackProps) {
    super(scope, id, props);
    
    // Dead Letter Queue
    this.deadLetterQueue = new sqs.Queue(this, 'DeadLetterQueue', {
      queueName: this.naming.sqsQueueName('dlq'),
      retentionPeriod: cdk.Duration.days(this.config.sqs.messageRetention),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
    });
    
    // PDF Processing Queue
    this.pdfProcessingQueue = this.createQueue('pdf-processing');
    
    // MCQ Generation Queue
    this.mcqGenerationQueue = this.createQueue('mcq-generation');
    
    // Analytics Aggregation Queue
    this.analyticsAggregationQueue = this.createQueue('analytics-aggregation');
    
    // Outputs
    new cdk.CfnOutput(this, 'PdfProcessingQueueUrl', {
      value: this.pdfProcessingQueue.queueUrl,
      exportName: this.naming.resourceName('export', 'pdf-processing-queue-url'),
    });
    
    new cdk.CfnOutput(this, 'McqGenerationQueueUrl', {
      value: this.mcqGenerationQueue.queueUrl,
      exportName: this.naming.resourceName('export', 'mcq-queue-url'),
    });
    
    new cdk.CfnOutput(this, 'AnalyticsAggregationQueueUrl', {
      value: this.analyticsAggregationQueue.queueUrl,
      exportName: this.naming.resourceName('export', 'analytics-queue-url'),
    });
  }
  
  private createQueue(queueName: string): sqs.Queue {
    return new sqs.Queue(this, `${queueName}Queue`, {
      queueName: this.naming.sqsQueueName(queueName),
      visibilityTimeout: cdk.Duration.seconds(this.config.sqs.visibilityTimeout),
      retentionPeriod: cdk.Duration.days(this.config.sqs.messageRetention),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      deadLetterQueue: {
        queue: this.deadLetterQueue,
        maxReceiveCount: this.config.sqs.maxReceiveCount,
      },
    });
  }
}
