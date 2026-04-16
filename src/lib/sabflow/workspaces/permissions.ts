/**
 * Permission helpers for SabFlow workspace roles.
 *
 * All helpers accept the caller's role (or null when not a member) and
 * return a boolean. Keeping these pure makes it safe to call from server
 * routes and client components alike.
 */

import type { WorkspaceRole } from './types';

/** Numeric precedence: higher number = more privilege. */
const ROLE_WEIGHT: Record<WorkspaceRole, number> = {
  owner: 4,
  admin: 3,
  editor: 2,
  viewer: 1,
};

function weight(role: WorkspaceRole | null | undefined): number {
  if (!role) return 0;
  return ROLE_WEIGHT[role] ?? 0;
}

/** True when `role` is at least as privileged as `min`. */
export function hasAtLeast(
  role: WorkspaceRole | null | undefined,
  min: WorkspaceRole,
): boolean {
  return weight(role) >= weight(min);
}

/** Any member (viewer or above) may view flows. */
export function canViewFlow(role: WorkspaceRole | null | undefined): boolean {
  return hasAtLeast(role, 'viewer');
}

/** Editors and above may edit a flow's content. */
export function canEditFlow(role: WorkspaceRole | null | undefined): boolean {
  return hasAtLeast(role, 'editor');
}

/** Admins and owners may delete flows. */
export function canDeleteFlow(role: WorkspaceRole | null | undefined): boolean {
  return hasAtLeast(role, 'admin');
}

/** Admins and owners may invite / remove members and change roles. */
export function canManageMembers(
  role: WorkspaceRole | null | undefined,
): boolean {
  return hasAtLeast(role, 'admin');
}

/** Only the owner may rename, change the slug, or delete the workspace. */
export function canManageWorkspace(
  role: WorkspaceRole | null | undefined,
): boolean {
  return hasAtLeast(role, 'owner');
}
