// PORT-NOTE: Ported from twenty-server UserAuthGuard.
// NestJS removed. Guard becomes a plain predicate/assertion that checks
// whether a user object is present in the request-like context.

export type UserAuthContext = {
  user?: unknown;
};

/**
 * Returns true when the context carries an authenticated user object.
 */
export function userAuthGuard(ctx: UserAuthContext): boolean {
  return ctx.user !== undefined;
}
