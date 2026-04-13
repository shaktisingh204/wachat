import {
    wachatMenuItems, crmMenuGroups, teamMenuItems, sabChatMenuItems,
    facebookMenuGroups, instagramMenuGroups, adManagerMenuItems,
    emailMenuItems, smsMenuItems, apiMenuItems, sabflowMenuItems,
    urlShortenerMenuItems, qrCodeMakerMenuItems, portfolioMenuItems, seoMenuItems,
    MenuItem
} from '@/config/dashboard-config';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import {
    can,
    intersectWithCeiling,
    isElevatedRole,
    type EffectivePermissionMap,
    type EffectivePermissions,
    type PermissionAction,
} from '@/lib/rbac';

// Flatten all menu items into a single array for searching
const allMenuItems = [
    ...wachatMenuItems,
    ...crmMenuGroups.flatMap(group => group.items),
    ...teamMenuItems,
    ...sabChatMenuItems,
    ...facebookMenuGroups.flatMap(group => group.items),
    ...instagramMenuGroups.flatMap(group => group.items),
    ...adManagerMenuItems,
    ...emailMenuItems,
    ...smsMenuItems,
    ...apiMenuItems,
    ...sabflowMenuItems,
    ...urlShortenerMenuItems,
    ...qrCodeMakerMenuItems,
    ...portfolioMenuItems,
    ...seoMenuItems,
];

// Cache for quick lookups
const permissionCache = new Map<string, string | undefined>();

export function getRequiredPermissionForPath(pathname: string): string | undefined {
    // Check cache first
    if (permissionCache.has(pathname)) {
        return permissionCache.get(pathname);
    }

    // Try exact match first
    const exactMatch = allMenuItems.find(item => item.href === pathname);
    if (exactMatch && exactMatch.permissionKey) {
        permissionCache.set(pathname, exactMatch.permissionKey);
        return exactMatch.permissionKey;
    }

    // Try finding the longest matching prefix (handles sub-routes like /details/123)
    // Sort items by href length descending to ensure we match the specific route, not just the parent
    const sortedItems = [...allMenuItems].sort((a, b) => b.href.length - a.href.length);

    // Clean trailing slash for matching
    const cleanPath = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

    for (const item of sortedItems) {
        const itemHref = item.href.endsWith('/') ? item.href.slice(0, -1) : item.href;

        // Exact match or prefix match
        if (cleanPath === itemHref || cleanPath.startsWith(`${itemHref}/`)) {
            if (item.permissionKey) {
                permissionCache.set(pathname, item.permissionKey);
                return item.permissionKey;
            }
        }
    }

    permissionCache.set(pathname, undefined);
    return undefined;
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Effective permissions + requirePermission                                */
/* ──────────────────────────────────────────────────────────────────────── */

type SessionUser = NonNullable<Awaited<ReturnType<typeof getSession>>>['user'];

/**
 * Split a mixed permission bag (the one returned on `session.user.plan.permissions`)
 * into a flat plan-ceiling map and a role-keyed role map.
 *
 * Plans store permissions as `{ [moduleKey]: ModulePermission }`.
 * User custom permissions overlay as `{ [role]: { [moduleKey]: ModulePermission } }`.
 * getSession() merges them into the same object — here we pull them back apart.
 */
function splitMixedPermissions(raw: any): {
    ceiling: EffectivePermissionMap;
    roles: Record<string, EffectivePermissionMap>;
} {
    const ceiling: EffectivePermissionMap = {};
    const roles: Record<string, EffectivePermissionMap> = {};
    if (!raw || typeof raw !== 'object') return { ceiling, roles };

    for (const [key, value] of Object.entries(raw)) {
        if (!value || typeof value !== 'object') continue;
        // A role entry: every sub-value is itself a ModulePermission bag (object).
        const entries = Object.values(value);
        const looksLikeRoleBag =
            entries.length > 0 &&
            entries.every(
                (v) => v && typeof v === 'object' && !Array.isArray(v) && (('view' in (v as any)) || ('create' in (v as any)) || ('edit' in (v as any)) || ('delete' in (v as any))),
            );
        if (looksLikeRoleBag) {
            roles[key] = value as EffectivePermissionMap;
        } else if ('view' in (value as any) || 'create' in (value as any) || 'edit' in (value as any) || 'delete' in (value as any)) {
            ceiling[key] = value as any;
        }
    }
    return { ceiling, roles };
}

/**
 * Compute the permission bag the current user should see when acting on a project.
 *
 * - If the user owns the project (or no project is scoped): `isOwner=true`, permissions
 *   default to the plan ceiling.
 * - Otherwise: look up their Agent role on the project and resolve that role against
 *   the **owner's** custom permissions map (the inviter defines role templates).
 */
export async function getEffectivePermissionsForProject(
    projectId?: string | null,
): Promise<EffectivePermissions | null> {
    const session = await getSession();
    if (!session?.user) return null;

    const { db } = await connectToDatabase();
    const sessionUserId = new ObjectId(session.user._id);

    const mixed = (session.user as any)?.plan?.permissions;
    const { ceiling, roles: ownRoles } = splitMixedPermissions(mixed);

    const scopedProjectId = projectId || (session.user as any)?.activeProjectId;

    // No project scope → behave as owner within plan ceiling.
    if (!scopedProjectId || !ObjectId.isValid(String(scopedProjectId))) {
        return { role: 'owner', isOwner: true, permissions: ceiling, planCeiling: ceiling };
    }

    const project = await db
        .collection('projects')
        .findOne(
            { _id: new ObjectId(String(scopedProjectId)) },
            { projection: { userId: 1, agents: 1 } },
        );
    if (!project) {
        // Unknown project — fall back to owner-of-nothing (plan ceiling only).
        return { role: 'owner', isOwner: true, permissions: ceiling, planCeiling: ceiling };
    }

    if (project.userId.equals(sessionUserId)) {
        return { role: 'owner', isOwner: true, permissions: ceiling, planCeiling: ceiling };
    }

    const agent = (project.agents || []).find((a: any) => a.userId?.equals?.(sessionUserId));
    const roleId: string = agent?.role || 'agent';

    // Elevated roles (admin) inherit the plan ceiling — same as owner but without
    // project-ownership privileges. This matches the "admin = full access" intent.
    if (isElevatedRole(roleId)) {
        return { role: roleId, isOwner: false, permissions: ceiling, planCeiling: ceiling };
    }

    // Normal role: pull the OWNER's customPermissions (inviters define role templates).
    let rolePerms: EffectivePermissionMap | undefined = ownRoles[roleId];
    if (!rolePerms) {
        const owner = await db.collection('users').findOne(
            { _id: project.userId },
            { projection: { 'crm.permissions': 1 } },
        );
        rolePerms = (owner?.crm?.permissions as any)?.[roleId];
    }

    const permissions = intersectWithCeiling(rolePerms, ceiling);
    return { role: roleId, isOwner: false, permissions, planCeiling: ceiling };
}

/**
 * Server-side enforcement wrapper. Returns a discriminated result so callers
 * can convert to whatever error shape they already use (server actions return
 * {error}, route handlers return 403, etc.).
 *
 * ```ts
 *   const guard = await requirePermission('team_users', 'create', projectId);
 *   if (!guard.ok) return { error: guard.error };
 * ```
 */
export async function requirePermission(
    moduleKey: string,
    action: PermissionAction = 'view',
    projectId?: string | null,
): Promise<{ ok: true; effective: EffectivePermissions } | { ok: false; error: string; effective?: EffectivePermissions | null }> {
    const effective = await getEffectivePermissionsForProject(projectId);
    if (!effective) return { ok: false, error: 'Authentication required.' };
    if (!can(effective, moduleKey, action)) {
        return {
            ok: false,
            error: `You don't have permission to ${action} ${prettyModuleLabel(moduleKey)}.`,
            effective,
        };
    }
    return { ok: true, effective };
}

function prettyModuleLabel(moduleKey: string): string {
    return moduleKey
        .split('_')
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(' ');
}

/**
 * Server version of `useCan` — convenience wrapper for pages/layouts that
 * need to make render-time decisions (e.g. hiding a CTA button).
 */
export async function canServer(
    moduleKey: string,
    action: PermissionAction = 'view',
    projectId?: string | null,
): Promise<boolean> {
    const effective = await getEffectivePermissionsForProject(projectId);
    return can(effective, moduleKey, action);
}

