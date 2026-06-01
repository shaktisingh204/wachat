import "server-only";

// PORT-NOTE: Ported from twenty-server FeatureFlagGuard + RequireFeatureFlag decorator.
// NestJS Reflector/GqlExecutionContext removed. Feature flag check becomes a plain
// async function. TypedReflect metadata key preserved as a constant for completeness.

import { TypedReflect } from "@/lib/sabcrm/server/src/utils/typed-reflect";

export const FEATURE_FLAG_KEY = "feature-flag-metadata-args";

/**
 * Attaches a required feature-flag metadata key to a function/class (for
 * reflect-metadata consumers). In Next.js handlers this is informational;
 * the actual enforcement is done by assertFeatureFlag().
 */
export function RequireFeatureFlag(featureFlag: string) {
  return (
    target: object,
    _propertyKey?: string,
    descriptor?: PropertyDescriptor,
  ) => {
    TypedReflect.defineMetadata(
      FEATURE_FLAG_KEY,
      featureFlag,
      descriptor?.value ?? target,
    );
    return descriptor;
  };
}

export class FeatureFlagGuardError extends Error {
  constructor(featureFlag: string) {
    super(`Feature flag "${featureFlag}" is not enabled for this workspace`);
    this.name = "FeatureFlagGuardError";
  }
}

/**
 * Asserts that `featureFlag` is enabled for the given workspace.
 * Throws FeatureFlagGuardError when not enabled.
 *
 * @param featureFlag  - The feature flag key to check.
 * @param workspaceId  - The workspace to check against.
 * @param isEnabled    - A resolver callback (e.g. calling FeatureFlagService).
 */
export async function assertFeatureFlag(
  featureFlag: string,
  workspaceId: string,
  isEnabled: (flag: string, wsId: string) => Promise<boolean>,
): Promise<void> {
  if (!workspaceId) {
    throw new FeatureFlagGuardError(featureFlag);
  }

  const enabled = await isEnabled(featureFlag, workspaceId);

  if (!enabled) {
    throw new FeatureFlagGuardError(featureFlag);
  }
}
