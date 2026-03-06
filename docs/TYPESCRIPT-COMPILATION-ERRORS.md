# TypeScript Compilation Errors - Phase 13

## Overview
This document tracks TypeScript compilation errors that need to be fixed before the Lambda functions can be deployed. These errors are primarily related to:
- Lambda handler return type mismatches
- AWS Lambda Context property naming
- Error type handling
- AWS SDK v3 API changes
- Type export issues

## Error Categories

### 1. Lambda Handler Return Type Mismatches
**Issue**: Lambda handlers are returning `{ statusCode, body }` but AWS Lambda types expect `void | SQSBatchResponse` for SQS handlers.

**Files Affected**:
- `lambda/async/pdf-processor.ts`
- `lambda/async/pdf-upload-handler/index.ts`
- All `lambda/api/*` handlers

**Fix**: Update handler signatures to return proper AWS Lambda response types:
```typescript
// For SQS handlers
export const handler: SQSHandler = async (event): Promise<SQSBatchResponse | void> => {
  // ... implementation
  return { batchItemFailures: [] };
};

// For API Gateway handlers
export const handler: APIGatewayProxyHandler = async (event, context) => {
  // ... implementation
  return { statusCode: 200, body: JSON.stringify({}) };
};
```

### 2. Context Property Errors
**Issue**: Code uses `context.requestId` but AWS Lambda Context uses `context.awsRequestId`.

**Files Affected**:
- `lambda/api/auth/login.ts`
- `lambda/api/auth/refresh.ts`
- `lambda/api/auth/register.ts`
- `lambda/api/auth/reset-password.ts`
- `lambda/layers/common/nodejs/utils/logger.ts`
- All other API handlers

**Fix**: Replace all instances of `context.requestId` with `context.awsRequestId`:
```typescript
// Before
logger.info('Request', { requestId: context.requestId });

// After
logger.info('Request', { requestId: context.awsRequestId });
```

### 3. Unknown Error Type Handling
**Issue**: Error handling uses `error as Error` but TypeScript can't infer the type properly.

**Files Affected**:
- `lambda/api/auth/login.ts` (lines 111-114)
- `lambda/api/auth/refresh.ts` (lines 70-73)
- `lambda/api/auth/register.ts` (lines 113)
- `lambda/api/auth/reset-password.ts` (lines 52)
- All other API handlers

**Fix**: Properly type error handling:
```typescript
// Before
catch (error) {
  logger.error('Error', error as Error);
}

// After
catch (error) {
  const err = error instanceof Error ? error : new Error(String(error));
  logger.error('Error', err);
}
```

### 4. Missing Module Exports
**Issue**: Some types are declared as types but exported as values.

**Files Affected**:
- `lambda/layers/common/nodejs/types/index.ts` (lines 225-245)
- `lambda/layers/common/nodejs/utils/response.ts` (line 158)

**Fix**: Use `export type` for type-only exports:
```typescript
// Before
export {
  BaseEntity,
  Institute,
  User,
  // ... other types
};

// After
export type {
  BaseEntity,
  Institute,
  User,
  // ... other types
};
```

### 5. AWS SDK v3 API Changes
**Issue**: Some AWS SDK v3 APIs have changed from v2.

**Files Affected**:
- `lambda/layers/common/nodejs/clients/sqs.ts` (line 194)
- `lambda/layers/common/nodejs/clients/s3.ts` (line 128)

**Specific Issues**:
- `GetQueueAttributesCommand` expects `QueueAttributeName[]` not `string[]`
- S3 streaming blob payload needs proper async iteration

**Fix**: Update API calls to match v3 signatures:
```typescript
// Before
AttributeNames: attributeNames, // string[]

// After
AttributeNames: attributeNames as QueueAttributeName[],
```

### 6. Zod Validation API Changes
**Issue**: Zod enum API has changed.

**Files Affected**:
- `lambda/layers/common/nodejs/utils/validation.ts` (lines 42, 47, 56)

**Fix**: Update Zod enum calls:
```typescript
// Before
z.enum(['Admin', 'Professor', 'Student'], { errorMap: ... })

// After
z.enum(['Admin', 'Professor', 'Student'] as const, { errorMap: ... })
```

### 7. Type Annotation Issues
**Issue**: Missing or incorrect type annotations.

**Files Affected**:
- `lambda/async/text-chunker.ts` (line 96) - Missing `BatchWriteCommand` import
- `lambda/async/toc-extractor.ts` (lines 184, 191, 196, 270, 375, 447)
- `lambda/async/utils/pdf-text-extractor.ts` (lines 144, 194, 242)

**Fix**: Add proper type annotations and imports.

## Error Statistics

- **Total Errors**: ~516
- **Lambda Handler Type Mismatches**: ~50
- **Context Property Errors**: ~30
- **Unknown Error Types**: ~100
- **Type Export Issues**: ~20
- **AWS SDK API Changes**: ~15
- **Zod Validation Issues**: ~5
- **Other Type Issues**: ~280

## Implementation Plan

### Phase 1: Critical Fixes (High Impact)
1. Fix all Lambda handler return types
2. Fix all `context.requestId` → `context.awsRequestId` replacements
3. Fix error type handling

### Phase 2: Type System Fixes
1. Fix type-only exports
2. Add missing type annotations
3. Fix AWS SDK v3 API calls

### Phase 3: Validation & Testing
1. Run `npm run build` to verify all errors are fixed
2. Run unit tests to ensure functionality
3. Deploy functions stack

## Build Command
```bash
npm run build
```

## Testing
```bash
npm test
npm test -- --coverage
```

## Notes
- These errors prevent the Lambda functions from being deployed
- The Knowledge Base stack is already deployed and working
- Once these errors are fixed, the functions stack can be deployed
- Consider using a linter (ESLint) to catch these issues earlier
