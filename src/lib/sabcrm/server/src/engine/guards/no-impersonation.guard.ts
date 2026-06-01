// PORT-NOTE: Ported from twenty-server NoImpersonationGuard.
// NestJS removed; guard becomes a plain function that inspects an
// impersonation context object and throws a standard Error when active.

export type ImpersonationContext = {
  impersonatorUserWorkspaceId?: string;
  impersonatedUserWorkspaceId?: string;
};

export class NoImpersonationError extends Error {
  constructor() {
    super("Can't access this resource while impersonating");
    this.name = "NoImpersonationError";
  }
}

/**
 * Throws NoImpersonationError if the request carries an active impersonation
 * context (both impersonator and impersonated workspace IDs are present).
 */
export function assertNoImpersonation(
  impersonationContext: ImpersonationContext | undefined,
): void {
  const isCurrentlyImpersonating = Boolean(
    impersonationContext?.impersonatorUserWorkspaceId &&
      impersonationContext?.impersonatedUserWorkspaceId,
  );

  if (isCurrentlyImpersonating) {
    throw new NoImpersonationError();
  }
}
