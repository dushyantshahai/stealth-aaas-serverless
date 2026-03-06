# API Gateway 502 Error - Root Cause and Fix

## Problem
API Gateway was returning 502 Internal Server Error because routes were not being created in the deployed API Gateway.

## Root Cause
The routes were being added AFTER the API Gateway deployment was created:

1. `ApiStack` constructor created the API Gateway with a default deployment
2. `FunctionsStack` was created separately
3. `apiStack.configureRoutes(functionsStack)` was called AFTER both stacks were constructed
4. CDK's RestApi creates its deployment during construction, so routes added later weren't included
5. The deployed API Gateway had no routes, causing 502 errors

## The Fix

### Changes Made

1. **Modified `ApiStack` interface** (`api-stack.ts`):
   - Added `ApiStackProps` interface extending `BaseStackProps`
   - Added `functionsStack: FunctionsStack` to props
   - Changed constructor to accept `ApiStackProps` instead of `BaseStackProps`

2. **Moved route configuration into constructor** (`api-stack.ts`):
   - Called `this.configureRoutes(props.functionsStack)` inside the constructor
   - Changed `configureRoutes` from `public` to `private`
   - Routes are now added BEFORE the API Gateway deployment is finalized

3. **Updated stack creation order** (`cdk.ts`):
   - Created `FunctionsStack` BEFORE `ApiStack`
   - Passed `functionsStack` to `ApiStack` constructor
   - Removed the separate `apiStack.configureRoutes()` call

### Why This Works

CDK's `RestApi` class creates a deployment when the stack is synthesized. By adding routes during construction (before synthesis), CDK includes them in the CloudFormation template and the deployment.

**Before:**
```
ApiStack constructor → API created with deployment
FunctionsStack constructor → Functions created
configureRoutes() called → Routes added (but deployment already created)
```

**After:**
```
FunctionsStack constructor → Functions created
ApiStack constructor → API created → Routes added → Deployment created with routes
```

## Deployment

To deploy the fixed API Gateway:

### Windows (PowerShell)
```powershell
.\deploy-api.ps1 dev
```

### Linux/Mac (Bash)
```bash
./deploy-api.sh dev
```

### Manual Deployment
```bash
cd cdk
npm install
npm run build
npx cdk deploy --all --context stage=dev --require-approval never
```

## Testing

After deployment, test the API:

```bash
node test-content-apis.js
```

The API should now respond with proper status codes instead of 502 errors.

## Key Takeaway

When using AWS CDK with API Gateway:
- Always add routes DURING the API Gateway construction
- Don't add routes in separate methods called after construction
- The deployment is created when the stack is synthesized, not when methods are called later
