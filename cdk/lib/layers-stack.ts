import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { BaseStack, BaseStackProps } from './base-stack';

export class LayersStack extends BaseStack {
  public readonly commonLayer: lambda.LayerVersion;
  public readonly dependenciesLayer: lambda.LayerVersion;

  constructor(scope: Construct, id: string, props: BaseStackProps) {
    super(scope, id, props);

    // Common utilities layer (pre-built zip)
    this.commonLayer = new lambda.LayerVersion(this, 'commonLayer', {
      description: 'Stealth AaaS Common Utilities (logger, errors, validation, response)',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/layers/common-layer.zip')),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      license: 'MIT',
      removalPolicy: this.config.stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Dependencies layer (pre-built zip)
    this.dependenciesLayer = new lambda.LayerVersion(this, 'dependenciesLayer', {
      description: 'Stealth AaaS Dependencies (AWS SDK, utils)',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/layers/dependencies-layer.zip')),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      license: 'MIT',
      removalPolicy: this.config.stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Outputs
    new cdk.CfnOutput(this, 'CommonLayerArn', {
      value: this.commonLayer.layerVersionArn,
      exportName: this.naming.resourceName('export', 'common-layer-arn'),
    });

    new cdk.CfnOutput(this, 'DependenciesLayerArn', {
      value: this.dependenciesLayer.layerVersionArn,
      exportName: this.naming.resourceName('export', 'dependencies-layer-arn'),
    });
  }
}