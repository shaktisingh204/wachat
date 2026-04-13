/**
 * Pure RBAC helpers — shared between client & server.
 * No Mongo, no cookies, no Node-only APIs.
 *
 * The resolved permission matrix has the shape:
 *   { [moduleKey]: { view, create, edit, delete } }
 * and is produced by `getEffectivePermissionsForProject` on the server
 * (see `rbac-server.ts`). Clients receive it through ProjectContext.
 */

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete';

export type ModulePermission = Partial<Record<PermissionAction, boolean>>;

export type EffectivePermissionMap = Record<string, ModulePermission>;

export type EffectivePermissions = {
    /** Role identifier the user is acting under. `owner` when `isOwner`. */
    role: string;
    /** True when the user is the owner of the project (or no project is scoped). */
    isOwner: boolean;
    /** Resolved {moduleKey -> action -> boolean} grants for the current project. */
    permissions: EffectivePermissionMap;
    /** Upper bound from the current plan — owners are still clamped by this. */
    planCeiling?: EffectivePermissionMap;
};

/**
 * Pure check against a prepared EffectivePermissions object. Used by both
 * the server `requirePermission` helper and the client `useCan` hook.
 */
export function can(
    effective: EffectivePermissions | null | undefined,
    moduleKey: string,
    action: PermissionAction = 'view',
): boolean {
    if (!effective) return false;

    // Owners are allowed unless the plan explicitly denies the module/action.
    if (effective.isOwner) {
        const ceiling = effective.planCeiling?.[moduleKey];
        if (ceiling && action in ceiling) return Boolean(ceiling[action]);
        return true;
    }

    const grant = effective.permissions?.[moduleKey];
    if (!grant) return false;
    return Boolean(grant[action]);
}

/**
 * Fast single-module lookup for places that only need view access
 * (the common case for nav filtering).
 */
export function canView(effective: EffectivePermissions | null | undefined, moduleKey: string): boolean {
    return can(effective, moduleKey, 'view');
}

/**
 * Intersect a role permission map with the plan ceiling so that no one
 * exceeds the plan, regardless of what a role grants.
 */
export function intersectWithCeiling(
    rolePerms: EffectivePermissionMap | undefined,
    ceiling: EffectivePermissionMap | undefined,
): EffectivePermissionMap {
    if (!rolePerms) return {};
    if (!ceiling) return rolePerms;

    const out: EffectivePermissionMap = {};
    for (const [moduleKey, actions] of Object.entries(rolePerms)) {
        const cap = ceiling[moduleKey];
        if (!actions) continue;
        const clamped: ModulePermission = {};
        (['view', 'create', 'edit', 'delete'] as PermissionAction[]).forEach((a) => {
            const allowed = Boolean(actions[a]);
            // If plan doesn't mention this module at all, treat as "plan allows".
            const ceilingAllowed = cap && a in cap ? Boolean(cap[a]) : true;
            clamped[a] = allowed && ceilingAllowed;
        });
        out[moduleKey] = clamped;
    }
    return out;
}

/**
 * The role the system treats as "first-class admin".
 * Members with this role bypass the per-module role map and inherit the
 * plan ceiling (identical to the owner — except they can't transfer ownership).
 */
export const ADMIN_ROLE_ID = 'admin';

export function isElevatedRole(roleId: string | undefined | null): boolean {
    if (!roleId) return false;
    return roleId === ADMIN_ROLE_ID || roleId === 'owner';
}
