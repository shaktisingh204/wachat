'use server';

import { getEffectivePermissionsForProject, getEffectivePlanFeaturesForProject } from '@/lib/rbac-server';
import type { EffectivePermissions } from '@/lib/rbac';

/**
 * Client-callable wrapper around `getEffectivePermissionsForProject`.
 * ProjectContext calls this whenever the active project changes so that
 * the `useCan` hook can evaluate permissions purely on the client.
 */
export async function getMyEffectivePermissions(
    projectId?: string | null,
): Promise<EffectivePermissions | null> {
    return getEffectivePermissionsForProject(projectId || null);
}

/**
 * Client-callable wrapper for effective PLAN FEATURE flags, resolved for the
 * active tenant (a team member inherits the OWNER's plan). Used by premium
 * feature gates (e.g. the CRM Suite lock) so members aren't shown an upsell
 * for the account owner's plan.
 */
export async function getMyEffectivePlanFeatures(
    projectId?: string | null,
): Promise<Record<string, any>> {
    return getEffectivePlanFeaturesForProject(projectId || null);
}
