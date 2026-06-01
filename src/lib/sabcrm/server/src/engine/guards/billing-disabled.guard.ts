// PORT-NOTE: NestJS @Injectable() CanActivate is ported as a plain function.
// In Next.js, call isBillingDisabled() or assertBillingDisabled() at the
// top of route handlers / server actions that should only run when billing
// is disabled. Inject the config by passing it explicitly.

/**
 * Interface representing the config surface needed by this guard.
 */
export interface BillingDisabledGuardConfig {
  isBillingEnabled: () => boolean;
}

/**
 * Returns true (allow) when billing is NOT enabled — mirrors the original guard.
 * Equivalent of BillingDisabledGuard.canActivate().
 */
export function isBillingDisabled(config: BillingDisabledGuardConfig): boolean {
  return !config.isBillingEnabled();
}

/**
 * Throws if billing is currently enabled (i.e., route should be disabled).
 * Use at the top of server actions / route handlers gated by this guard.
 */
export function assertBillingDisabled(
  config: BillingDisabledGuardConfig,
): void {
  if (!isBillingDisabled(config)) {
    throw new Error("Forbidden: this endpoint is only available when billing is disabled.");
  }
}
