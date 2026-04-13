'use server';

import { getEffectivePermissionsForProject } from '@/lib/rbac-server';
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
