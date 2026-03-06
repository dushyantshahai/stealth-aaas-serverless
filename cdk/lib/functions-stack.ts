import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cdk from 'aws-cdk-lib';
import * as path from 'path';
import { Construct } from 'constructs';
import { BaseStack, BaseStackProps } from './base-stack';

export class FunctionsStack extends BaseStack {
  // Auth functions
  public readonly registerFunction: lambda.IFunction;
  public readonly loginFunction: lambda.IFunction;
  public readonly refreshFunction: lambda.IFunction;
  public readonly resetPasswordFunction: lambda.IFunction;

  // User management functions
  public readonly createUserFunction: lambda.IFunction;
  public readonly listUsersFunction: lambda.IFunction;
  public readonly getUserFunction: lambda.IFunction;
  public readonly updateUserFunction: lambda.IFunction;
  public readonly deleteUserFunction: lambda.IFunction;

  // Subject management functions
  public readonly createSubjectFunction: lambda.IFunction;
  public readonly listSubjectsFunction: lambda.IFunction;
  public readonly getSubjectFunction: lambda.IFunction;
  public readonly updateSubjectFunction: lambda.IFunction;
  public readonly deleteSubjectFunction: lambda.IFunction;

  // Book management functions
  public readonly createBookFunction: lambda.IFunction;
  public readonly listBooksFunction: lambda.IFunction;
  public readonly getBookFunction: lambda.IFunction;
  public readonly updateBookFunction: lambda.IFunction;
  public readonly deleteBookFunction: lambda.IFunction;
  public readonly uploadUrlBookFunction: lambda.IFunction;

  // Chapter management functions
  public readonly createChapterFunction: lambda.IFunction;
  public readonly listChaptersFunction: lambda.IFunction;
  public readonly getChapterFunction: lambda.IFunction;
  public readonly updateChapterFunction: lambda.IFunction;
  public readonly deleteChapterFunction: lambda.IFunction;

  // Topic management functions
  public readonly createTopicFunction: lambda.IFunction;
  public readonly listTopicsFunction: lambda.IFunction;
  public readonly getTopicFunction: lambda.IFunction;
  public readonly updateTopicFunction: lambda.IFunction;
  public readonly deleteTopicFunction: lambda.IFunction;

  // Subtopic management functions
  public readonly createSubtopicFunction: lambda.IFunction;
  public readonly listSubtopicsFunction: lambda.IFunction;
  public readonly getSubtopicFunction: lambda.IFunction;
  public readonly updateSubtopicFunction: lambda.IFunction;
  public readonly deleteSubtopicFunction: lambda.IFunction;

  // PDF processing functions
  public readonly pdfUploadHandlerFunction: lambda.IFunction;
  public readonly pdfProcessorFunction: lambda.IFunction;

  constructor(scope: Construct, id: string, props: BaseStackProps) {
    super(scope, id, props);

    // Get layer ARNs from CloudFormation exports
    const commonLayerArn = cdk.Fn.importValue(this.naming.resourceName('export', 'common-layer-arn'));
    const dependenciesLayerArn = cdk.Fn.importValue(this.naming.resourceName('export', 'dependencies-layer-arn'));

    const commonLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'CommonLayer', commonLayerArn);
    const dependenciesLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'DependenciesLayer', dependenciesLayerArn);

    // Base path for Lambda functions
    const lambdaPath = path.join(__dirname, '../../lambda');

    // Register Lambda function
    this.registerFunction = new lambda.Function(this, 'RegisterFunction', {
      functionName: this.naming.lambdaName('auth-register'),
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'register.index',
      code: lambda.Code.fromAsset(path.join(lambdaPath, 'api/auth')),
      layers: [commonLayer, dependenciesLayer],
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      environment: {
        STAGE: this.config.stage,
        COGNITO_USER_POOL_ID: cdk.Fn.importValue(this.naming.resourceName('export', 'user-pool-id')),
        COGNITO_CLIENT_ID: cdk.Fn.importValue(this.naming.resourceName('export', 'user-pool-client-id')),
        DYNAMODB_TABLE_PREFIX: this.config.projectName + '-' + this.config.stage,
      },
      description: 'User registration Lambda',
    });

    // Login Lambda function
    this.loginFunction = new lambda.Function(this, 'LoginFunction', {
      functionName: this.naming.lambdaName('auth-login'),
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'login.index',
      code: lambda.Code.fromAsset(path.join(lambdaPath, 'api/auth')),
      layers: [commonLayer, dependenciesLayer],
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      environment: {
        STAGE: this.config.stage,
        COGNITO_USER_POOL_ID: cdk.Fn.importValue(this.naming.resourceName('export', 'user-pool-id')),
        COGNITO_CLIENT_ID: cdk.Fn.importValue(this.naming.resourceName('export', 'user-pool-client-id')),
        DYNAMODB_TABLE_PREFIX: this.config.projectName + '-' + this.config.stage,
      },
      description: 'User login Lambda',
    });

    // Refresh Lambda function
    this.refreshFunction = new lambda.Function(this, 'RefreshFunction', {
      functionName: this.naming.lambdaName('auth-refresh'),
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'refresh.index',
      code: lambda.Code.fromAsset(path.join(lambdaPath, 'api/auth')),
      layers: [commonLayer, dependenciesLayer],
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      environment: {
        STAGE: this.config.stage,
        COGNITO_CLIENT_ID: cdk.Fn.importValue(this.naming.resourceName('export', 'user-pool-client-id')),
      },
      description: 'Token refresh Lambda',
    });

    // Reset password Lambda function
    this.resetPasswordFunction = new lambda.Function(this, 'ResetPasswordFunction', {
      functionName: this.naming.lambdaName('auth-reset-password'),
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'reset-password.index',
      code: lambda.Code.fromAsset(path.join(lambdaPath, 'api/auth')),
      layers: [commonLayer, dependenciesLayer],
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      environment: {
        STAGE: this.config.stage,
        COGNITO_CLIENT_ID: cdk.Fn.importValue(this.naming.resourceName('export', 'user-pool-client-id')),
      },
      description: 'Password reset Lambda',
    });

    // Create user Lambda function (Admin only)
    this.createUserFunction = new lambda.Function(this, 'CreateUserFunction', {
      functionName: this.naming.lambdaName('users-create'),
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'create.index',
      code: lambda.Code.fromAsset(path.join(lambdaPath, 'api/users')),
      layers: [commonLayer, dependenciesLayer],
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      environment: {
        STAGE: this.config.stage,
        COGNITO_USER_POOL_ID: cdk.Fn.importValue(this.naming.resourceName('export', 'user-pool-id')),
        USERS_TABLE: cdk.Fn.importValue(this.naming.resourceName('export', 'users-table-name')),
      },
      description: 'Create user Lambda (Admin only)',
    });

    // List users Lambda function
    this.listUsersFunction = new lambda.Function(this, 'ListUsersFunction', {
      functionName: this.naming.lambdaName('users-list'),
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'list.index',
      code: lambda.Code.fromAsset(path.join(lambdaPath, 'api/users')),
      layers: [commonLayer, dependenciesLayer],
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      environment: {
        STAGE: this.config.stage,
        USERS_TABLE: cdk.Fn.importValue(this.naming.resourceName('export', 'users-table-name')),
      },
      description: 'List users Lambda',
    });

    // Get user Lambda function
    this.getUserFunction = new lambda.Function(this, 'GetUserFunction', {
      functionName: this.naming.lambdaName('users-get'),
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'get.index',
      code: lambda.Code.fromAsset(path.join(lambdaPath, 'api/users')),
      layers: [commonLayer, dependenciesLayer],
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      environment: {
        STAGE: this.config.stage,
        USERS_TABLE: cdk.Fn.importValue(this.naming.resourceName('export', 'users-table-name')),
      },
      description: 'Get user Lambda',
    });

    // Update user Lambda function
    this.updateUserFunction = new lambda.Function(this, 'UpdateUserFunction', {
      functionName: this.naming.lambdaName('users-update'),
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'update.index',
      code: lambda.Code.fromAsset(path.join(lambdaPath, 'api/users')),
      layers: [commonLayer, dependenciesLayer],
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      environment: {
        STAGE: this.config.stage,
        COGNITO_USER_POOL_ID: cdk.Fn.importValue(this.naming.resourceName('export', 'user-pool-id')),
        USERS_TABLE: cdk.Fn.importValue(this.naming.resourceName('export', 'users-table-name')),
      },
      description: 'Update user Lambda',
    });

    // Delete user Lambda function (Admin only)
    this.deleteUserFunction = new lambda.Function(this, 'DeleteUserFunction', {
      functionName: this.naming.lambdaName('users-delete'),
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'delete.index',
      code: lambda.Code.fromAsset(path.join(lambdaPath, 'api/users')),
      layers: [commonLayer, dependenciesLayer],
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      environment: {
        STAGE: this.config.stage,
        COGNITO_USER_POOL_ID: cdk.Fn.importValue(this.naming.resourceName('export', 'user-pool-id')),
        USERS_TABLE: cdk.Fn.importValue(this.naming.resourceName('export', 'users-table-name')),
      },
      description: 'Delete user Lambda (Admin only)',
    });

    // Create subject Lambda function
    this.createSubjectFunction = new lambda.Function(this, 'CreateSubjectFunction', {
      functionName: this.naming.lambdaName('subjects-create'),
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'create.index',
      code: lambda.Code.fromAsset(path.join(lambdaPath, 'api/subjects')),
      layers: [commonLayer, dependenciesLayer],
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      environment: {
        STAGE: this.config.stage,
        SUBJECTS_TABLE: cdk.Fn.importValue(this.naming.resourceName('export', 'subjects-table-name')),
      },
      description: 'Create subject Lambda',
    });

    // List subjects Lambda function
    this.listSubjectsFunction = new lambda.Function(this, 'ListSubjectsFunction', {
      functionName: this.naming.lambdaName('subjects-list'),
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'list.index',
      code: lambda.Code.fromAsset(path.join(lambdaPath, 'api/subjects')),
      layers: [commonLayer, dependenciesLayer],
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      environment: {
        STAGE: this.config.stage,
        SUBJECTS_TABLE: cdk.Fn.importValue(this.naming.resourceName('export', 'subjects-table-name')),
      },
      description: 'List subjects Lambda',
    });

    // Get subject Lambda function
    this.getSubjectFunction = new lambda.Function(this, 'GetSubjectFunction', {
      functionName: this.naming.lambdaName('subjects-get'),
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'get.index',
      code: lambda.Code.fromAsset(path.join(lambdaPath, 'api/subjects')),
      layers: [commonLayer, dependenciesLayer],
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      environment: {
        STAGE: this.config.stage,
        SUBJECTS_TABLE: cdk.Fn.importValue(this.naming.resourceName('export', 'subjects-table-name')),
      },
      description: 'Get subject Lambda',
    });

    // Update subject Lambda function
    this.updateSubjectFunction = new lambda.Function(this, 'UpdateSubjectFunction', {
      functionName: this.naming.lambdaName('subjects-update'),
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'update.index',
      code: lambda.Code.fromAsset(path.join(lambdaPath, 'api/subjects')),
      layers: [commonLayer, dependenciesLayer],
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      environment: {
        STAGE: this.config.stage,
        SUBJECTS_TABLE: cdk.Fn.importValue(this.naming.resourceName('export', 'subjects-table-name')),
      },
      description: 'Update subject Lambda',
    });

    // Delete subject Lambda function
    this.deleteSubjectFunction = new lambda.Function(this, 'DeleteSubjectFunction', {
      functionName: this.naming.lambdaName('subjects-delete'),
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'delete.index',
      code: lambda.Code.fromAsset(path.join(lambdaPath, 'api/subjects')),
      layers: [commonLayer, dependenciesLayer],
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      environment: {
        STAGE: this.config.stage,
        SUBJECTS_TABLE: cdk.Fn.importValue(this.naming.resourceName('export', 'subjects-table-name')),
        BOOKS_TABLE: cdk.Fn.importValue(this.naming.resourceName('export', 'books-table-name')),
      },
      description: 'Delete subject Lambda',
    });

    // Outputs
    new cdk.CfnOutput(this, 'RegisterFunctionArn', {
      value: this.registerFunction.functionArn,
      exportName: this.naming.resourceName('export', 'register-function-arn'),
    });

    new cdk.CfnOutput(this, 'LoginFunctionArn', {
      value: this.loginFunction.functionArn,
      exportName: this.naming.resourceName('export', 'login-function-arn'),
    });

    new cdk.CfnOutput(this, 'RefreshFunctionArn', {
      value: this.refreshFunction.functionArn,
      exportName: this.naming.resourceName('export', 'refresh-function-arn'),
    });

    new cdk.CfnOutput(this, 'ResetPasswordFunctionArn', {
      value: this.resetPasswordFunction.functionArn,
      exportName: this.naming.resourceName('export', 'reset-password-function-arn'),
    });

    new cdk.CfnOutput(this, 'CreateUserFunctionArn', {
      value: this.createUserFunction.functionArn,
      exportName: this.naming.resourceName('export', 'create-user-function-arn'),
    });

    new cdk.CfnOutput(this, 'ListUsersFunctionArn', {
      value: this.listUsersFunction.functionArn,
      exportName: this.naming.resourceName('export', 'list-users-function-arn'),
    });

    new cdk.CfnOutput(this, 'GetUserFunctionArn', {
      value: this.getUserFunction.functionArn,
      exportName: this.naming.resourceName('export', 'get-user-function-arn'),
    });

    new cdk.CfnOutput(this, 'UpdateUserFunctionArn', {
      value: this.updateUserFunction.functionArn,
      exportName: this.naming.resourceName('export', 'update-user-function-arn'),
    });

    new cdk.CfnOutput(this, 'DeleteUserFunctionArn', {
      value: this.deleteUserFunction.functionArn,
      exportName: this.naming.resourceName('export', 'delete-user-function-arn'),
    });

    new cdk.CfnOutput(this, 'CreateSubjectFunctionArn', {
      value: this.createSubjectFunction.functionArn,
      exportName: this.naming.resourceName('export', 'create-subject-function-arn'),
    });

    new cdk.CfnOutput(this, 'ListSubjectsFunctionArn', {
      value: this.listSubjectsFunction.functionArn,
      exportName: this.naming.resourceName('export', 'list-subjects-function-arn'),
    });

    new cdk.CfnOutput(this, 'GetSubjectFunctionArn', {
      value: this.getSubjectFunction.functionArn,
      exportName: this.naming.resourceName('export', 'get-subject-function-arn'),
    });

    new cdk.CfnOutput(this, 'UpdateSubjectFunctionArn', {
      value: this.updateSubjectFunction.functionArn,
      exportName: this.naming.resourceName('export', 'update-subject-function-arn'),
    });

    new cdk.CfnOutput(this, 'DeleteSubjectFunctionArn', {
      value: this.deleteSubjectFunction.functionArn,
      exportName: this.naming.resourceName('export', 'delete-subject-function-arn'),
    });

    // Book management functions
    this.createBookFunction = new lambda.Function(this, 'CreateBookFunction', {
      functionName: this.naming.lambdaName('books-create'),
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'create.index',
      code: lambda.Code.fromAsset(path.join(lambdaPath, 'api/books')),
      layers: [commonLayer, dependenciesLayer],
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      environment: {
        STAGE: this.config.stage,
        BOOKS_TABLE: cdk.Fn.importValue(this.naming.resourceName('export', 'books-table-name')),
        SUBJECTS_TABLE: cdk.Fn.importValue(this.naming.resourceName('export', 'subjects-table-name')),
      },
      description: 'Create book Lambda',
    });

    this.listBooksFunction = new lambda.Function(this, 'ListBooksFunction', {
      functionName: this.naming.lambdaName('books-list'),
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'list.index',
      code: lambda.Code.fromAsset(path.join(lambdaPath, 'api/books')),
      layers: [commonLayer, dependenciesLayer],
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      environment: {
        STAGE: this.config.stage,
        BOOKS_TABLE: cdk.Fn.importValue(this.naming.resourceName('export', 'books-table-name')),
      },
      description: 'List books Lambda',
    });

    this.getBookFunction = new lambda.Function(this, 'GetBookFunction', {
      functionName: this.naming.lambdaName('books-get'),
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'get.index',
      code: lambda.Code.fromAsset(path.join(lambdaPath, 'api/books')),
      layers: [commonLayer, dependenciesLayer],
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      environment: {
        STAGE: this.config.stage,
        BOOKS_TABLE: cdk.Fn.importValue(this.naming.resourceName('export', 'books-table-name')),
      },
      description: 'Get book Lambda',
    });

    this.updateBookFunction = new lambda.Function(this, 'UpdateBookFunction', {
      functionName: this.naming.lambdaName('books-update'),
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'update.index',
      code: lambda.Code.fromAsset(path.join(lambdaPath, 'api/books')),
      layers: [commonLayer, dependenciesLayer],
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      environment: {
        STAGE: this.config.stage,
        BOOKS_TABLE: cdk.Fn.importValue(this.naming.resourceName('export', 'books-table-name')),
      },
      description: 'Update book Lambda',
    });

    this.deleteBookFunction = new lambda.Function(this, 'DeleteBookFunction', {
      functionName: this.naming.lambdaName('books-delete'),
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'delete.index',
      code: lambda.Code.fromAsset(path.join(lambdaPath, 'api/books')),
      layers: [commonLayer, dependenciesLayer],
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      environment: {
        STAGE: this.config.stage,
        BOOKS_TABLE: cdk.Fn.importValue(this.naming.resourceName('export', 'books-table-name')),
      },
      description: 'Delete book Lambda',
    });

    this.uploadUrlBookFunction = new lambda.Function(this, 'UploadUrlBookFunction', {
      functionName: this.naming.lambdaName('books-upload-url'),
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'upload-url.index',
      code: lambda.Code.fromAsset(path.join(lambdaPath, 'api/books')),
      layers: [commonLayer, dependenciesLayer],
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      environment: {
        STAGE: this.config.stage,
        BOOKS_TABLE: cdk.Fn.importValue(this.naming.resourceName('export', 'books-table-name')),
        PDF_BUCKET: cdk.Fn.importValue(this.naming.resourceName('export', 'pdf-bucket-name')),
      },
      description: 'Generate book upload URL Lambda',
    });

    // Chapter management functions
    this.createChapterFunction = new lambda.Function(this, 'CreateChapterFunction', {
      functionName: this.naming.lambdaName('chapters-create'),
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'create.index',
      code: lambda.Code.fromAsset(path.join(lambdaPath, 'api/chapters')),
      layers: [commonLayer, dependenciesLayer],
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      environment: {
        STAGE: this.config.stage,
        CHAPTERS_TABLE: cdk.Fn.importValue(this.naming.resourceName('export', 'chapters-table-name')),
        BOOKS_TABLE: cdk.Fn.importValue(this.naming.resourceName('export', 'books-table-name')),
      },
      description: 'Create chapter Lambda',
    });

    this.listChaptersFunction = new lambda.Function(this, 'ListChaptersFunction', {
      functionName: this.naming.lambdaName('chapters-list'),
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'list.index',
      code: lambda.Code.fromAsset(path.join(lambdaPath, 'api/chapters')),
      layers: [commonLayer, dependenciesLayer],
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      environment: {
        STAGE: this.config.stage,
        CHAPTERS_TABLE: cdk.Fn.importValue(this.naming.resourceName('export', 'chapters-table-name')),
        BOOKS_TABLE: cdk.Fn.importValue(this.naming.resourceName('export', 'books-table-name')),
      },
      description: 'List chapters Lambda',
    });

    this.getChapterFunction = new lambda.Function(this, 'GetChapterFunction', {
      functionName: this.naming.lambdaName('chapters-get'),
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'get.index',
      code: lambda.Code.fromAsset(path.join(lambdaPath, 'api/chapters')),
      layers: [commonLayer, dependenciesLayer],
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      environment: {
        STAGE: this.config.stage,
        CHAPTERS_TABLE: cdk.Fn.importValue(this.naming.resourceName('export', 'chapters-table-name')),
        BOOKS_TABLE: cdk.Fn.importValue(this.naming.resourceName('export', 'books-table-name')),
      },
      description: 'Get chapter Lambda',
    });

    this.updateChapterFunction = new lambda.Function(this, 'UpdateChapterFunction', {
      functionName: this.naming.lambdaName('chapters-update'),
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'update.index',
      code: lambda.Code.fromAsset(path.join(lambdaPath, 'api/chapters')),
      layers: [commonLayer, dependenciesLayer],
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      environment: {
        STAGE: this.config.stage,
        CHAPTERS_TABLE: cdk.Fn.importValue(this.naming.resourceName('export', 'chapters-table-name')),
        BOOKS_TABLE: cdk.Fn.importValue(this.naming.resourceName('export', 'books-table-name')),
      },
      description: 'Update chapter Lambda',
    });

    this.deleteChapterFunction = new lambda.Function(this, 'DeleteChapterFunction', {
      functionName: this.naming.lambdaName('chapters-delete'),
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'delete.index',
      code: lambda.Code.fromAsset(path.join(lambdaPath, 'api/chapters')),
      layers: [commonLayer, dependenciesLayer],
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      environment: {
        STAGE: this.config.stage,
        CHAPTERS_TABLE: cdk.Fn.importValue(this.naming.resourceName('export', 'chapters-table-name')),
        BOOKS_TABLE: cdk.Fn.importValue(this.naming.resourceName('export', 'books-table-name')),
      },
      description: 'Delete chapter Lambda',
    });

    // Book function outputs
    new cdk.CfnOutput(this, 'CreateBookFunctionArn', {
      value: this.createBookFunction.functionArn,
      exportName: this.naming.resourceName('export', 'create-book-function-arn'),
    });

    new cdk.CfnOutput(this, 'ListBooksFunctionArn', {
      value: this.listBooksFunction.functionArn,
      exportName: this.naming.resourceName('export', 'list-books-function-arn'),
    });

    new cdk.CfnOutput(this, 'GetBookFunctionArn', {
      value: this.getBookFunction.functionArn,
      exportName: this.naming.resourceName('export', 'get-book-function-arn'),
    });

    new cdk.CfnOutput(this, 'UpdateBookFunctionArn', {
      value: this.updateBookFunction.functionArn,
      exportName: this.naming.resourceName('export', 'update-book-function-arn'),
    });

    new cdk.CfnOutput(this, 'DeleteBookFunctionArn', {
      value: this.deleteBookFunction.functionArn,
      exportName: this.naming.resourceName('export', 'delete-book-function-arn'),
    });

    new cdk.CfnOutput(this, 'UploadUrlBookFunctionArn', {
      value: this.uploadUrlBookFunction.functionArn,
      exportName: this.naming.resourceName('export', 'upload-url-book-function-arn'),
    });

    // Chapter function outputs
    new cdk.CfnOutput(this, 'CreateChapterFunctionArn', {
      value: this.createChapterFunction.functionArn,
      exportName: this.naming.resourceName('export', 'create-chapter-function-arn'),
    });

    new cdk.CfnOutput(this, 'ListChaptersFunctionArn', {
      value: this.listChaptersFunction.functionArn,
      exportName: this.naming.resourceName('export', 'list-chapters-function-arn'),
    });

    new cdk.CfnOutput(this, 'GetChapterFunctionArn', {
      value: this.getChapterFunction.functionArn,
      exportName: this.naming.resourceName('export', 'get-chapter-function-arn'),
    });

    new cdk.CfnOutput(this, 'UpdateChapterFunctionArn', {
      value: this.updateChapterFunction.functionArn,
      exportName: this.naming.resourceName('export', 'update-chapter-function-arn'),
    });

    new cdk.CfnOutput(this, 'DeleteChapterFunctionArn', {
      value: this.deleteChapterFunction.functionArn,
      exportName: this.naming.resourceName('export', 'delete-chapter-function-arn'),
    });

    // Topic management functions
    this.createTopicFunction = new lambda.Function(this, 'CreateTopicFunction', {
      functionName: this.naming.lambdaName('topics-create'),
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'create.index',
      code: lambda.Code.fromAsset(path.join(lambdaPath, 'api/topics')),
      layers: [commonLayer, dependenciesLayer],
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      environment: {
        STAGE: this.config.stage,
        TOPICS_TABLE: cdk.Fn.importValue(this.naming.resourceName('export', 'topics-table-name')),
        CHAPTERS_TABLE: cdk.Fn.importValue(this.naming.resourceName('export', 'chapters-table-name')),
      },
      description: 'Create topic Lambda',
    });

    this.listTopicsFunction = new lambda.Function(this, 'ListTopicsFunction', {
      functionName: this.naming.lambdaName('topics-list'),
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'list.index',
      code: lambda.Code.fromAsset(path.join(lambdaPath, 'api/topics')),
      layers: [commonLayer, dependenciesLayer],
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      environment: {
        STAGE: this.config.stage,
        TOPICS_TABLE: cdk.Fn.importValue(this.naming.resourceName('export', 'topics-table-name')),
        CHAPTERS_TABLE: cdk.Fn.importValue(this.naming.resourceName('export', 'chapters-table-name')),
      },
      description: 'List topics Lambda',
    });

    this.getTopicFunction = new lambda.Function(this, 'GetTopicFunction', {
      functionName: this.naming.lambdaName('topics-get'),
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'get.index',
      code: lambda.Code.fromAsset(path.join(lambdaPath, 'api/topics')),
      layers: [commonLayer, dependenciesLayer],
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      environment: {
        STAGE: this.config.stage,
        TOPICS_TABLE: cdk.Fn.importValue(this.naming.resourceName('export', 'topics-table-name')),
      },
      description: 'Get topic Lambda',
    });

    this.updateTopicFunction = new lambda.Function(this, 'UpdateTopicFunction', {
      functionName: this.naming.lambdaName('topics-update'),
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'update.index',
      code: lambda.Code.fromAsset(path.join(lambdaPath, 'api/topics')),
      layers: [commonLayer, dependenciesLayer],
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      environment: {
        STAGE: this.config.stage,
        TOPICS_TABLE: cdk.Fn.importValue(this.naming.resourceName('export', 'topics-table-name')),
      },
      description: 'Update topic Lambda',
    });

    this.deleteTopicFunction = new lambda.Function(this, 'DeleteTopicFunction', {
      functionName: this.naming.lambdaName('topics-delete'),
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'delete.index',
      code: lambda.Code.fromAsset(path.join(lambdaPath, 'api/topics')),
      layers: [commonLayer, dependenciesLayer],
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      environment: {
        STAGE: this.config.stage,
        TOPICS_TABLE: cdk.Fn.importValue(this.naming.resourceName('export', 'topics-table-name')),
        SUBTOPICS_TABLE: cdk.Fn.importValue(this.naming.resourceName('export', 'subtopics-table-name')),
      },
      description: 'Delete topic Lambda',
    });

    // Topic function outputs
    new cdk.CfnOutput(this, 'CreateTopicFunctionArn', {
      value: this.createTopicFunction.functionArn,
      exportName: this.naming.resourceName('export', 'create-topic-function-arn'),
    });

    new cdk.CfnOutput(this, 'ListTopicsFunctionArn', {
      value: this.listTopicsFunction.functionArn,
      exportName: this.naming.resourceName('export', 'list-topics-function-arn'),
    });

    new cdk.CfnOutput(this, 'GetTopicFunctionArn', {
      value: this.getTopicFunction.functionArn,
      exportName: this.naming.resourceName('export', 'get-topic-function-arn'),
    });

    new cdk.CfnOutput(this, 'UpdateTopicFunctionArn', {
      value: this.updateTopicFunction.functionArn,
      exportName: this.naming.resourceName('export', 'update-topic-function-arn'),
    });

    new cdk.CfnOutput(this, 'DeleteTopicFunctionArn', {
      value: this.deleteTopicFunction.functionArn,
      exportName: this.naming.resourceName('export', 'delete-topic-function-arn'),
    });

    // Subtopic management functions
    this.createSubtopicFunction = new lambda.Function(this, 'CreateSubtopicFunction', {
      functionName: this.naming.lambdaName('subtopics-create'),
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'create.index',
      code: lambda.Code.fromAsset(path.join(lambdaPath, 'api/subtopics')),
      layers: [commonLayer, dependenciesLayer],
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      environment: {
        STAGE: this.config.stage,
        SUBTOPICS_TABLE: cdk.Fn.importValue(this.naming.resourceName('export', 'subtopics-table-name')),
        TOPICS_TABLE: cdk.Fn.importValue(this.naming.resourceName('export', 'topics-table-name')),
      },
      description: 'Create subtopic Lambda',
    });

    this.listSubtopicsFunction = new lambda.Function(this, 'ListSubtopicsFunction', {
      functionName: this.naming.lambdaName('subtopics-list'),
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'list.index',
      code: lambda.Code.fromAsset(path.join(lambdaPath, 'api/subtopics')),
      layers: [commonLayer, dependenciesLayer],
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      environment: {
        STAGE: this.config.stage,
        SUBTOPICS_TABLE: cdk.Fn.importValue(this.naming.resourceName('export', 'subtopics-table-name')),
        TOPICS_TABLE: cdk.Fn.importValue(this.naming.resourceName('export', 'topics-table-name')),
      },
      description: 'List subtopics Lambda',
    });

    this.getSubtopicFunction = new lambda.Function(this, 'GetSubtopicFunction', {
      functionName: this.naming.lambdaName('subtopics-get'),
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'get.index',
      code: lambda.Code.fromAsset(path.join(lambdaPath, 'api/subtopics')),
      layers: [commonLayer, dependenciesLayer],
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      environment: {
        STAGE: this.config.stage,
        SUBTOPICS_TABLE: cdk.Fn.importValue(this.naming.resourceName('export', 'subtopics-table-name')),
      },
      description: 'Get subtopic Lambda',
    });

    this.updateSubtopicFunction = new lambda.Function(this, 'UpdateSubtopicFunction', {
      functionName: this.naming.lambdaName('subtopics-update'),
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'update.index',
      code: lambda.Code.fromAsset(path.join(lambdaPath, 'api/subtopics')),
      layers: [commonLayer, dependenciesLayer],
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      environment: {
        STAGE: this.config.stage,
        SUBTOPICS_TABLE: cdk.Fn.importValue(this.naming.resourceName('export', 'subtopics-table-name')),
      },
      description: 'Update subtopic Lambda',
    });

    this.deleteSubtopicFunction = new lambda.Function(this, 'DeleteSubtopicFunction', {
      functionName: this.naming.lambdaName('subtopics-delete'),
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'delete.index',
      code: lambda.Code.fromAsset(path.join(lambdaPath, 'api/subtopics')),
      layers: [commonLayer, dependenciesLayer],
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      environment: {
        STAGE: this.config.stage,
        SUBTOPICS_TABLE: cdk.Fn.importValue(this.naming.resourceName('export', 'subtopics-table-name')),
        CHUNKS_TABLE: cdk.Fn.importValue(this.naming.resourceName('export', 'chunks-table-name')),
      },
      description: 'Delete subtopic Lambda',
    });

    // Subtopic function outputs
    new cdk.CfnOutput(this, 'CreateSubtopicFunctionArn', {
      value: this.createSubtopicFunction.functionArn,
      exportName: this.naming.resourceName('export', 'create-subtopic-function-arn'),
    });

    new cdk.CfnOutput(this, 'ListSubtopicsFunctionArn', {
      value: this.listSubtopicsFunction.functionArn,
      exportName: this.naming.resourceName('export', 'list-subtopics-function-arn'),
    });

    new cdk.CfnOutput(this, 'GetSubtopicFunctionArn', {
      value: this.getSubtopicFunction.functionArn,
      exportName: this.naming.resourceName('export', 'get-subtopic-function-arn'),
    });

    new cdk.CfnOutput(this, 'UpdateSubtopicFunctionArn', {
      value: this.updateSubtopicFunction.functionArn,
      exportName: this.naming.resourceName('export', 'update-subtopic-function-arn'),
    });

    new cdk.CfnOutput(this, 'DeleteSubtopicFunctionArn', {
      value: this.deleteSubtopicFunction.functionArn,
      exportName: this.naming.resourceName('export', 'delete-subtopic-function-arn'),
    });

    // PDF upload handler Lambda function
    this.pdfUploadHandlerFunction = new lambda.Function(this, 'PdfUploadHandlerFunction', {
      functionName: this.naming.lambdaName('async-pdf-upload-handler'),
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(lambdaPath, 'async/pdf-upload-handler')),
      layers: [commonLayer, dependenciesLayer],
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      environment: {
        STAGE: this.config.stage,
        BOOKS_TABLE: cdk.Fn.importValue(this.naming.resourceName('export', 'books-table-name')),
        PDF_BUCKET: cdk.Fn.importValue(this.naming.resourceName('export', 'pdf-bucket-name')),
      },
      description: 'PDF upload handler Lambda',
    });

    new cdk.CfnOutput(this, 'PdfUploadHandlerFunctionArn', {
      value: this.pdfUploadHandlerFunction.functionArn,
      exportName: this.naming.resourceName('export', 'pdf-upload-handler-function-arn'),
    });

    // PDF processor Lambda function
    this.pdfProcessorFunction = new lambda.Function(this, 'PdfProcessorFunction', {
      functionName: this.naming.lambdaName('async-pdf-processor'),
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(lambdaPath, 'async/pdf-processor')),
      layers: [commonLayer, dependenciesLayer],
      memorySize: 3008,
      timeout: cdk.Duration.seconds(300),
      environment: {
        STAGE: this.config.stage,
        BOOKS_TABLE: cdk.Fn.importValue(this.naming.resourceName('export', 'books-table-name')),
        PDF_BUCKET: cdk.Fn.importValue(this.naming.resourceName('export', 'pdf-bucket-name')),
        CHAPTERS_TABLE: cdk.Fn.importValue(this.naming.resourceName('export', 'chapters-table-name')),
        TOPICS_TABLE: cdk.Fn.importValue(this.naming.resourceName('export', 'topics-table-name')),
        SUBTOPICS_TABLE: cdk.Fn.importValue(this.naming.resourceName('export', 'subtopics-table-name')),
        CHUNKS_TABLE: cdk.Fn.importValue(this.naming.resourceName('export', 'chunks-table-name')),
        PDF_PROCESSING_QUEUE: cdk.Fn.importValue(this.naming.resourceName('export', 'pdf-processing-queue-url')),
        MCQ_GENERATION_QUEUE: cdk.Fn.importValue(this.naming.resourceName('export', 'mcq-generation-queue-url')),
      },
      description: 'PDF processing orchestrator Lambda',
    });

    new cdk.CfnOutput(this, 'PdfProcessorFunctionArn', {
      value: this.pdfProcessorFunction.functionArn,
      exportName: this.naming.resourceName('export', 'pdf-processor-function-arn'),
    });
  }
}