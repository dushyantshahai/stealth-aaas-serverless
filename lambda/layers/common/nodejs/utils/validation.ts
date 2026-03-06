import { z, ZodError } from 'zod';
import { ValidationError } from './errors';

/**
 * Common validation schemas
 */
export const schemas = {
  // Email validation
  email: z.string().email('Invalid email address'),

  // Password validation
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),

  // UUID validation
  uuid: z.string().uuid('Invalid UUID format'),

  // ISO date validation
  isoDate: z.string().datetime('Invalid date format'),

  // Pagination parameters
  pagination: z.object({
    limit: z
      .number()
      .int()
      .positive()
      .max(100, 'Limit cannot exceed 100')
      .optional()
      .default(20),
    lastEvaluatedKey: z.string().optional(),
  }),

  // Institute ID
  instituteId: z.string().min(1, 'Institute ID is required'),

  // User role
  userRole: z.enum(['Admin', 'Professor', 'Student'] as const, {
    errorMap: () => ({ message: 'Invalid user role' }),
  }),

  // Book status
  bookStatus: z.enum(
    ['UPLOADED', 'PROCESSING', 'PROCESSED', 'FAILED'] as const,
    {
      errorMap: () => ({ message: 'Invalid book status' }),
    }
  ),

  // MCQ difficulty
  mcqDifficulty: z
    .enum(['Easy', 'Medium', 'Hard'] as const, {
      errorMap: () => ({ message: 'Invalid difficulty level' }),
    })
    .optional(),

  // Bloom's taxonomy level
  bloomsLevel: z
    .enum([
      'Remember',
      'Understand',
      'Apply',
      'Analyze',
      'Evaluate',
      'Create',
    ])
    .optional(),
};

/**
 * Validate input against a schema
 */
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) {
      const details = error.issues.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      }));
      throw new ValidationError('Validation failed', details);
    }
    throw error;
  }
}

/**
 * Validate request body
 */
export function validateBody<T>(
  schema: z.ZodSchema<T>,
  event: { body: string | null }
): T {
  if (!event.body) {
    throw new ValidationError('Request body is required');
  }
  try {
    const parsed = JSON.parse(event.body);
    return validateInput(schema, parsed);
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError('Invalid JSON in request body');
  }
}

/**
 * Validate path parameters
 */
export function validatePath<T extends Record<string, string>>(
  schema: z.ZodSchema<T>,
  params: T
): T {
  return validateInput(schema, params);
}

/**
 * Validate query parameters
 */
export function validateQuery<T extends Record<string, string | undefined>>(
  schema: z.ZodSchema<T>,
  query: T
): T {
  return validateInput(schema, query);
}

/**
 * Create a validation schema for CRUD operations
 */
export function createCrudSchema<T extends z.ZodType>(
  baseSchema: T
): z.ZodObject<{
  id: z.ZodString;
  data: T;
}> {
  return z.object({
    id: schemas.uuid,
    data: baseSchema,
  });
}

export default {
  schemas,
  validateInput,
  validateBody,
  validatePath,
  validateQuery,
  createCrudSchema,
};
