/**
 * Pure (non-server-action) helpers for reasoning about a SabBigin config doc.
 *
 * These live outside `sabbigin.actions.ts` because a `'use server'` module may
 * only export async functions — synchronous helpers must be imported from a
 * plain module like this one.
 */
import type {
  SabbiginConfigDoc,
  SabbiginFeatureFlag,
} from '@/lib/rust-client/sabbigin-config';

/**
 * Effective pipeline cap for a tenant. `pipelineLimit === 0` means "no admin
 * override" → unlimited while the SKU is unpriced. A positive stored value is
 * an explicit admin cap. Returns `Infinity` for unlimited.
 */
export function sabbiginEffectivePipelineLimit(
  config: SabbiginConfigDoc | null,
): number {
  const override = config?.pipelineLimit ?? 0;
  return override > 0 ? override : Infinity;
}

/** Is a SabBigin feature flag enabled for this config? Defaults to on. */
export function sabbiginFeatureEnabled(
  config: SabbiginConfigDoc | null,
  flag: SabbiginFeatureFlag,
): boolean {
  if (!config) return true;
  if (!config.allowedFeatures || config.allowedFeatures.length === 0) return true;
  return config.allowedFeatures.includes(flag);
}

/** INR-default currency formatter shared across SabBigin surfaces. */
export function sabbiginCurrency(config: SabbiginConfigDoc | null): string {
  return config?.defaultCurrency || 'INR';
}
