/**
 * Entity interfaces for the Stealth AaaS platform
 */

// Base entity with common fields
export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

// Institute entity
export interface Institute extends BaseEntity {
  name: string;
  domain: string;
  status: 'ACTIVE' | 'INACTIVE';
}

// User entity
export interface User extends BaseEntity {
  email: string;
  name: string;
  role: 'Admin' | 'Professor' | 'Student';
  instituteId: string;
  cognitoSub: string;
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING';
}

// Subject entity
export interface Subject extends BaseEntity {
  name: string;
  description?: string;
  code: string;
  instituteId: string;
}

// Book entity
export interface Book extends BaseEntity {
  title: string;
  subjectId: string;
  instituteId: string;
  s3Key: string;
  status: 'UPLOADED' | 'PROCESSING' | 'PROCESSED' | 'FAILED';
  uploadedAt: string;
  processedAt?: string;
  metadata?: BookMetadata;
}

export interface BookMetadata {
  author?: string;
  publisher?: string;
  publishedDate?: string;
  pageCount?: number;
  isbn?: string;
}

// Chapter entity
export interface Chapter extends BaseEntity {
  title: string;
  bookId: string;
  order: number;
  pageStart: number;
  pageEnd: number;
}

// Topic entity
export interface Topic extends BaseEntity {
  title: string;
  chapterId: string;
  order: number;
  pageStart: number;
  pageEnd: number;
}

// Subtopic entity
export interface Subtopic extends BaseEntity {
  title: string;
  topicId: string;
  order: number;
  pageStart: number;
  pageEnd: number;
}

// Chunk entity (for RAG)
export interface Chunk extends BaseEntity {
  content: string;
  subtopicId: string;
  bookId: string;
  pageNumbers: number[];
  tokenCount: number;
  embeddingId?: string;
}

// MCQ entity
export interface MCQ extends BaseEntity {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
  chunkId: string;
  subtopicId: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  bloomsLevel: 'Remember' | 'Understand' | 'Apply' | 'Analyze' | 'Evaluate' | 'Create';
  createdBy: string;
}

// Assessment entity
export interface Assessment extends BaseEntity {
  title: string;
  description?: string;
  instituteId: string;
  mcqIds: string[];
  config: AssessmentConfig;
  createdBy: string;
}

export interface AssessmentConfig {
  timeLimit: number; // in minutes
  passingScore: number; // percentage
  randomization: boolean;
  showCorrectAnswers: boolean;
}

// Batch entity
export interface Batch extends BaseEntity {
  name: string;
  description?: string;
  instituteId: string;
  studentIds: string[];
  academicYear: string;
  semester: string;
}

// Assignment entity
export interface Assignment extends BaseEntity {
  assessmentId: string;
  batchId: string;
  instituteId: string;
  startDate: string;
  endDate: string;
  createdBy: string;
}

// Submission entity
export interface Submission extends BaseEntity {
  assessmentId: string;
  studentId: string;
  answers: SubmissionAnswer[];
  score: number;
  passFail: 'PASS' | 'FAIL';
  startTime: string;
  endTime: string;
}

export interface SubmissionAnswer {
  mcqId: string;
  selectedAnswer: string;
  isCorrect: boolean;
}

// Request/Response types
export interface PaginatedResponse<T> {
  items: T[];
  nextToken?: string;
  totalCount?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// Auth types
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  expiresIn: number;
}

export interface UserProfile {
  userId: string;
  email: string;
  name: string;
  role: User['role'];
  instituteId: string;
}

// Event types
export interface S3EventRecord {
  s3: {
    bucket: {
      name: string;
    };
    object: {
      key: string;
      size: number;
    };
  };
}

export interface SQSMessage {
  MessageId: string;
  Body: string;
  Attributes?: Record<string, string>;
}

// Environment types
export interface EnvironmentConfig {
  STAGE: string;
  AWS_REGION: string;
  COGNITO_USER_POOL_ID: string;
  COGNITO_CLIENT_ID: string;
  DYNAMODB_TABLE_PREFIX: string;
  S3_BUCKET_PREFIX: string;
  SQS_QUEUE_PREFIX: string;
}

// Re-export all types for convenience
export type {
  BaseEntity,
  Institute,
  User,
  Subject,
  Book,
  Chapter,
  Topic,
  Subtopic,
  Chunk,
  MCQ,
  Assessment,
  Batch,
  Assignment,
  Submission,
  PaginatedResponse,
  ApiResponse,
  AuthTokens,
  UserProfile,
  S3EventRecord,
  SQSMessage,
  EnvironmentConfig,
};
