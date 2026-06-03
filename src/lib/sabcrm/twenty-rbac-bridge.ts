/**
 * C7 — SabNode RBAC → Twenty role bridge (Phase 0 contract).
 *
 * Maps SabNode's resolved {@link EffectivePermissions} for the `sabcrm` module
 * onto a Twenty workspace role. Twenty ships three coarse roles by default;
 * SabNode's finer per-action grants collapse onto them. The gate in
 * `sabcrm-twenty.actions.ts` stays the real authority on the SabNode side — this
 * only decides what the *bridged* Twenty session is allowed to do.
 *
 * Pure + dependency-light so it can run on either side of the bridge.
 */

import { can, type EffectivePermissions } from '@/lib/rbac';

/** Twenty's default workspace roles. */
export type TwentyRole = 'admin' | 'member' | 'guest';

const MODULE_KEY = 'sabcrm';

/**
 * Collapse SabNode permissions onto a Twenty role:
 *  - owner / admin / delete rights        → `admin`
 *  - create or edit rights                → `member`
 *  - view-only                            → `guest`
 *  - nothing (or null)                    → `guest`
 */
export function permissionsToTwentyRole(
  perms: EffectivePermissions | null | undefined,
): TwentyRole {
  if (!perms) return 'guest';
  if (perms.isOwner || perms.role === 'admin' || can(perms, MODULE_KEY, 'delete')) {
    return 'admin';
  }
  if (can(perms, MODULE_KEY, 'create') || can(perms, MODULE_KEY, 'edit')) {
    return 'member';
  }
  return 'guest';
}
