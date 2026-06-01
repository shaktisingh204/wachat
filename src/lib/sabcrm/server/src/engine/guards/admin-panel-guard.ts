// PORT-NOTE: NestJS CanActivate / GqlExecutionContext has no direct Next.js
// equivalent. This guard is ported as a plain predicate function and a
// Next.js middleware helper. Apply it as a check inside route handlers or
// use withAdminPanelGuard() as a higher-order wrapper.

export type AdminPanelRequestContext = {
  user?: {
    canAccessFullAdminPanel?: boolean;
  };
};

/**
 * Returns true if the request context user has full admin panel access.
 * Equivalent of the NestJS AdminPanelGuard.canActivate().
 */
export function canActivateAdminPanel(
  ctx: AdminPanelRequestContext,
): boolean {
  return ctx.user?.canAccessFullAdminPanel === true;
}

/**
 * Throws if the request context does not satisfy admin panel access.
 * Use at the top of server actions / route handlers that require admin access.
 */
export function assertAdminPanelAccess(
  ctx: AdminPanelRequestContext,
): void {
  if (!canActivateAdminPanel(ctx)) {
    throw new Error("Forbidden: admin panel access required.");
  }
}
