// PORT-NOTE: Ported from twenty-server ServerLevelImpersonateGuard.
// NestJS removed. Guard becomes a plain predicate function that inspects
// the user object attached to the request-like context.

export type ServerLevelImpersonateContext = {
  user: { canImpersonate?: boolean };
};

/**
 * Returns true only when the authenticated user carries `canImpersonate === true`
 * at the server level (i.e. the JWT itself grants the capability).
 */
export function serverLevelImpersonateGuard(
  ctx: ServerLevelImpersonateContext,
): boolean {
  return ctx.user.canImpersonate === true;
}
