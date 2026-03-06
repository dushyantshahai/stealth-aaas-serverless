import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { BaseStack, BaseStackProps } from './base-stack';

export class AuthStack extends BaseStack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  
  constructor(scope: Construct, id: string, props: BaseStackProps) {
    super(scope, id, props);
    
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: this.naming.cognitoPoolName('users'),
      signInAliases: {
        email: true,
      },
      selfSignUpEnabled: false, // Admin creates users
      autoVerify: {
        email: true,
      },
      passwordPolicy: {
        minLength: this.config.cognito.passwordPolicy.minLength,
        requireLowercase: this.config.cognito.passwordPolicy.requireLowercase,
        requireUppercase: this.config.cognito.passwordPolicy.requireUppercase,
        requireDigits: this.config.cognito.passwordPolicy.requireNumbers,
        requireSymbols: this.config.cognito.passwordPolicy.requireSymbols,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      customAttributes: {
        instituteId: new cognito.StringAttribute({ mutable: true }),
        userRole: new cognito.StringAttribute({ mutable: true }),
      },
      removalPolicy: this.config.stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });
    
    this.userPoolClient = this.userPool.addClient('WebClient', {
      userPoolClientName: this.naming.resourceName('client', 'web'),
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      accessTokenValidity: cdk.Duration.hours(this.config.cognito.tokenValidity.accessToken),
      idTokenValidity: cdk.Duration.hours(this.config.cognito.tokenValidity.idToken),
      refreshTokenValidity: cdk.Duration.days(this.config.cognito.tokenValidity.refreshToken),
      generateSecret: false,
    });
    
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      exportName: this.naming.resourceName('export', 'user-pool-id'),
    });
    
    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      exportName: this.naming.resourceName('export', 'user-pool-client-id'),
    });
  }
}
