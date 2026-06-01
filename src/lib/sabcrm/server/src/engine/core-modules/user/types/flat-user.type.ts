import "server-only";

// PORT-NOTE: Original type derived from UserEntity with TypeORM date properties
// cast to string and non-cached properties omitted. We replicate the shape directly.

export type FlatUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isEmailVerified: boolean;
  disabled: boolean;
  canImpersonate: boolean;
  canAccessFullAdminPanel: boolean;
  /** ISO-8601 string (was Date in TypeORM) */
  createdAt: string;
  /** ISO-8601 string (was Date in TypeORM) */
  updatedAt: string;
  /** ISO-8601 string or undefined (was Date | null in TypeORM) */
  deletedAt?: string;
  locale: string;
};
