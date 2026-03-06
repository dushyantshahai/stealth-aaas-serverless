#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { getConfig } from '../lib/config';
import { StorageStack } from '../lib/storage-stack';
import { AuthStack } from '../lib/auth-stack';
import { MessagingStack } from '../lib/messaging-stack';
import { LayersStack } from '../lib/layers-stack';
import { ApiStack } from '../lib/api-stack';
import { FunctionsStack } from '../lib/functions-stack';

const app = new cdk.App();

// Get stage from context or environment variable
const stage = app.node.tryGetContext('stage') || process.env.STAGE || 'dev';
const config = getConfig(stage);

// Storage Stack (DynamoDB + S3)
const storageStack = new StorageStack(app, config.projectName + '-' + stage + '-storage', {
  config,
  description: 'Storage resources (DynamoDB tables and S3 buckets)',
});

// Auth Stack (Cognito)
const authStack = new AuthStack(app, config.projectName + '-' + stage + '-auth', {
  config,
  description: 'Authentication resources (Cognito User Pool)',
});

// Messaging Stack (SQS)
const messagingStack = new MessagingStack(app, config.projectName + '-' + stage + '-messaging', {
  config,
  description: 'Messaging resources (SQS queues)',
});

// Layers Stack (Lambda Layers)
const layersStack = new LayersStack(app, config.projectName + '-' + stage + '-layers', {
  config,
  description: 'Lambda layers for common utilities and dependencies',
});

// Functions Stack (Lambda Functions)
const functionsStack = new FunctionsStack(app, config.projectName + '-' + stage + '-functions', {
  config,
  description: 'Lambda functions for API endpoints',
});

// API Stack (API Gateway) - routes are configured in constructor
const apiStack = new ApiStack(app, config.projectName + '-' + stage + '-api', {
  config,
  functionsStack,
  description: 'API Gateway and Lambda functions',
});

app.synth();