#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';

const app = new cdk.App();

const stack = new cdk.Stack(app, 'TestStack', {
  env: {
    account: '637404140637',
    region: 'us-east-1',
  },
});

new s3.Bucket(stack, 'TestBucket', {
  bucketName: 'test-cdk-bucket-637404140637',
});

app.synth();
