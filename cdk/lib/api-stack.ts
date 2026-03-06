import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { BaseStack, BaseStackProps } from './base-stack';
import { FunctionsStack } from './functions-stack';

export interface ApiStackProps extends BaseStackProps {
  functionsStack: FunctionsStack;
}

export class ApiStack extends BaseStack {
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    // Create API Gateway
    this.api = new apigateway.RestApi(this, 'ApiGateway', {
      restApiName: this.naming.apiGatewayName('main'),
      description: 'Stealth AaaS API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
        allowCredentials: false,
        maxAge: cdk.Duration.hours(1),
      },
      binaryMediaTypes: ['application/pdf'],
      deployOptions: {
        stageName: this.config.stage,
        throttlingRateLimit: 1000,
        throttlingBurstLimit: 2000,
      },
    });

    // Create API key for external clients
    const apiKey = new apigateway.ApiKey(this, 'ApiKey', {
      apiKeyName: this.naming.resourceName('api', 'key'),
      description: 'API key for external clients',
      enabled: true,
    });

    // Create usage plan
    const usagePlan = this.api.addUsagePlan('UsagePlan', {
      name: `${this.config.stage}-usage-plan`,
      description: 'Usage plan for API',
      throttle: {
        rateLimit: 100,
        burstLimit: 200,
      },
      quota: {
        limit: 10000,
        period: apigateway.Period.MONTH,
      },
    });

    usagePlan.addApiStage({
      stage: this.api.deploymentStage,
      api: this.api,
    });

    usagePlan.addApiKey(apiKey);

    // Configure all API routes during construction
    this.configureRoutes(props.functionsStack);

    // Outputs
    new cdk.CfnOutput(this, 'ApiId', {
      value: this.api.restApiId,
      exportName: this.naming.resourceName('export', 'api-id'),
    });

    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: this.api.url,
      exportName: this.naming.resourceName('export', 'api-endpoint'),
    });

    new cdk.CfnOutput(this, 'ApiKeyId', {
      value: apiKey.keyId,
      exportName: this.naming.resourceName('export', 'api-key-id'),
    });
  }

  /**
   * Get the Cognito User Pool from the auth stack
   */
  private getUserPool(): cognito.IUserPool {
    // Import user pool from ARN stored in CloudFormation exports
    return cognito.UserPool.fromUserPoolId(this, 'UserPool', 
      cdk.Fn.importValue(this.naming.resourceName('export', 'user-pool-id'))
    );
  }

  /**
   * Add a Lambda integration to the API
   */
  addLambdaIntegration(
    method: string,
    path: string,
    lambdaFunction: lambda.IFunction,
    authorizer?: apigateway.IAuthorizer
  ): void {
    const resource = this.getOrCreateResource(path);
    
    resource.addMethod(method, new apigateway.LambdaIntegration(lambdaFunction, {
      proxy: true,
      integrationResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': "'*'",
          },
        },
      ],
    }), {
      authorizer,
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.Access-Control-Allow-Origin': true,
          },
        },
      ],
    });
  }

  /**
   * Get or create a resource for the given path
   */
  private getOrCreateResource(path: string): apigateway.IResource {
    const parts = path.split('/').filter(Boolean);
    let resource: apigateway.IResource = this.api.root;

    for (const part of parts) {
      const existing = resource.getResource(part);
      if (existing) {
        resource = existing;
      } else {
        resource = resource.addResource(part);
      }
    }

    return resource;
  }

  /**
   * Configure API routes
   */
  private configureRoutes(functionsStack: FunctionsStack): void {
    // Get the Cognito User Pool for authorizer
    const userPool = this.getUserPool();
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      cognitoUserPools: [userPool],
      authorizerName: 'Cognito',
      identitySource: 'method.request.header.Authorization',
    });

    // Auth routes (no authorizer required)
    this.addLambdaIntegration('POST', '/auth/register', functionsStack.registerFunction);
    this.addLambdaIntegration('POST', '/auth/login', functionsStack.loginFunction);
    this.addLambdaIntegration('POST', '/auth/refresh', functionsStack.refreshFunction);
    this.addLambdaIntegration('POST', '/auth/reset-password', functionsStack.resetPasswordFunction);

    // User management routes (requires auth)
    this.addLambdaIntegration('POST', '/users', functionsStack.createUserFunction, authorizer);
    this.addLambdaIntegration('GET', '/users', functionsStack.listUsersFunction, authorizer);
    this.addLambdaIntegration('GET', '/users/{userId}', functionsStack.getUserFunction, authorizer);
    this.addLambdaIntegration('PUT', '/users/{userId}', functionsStack.updateUserFunction, authorizer);
    this.addLambdaIntegration('DELETE', '/users/{userId}', functionsStack.deleteUserFunction, authorizer);

    // Subject management routes (requires auth)
    this.addLambdaIntegration('POST', '/subjects', functionsStack.createSubjectFunction, authorizer);
    this.addLambdaIntegration('GET', '/subjects', functionsStack.listSubjectsFunction, authorizer);
    this.addLambdaIntegration('GET', '/subjects/{subjectId}', functionsStack.getSubjectFunction, authorizer);
    this.addLambdaIntegration('PUT', '/subjects/{subjectId}', functionsStack.updateSubjectFunction, authorizer);
    this.addLambdaIntegration('DELETE', '/subjects/{subjectId}', functionsStack.deleteSubjectFunction, authorizer);

    // Book management routes (requires auth)
    this.addLambdaIntegration('POST', '/books', functionsStack.createBookFunction, authorizer);
    this.addLambdaIntegration('GET', '/books', functionsStack.listBooksFunction, authorizer);
    this.addLambdaIntegration('GET', '/books/{bookId}', functionsStack.getBookFunction, authorizer);
    this.addLambdaIntegration('PUT', '/books/{bookId}', functionsStack.updateBookFunction, authorizer);
    this.addLambdaIntegration('DELETE', '/books/{bookId}', functionsStack.deleteBookFunction, authorizer);
    this.addLambdaIntegration('POST', '/books/{bookId}/upload-url', functionsStack.uploadUrlBookFunction, authorizer);

    // Chapter management routes (requires auth)
    this.addLambdaIntegration('POST', '/chapters', functionsStack.createChapterFunction, authorizer);
    this.addLambdaIntegration('GET', '/chapters', functionsStack.listChaptersFunction, authorizer);
    this.addLambdaIntegration('GET', '/chapters/{chapterId}', functionsStack.getChapterFunction, authorizer);
    this.addLambdaIntegration('PUT', '/chapters/{chapterId}', functionsStack.updateChapterFunction, authorizer);
    this.addLambdaIntegration('DELETE', '/chapters/{chapterId}', functionsStack.deleteChapterFunction, authorizer);

    // Topic management routes (requires auth)
    this.addLambdaIntegration('POST', '/topics', functionsStack.createTopicFunction, authorizer);
    this.addLambdaIntegration('GET', '/topics', functionsStack.listTopicsFunction, authorizer);
    this.addLambdaIntegration('GET', '/topics/{topicId}', functionsStack.getTopicFunction, authorizer);
    this.addLambdaIntegration('PUT', '/topics/{topicId}', functionsStack.updateTopicFunction, authorizer);
    this.addLambdaIntegration('DELETE', '/topics/{topicId}', functionsStack.deleteTopicFunction, authorizer);

    // Subtopic management routes (requires auth)
    this.addLambdaIntegration('POST', '/subtopics', functionsStack.createSubtopicFunction, authorizer);
    this.addLambdaIntegration('GET', '/subtopics', functionsStack.listSubtopicsFunction, authorizer);
    this.addLambdaIntegration('GET', '/subtopics/{subtopicId}', functionsStack.getSubtopicFunction, authorizer);
    this.addLambdaIntegration('PUT', '/subtopics/{subtopicId}', functionsStack.updateSubtopicFunction, authorizer);
    this.addLambdaIntegration('DELETE', '/subtopics/{subtopicId}', functionsStack.deleteSubtopicFunction, authorizer);
  }
}