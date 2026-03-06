import { APIGatewayProxyEvent } from 'aws-lambda';
import { AuthorizationError } from '../utils/errors';

/**
 * User roles hierarchy
 */
export const ROLES = {
  Admin: ['Admin', 'Professor', 'Student'],
  Professor: ['Professor', 'Student'],
  Student: ['Student'],
} as const;

export type UserRole = (typeof ROLES)[keyof typeof ROLES][number];

/**
 * Check if user has required role
 */
export function hasRole(
  userRole: string | undefined,
  requiredRoles: UserRole[]
): boolean {
  if (!userRole) {
    return false;
  }

  // Check if user's role is in the required roles list
  if (requiredRoles.includes(userRole as UserRole)) {
    return true;
  }

  // Check role hierarchy
  for (const requiredRole of requiredRoles) {
    const allowedRoles = ROLES[requiredRole as keyof typeof ROLES];
    if (allowedRoles.includes(userRole as UserRole)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if user has specific role
 */
export function hasExactRole(
  userRole: string | undefined,
  requiredRole: UserRole
): boolean {
  return userRole === requiredRole;
}

/**
 * Require specific role middleware
 */
export function requireRole(requiredRole: UserRole) {
  return (
    event: APIGatewayProxyEvent,
    user: { userRole?: string }
  ): void => {
    if (!hasExactRole(user.userRole, requiredRole)) {
      throw new AuthorizationError(
        `This action requires ${requiredRole} role`
      );
    }
  };
}

/**
 * Require any of the specified roles
 */
export function requireAnyRole(...requiredRoles: UserRole[]) {
  return (
    event: APIGatewayProxyEvent,
    user: { userRole?: string }
  ): void => {
    if (!hasRole(user.userRole, requiredRoles)) {
      throw new AuthorizationError(
        `This action requires one of: ${requiredRoles.join(', ')}`
      );
    }
  };
}

/**
 * Admin only middleware
 */
export function adminOnly(
  event: APIGatewayProxyEvent,
  user: { userRole?: string }
): void {
  if (user.userRole !== 'Admin') {
    throw new AuthorizationError('Admin access required');
  }
}

/**
 * Professor or Admin middleware
 */
export function professorOrAdmin(
  event: APIGatewayProxyEvent,
  user: { userRole?: string }
): void {
  if (user.userRole !== 'Admin' && user.userRole !== 'Professor') {
    throw new AuthorizationError('Professor or Admin access required');
  }
}

/**
 * Resource ownership check
 */
export function isOwner(
  resourceOwnerId: string,
  userId: string
): boolean {
  return resourceOwnerId === userId;
}

/**
 * Institute membership check
 */
export function isSameInstitute(
  resourceInstituteId: string | undefined,
  userInstituteId: string | undefined
): boolean {
  if (!resourceInstituteId || !userInstituteId) {
    return false;
  }
  return resourceInstituteId === userInstituteId;
}

/**
 * Check if user can access resource based on ownership and institute
 */
export function canAccessResource(
  resource: { instituteId?: string; userId?: string },
  user: { userId: string; instituteId?: string; userRole?: string }
): boolean {
  // Admins can access all resources in their institute
  if (user.userRole === 'Admin') {
    return resource.instituteId === user.instituteId;
  }

  // Professors can access resources in their institute
  if (user.userRole === 'Professor') {
    return resource.instituteId === user.instituteId;
  }

  // Students can only access their own resources
  return resource.userId === user.userId;
}

export default {
  ROLES,
  hasRole,
  hasExactRole,
  requireRole,
  requireAnyRole,
  adminOnly,
  professorOrAdmin,
  isOwner,
  isSameInstitute,
  canAccessResource,
};