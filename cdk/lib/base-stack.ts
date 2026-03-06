import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { EnvironmentConfig } from './config';
import { NamingUtils } from './utils/naming';

export interface BaseStackProps extends cdk.StackProps {
  config: EnvironmentConfig;
}

export class BaseStack extends cdk.Stack {
  protected config: EnvironmentConfig;
  protected naming: NamingUtils;
  
  constructor(scope: Construct, id: string, props: BaseStackProps) {
    super(scope, id, {
      ...props,
      env: {
        account: props.config.account,
        region: props.config.region,
      },
      terminationProtection: props.config.stage === 'prod',
    });
    
    this.config = props.config;
    this.naming = new NamingUtils(props.config);
    
    // Apply tags to all resources in this stack
    Object.entries(props.config.tags).forEach(([key, value]) => {
      cdk.Tags.of(this).add(key, value);
    });
  }
}
