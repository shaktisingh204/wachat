'use server';

/**
 * CRM Role server actions.
 *
 * **Dual implementation:** when `USE_RUST_CRM === 'true'` the read/write
 * paths delegate to `/v1/crm/roles` on the Rust BFF (which persists to a
 * top-level `crm_roles` collection); otherwise the legacy embedded
 * `users.<tenantId>.crm.customRoles[]` + `crm.permissions` path runs.
 * Failures record via `recordRustFallback` and fall through to the
 * legacy path. The embedded-array logic is the safety net during the
 * canary period — do NOT delete it until cutover is irreversible.
 *
 * Migration script: `scripts/migrations/2026-05-18-lift-custom-roles-to-crm-roles.ts`.
 */

import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { getErrorMessage } from '@/lib/utils';
import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';
import type { GlobalPermissions, CrmCustomRole, User } from '@/lib/definitions';
import { v4 as uuidv4 } from 'uuid';
import { logActivity } from '@/app/actions/activity.actions';
import { writeAuditEntry } from '@/lib/audit-log';

import { globalModules } from '@/lib/permission-modules';
import { requirePermission } from '@/lib/rbac-server';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import {
    crmRolesApi,
    type CrmRoleDoc,
    type CrmRolePermissionFlags,
} from '@/lib/rust-client/crm-roles';
import { RustApiError } from '@/lib/rust-client/fetcher';

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

export async function saveRolePermissions(prevState: { message?: string; error?: string }, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access Denied' };
    const guard = await requirePermission('team_roles', 'edit');
    if (!guard.ok) return { error: guard.error };

    const roleIds = formData.getAll('roleId') as string[];
    const permissionsToSave: GlobalPermissions = { agent: {} };

    for (const roleId of roleIds) {
        if (!permissionsToSave[roleId as keyof GlobalPermissions]) {
            (permissionsToSave[roleId as keyof GlobalPermissions] as any) = {};
        }

        const actions = ['view', 'create', 'edit', 'delete'];

        for (const module of globalModules) {
            (permissionsToSave[roleId as keyof GlobalPermissions] as any)[module] = {};
            for (const action of actions) {
                const key = `${roleId}_${module}_${action}`;
                const value = formData.get(key) === 'on';
                (permissionsToSave[roleId as keyof GlobalPermissions] as any)[module][action] = value;
            }
        }
    }

    try {
        const { db } = await connectToDatabase();
        await db.collection('users').updateOne(
            { _id: new ObjectId(session.user._id) },
            { $set: { 'crm.permissions': permissionsToSave } }
        );
        revalidatePath('/dashboard/crm/team/manage-roles');
        await logActivity('ROLE_UPDATED', { roles: roleIds, action: 'Permissions Updated' }, undefined);
        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'update',
                entityKind: 'role_permissions',
                entityId: String(session.user._id),
                reason: `bulk role permissions update`,
            });
        } catch {
            /* non-fatal */
        }
        return { message: 'Permissions saved successfully.' };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function saveRole(role: { id: string, name: string, permissions: any }): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access Denied' };
    const guard = await requirePermission('team_roles', 'create');
    if (!guard.ok) return { success: false, error: guard.error };

    // Check Plan Limit
    const plan = (session.user as any).plan;
    const customRoleLimit = plan?.customRoleLimit ?? 3; // Default to 3 if not set
    const currentRoles = (session.user as any).crm?.customRoles || [];

    if (currentRoles.length >= customRoleLimit) {
        return { success: false, error: `Custom Role limit reached. Your plan allows up to ${customRoleLimit} custom roles.` };
    }

    const newRole: CrmCustomRole = {
        id: role.id || uuidv4(),
        name: role.name,
    };

    if (useRustCrm()) {
        try {
            const permsForRust =
                role.permissions && typeof role.permissions === 'object'
                    ? (role.permissions as Record<string, CrmRolePermissionFlags>)
                    : {};
            await crmRolesApi.create({
                name: newRole.name,
                permissions: permsForRust,
            });
            revalidatePath('/dashboard/crm/team/manage-roles');
            await logActivity('ROLE_UPDATED', { role: newRole.name, action: 'Role Created' }, undefined);
            return { success: true };
        } catch (e) {
            console.error('[saveRole] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'role',
                op: 'create',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();

        await db.collection('users').updateOne(
            { _id: new ObjectId(session.user._id) },
            { $push: { 'crm.customRoles': newRole } } as any
        );

        revalidatePath('/dashboard/crm/team/manage-roles');
        await logActivity('ROLE_UPDATED', { role: newRole.name, action: 'Role Created' }, undefined);
        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'create',
                entityKind: 'role',
                entityId: newRole.id,
                reason: newRole.name,
            });
        } catch {
            /* non-fatal */
        }
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function deleteRole(roleId: string): Promise<{ success: boolean, error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access Denied' };

    if (roleId === 'agent') {
        return { success: false, error: "The default 'Agent' role cannot be deleted." };
    }

    const guard = await requirePermission('team_roles', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    if (useRustCrm() && ObjectId.isValid(roleId)) {
        try {
            await crmRolesApi.delete(roleId);
            revalidatePath('/dashboard/crm/team/manage-roles');
            await logActivity('ROLE_UPDATED', { roleId, action: 'Role Deleted' }, undefined);
            return { success: true };
        } catch (e) {
            console.error('[deleteRole] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'role',
                op: 'delete',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        await db.collection('users').updateOne(
            { _id: new ObjectId(session.user._id) },
            {
                $pull: { 'crm.customRoles': { id: roleId } },
                $unset: { [`crm.permissions.${roleId}`]: "" }
            } as any
        );
        revalidatePath('/dashboard/crm/team/manage-roles');
        await logActivity('ROLE_UPDATED', { roleId, action: 'Role Deleted' }, undefined);
        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'delete',
                entityKind: 'role',
                entityId: roleId,
            });
        } catch {
            /* non-fatal */
        }
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function getCustomRoles(): Promise<CrmCustomRole[]> {
    const session = await getSession();
    if (!session?.user) return [];

    if (useRustCrm()) {
        try {
            const resp = await crmRolesApi.list({ limit: 100 });
            return resp.items.map((r) => ({ id: r._id, name: r.name }));
        } catch (e) {
            console.error('[getCustomRoles] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'role',
                op: 'list',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const user = await db.collection<User>('users').findOne(
            { _id: new ObjectId(session.user._id) },
            { projection: { 'crm.customRoles': 1 } }
        );

        return user?.crm?.customRoles || [];
    } catch (e) {
        console.error("Error fetching custom roles:", e);
        return [];
    }
}

/**
 * Rust-shaped role read (returns the full Rust DTO when the Rust path
 * succeeds; falls back to synthesising one from the embedded array so
 * callers can rely on a single shape).
 */
export async function getRoles(): Promise<CrmRoleDoc[]> {
    const session = await getSession();
    if (!session?.user) return [];

    if (useRustCrm()) {
        try {
            const resp = await crmRolesApi.list({ limit: 100 });
            return resp.items;
        } catch (e) {
            console.error('[getRoles] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'role',
                op: 'list',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const user = await db.collection<User>('users').findOne(
            { _id: new ObjectId(session.user._id) },
            { projection: { 'crm.customRoles': 1, 'crm.permissions': 1 } }
        );
        const embedded = user?.crm?.customRoles || [];
        const permMap = (user?.crm?.permissions || {}) as Record<
            string,
            Record<string, CrmRolePermissionFlags>
        >;
        return embedded.map((r) => ({
            _id: r.id,
            name: r.name,
            slug: r.id,
            displayName: r.name,
            permissions: permMap[r.id] || {},
            status: 'active' as const,
        }));
    } catch (e) {
        console.error('getRoles error:', e);
        return [];
    }
}

export async function getRoleById(roleId: string): Promise<CrmRoleDoc | null> {
    if (!roleId) return null;

    const session = await getSession();
    if (!session?.user) return null;

    if (useRustCrm() && ObjectId.isValid(roleId)) {
        try {
            return await crmRolesApi.getById(roleId);
        } catch (e) {
            if (e instanceof RustApiError && e.status === 404) return null;
            console.error('[getRoleById] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'role',
                op: 'get',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const user = await db.collection<User>('users').findOne(
            { _id: new ObjectId(session.user._id) },
            { projection: { 'crm.customRoles': 1, 'crm.permissions': 1 } }
        );
        const embedded = (user?.crm?.customRoles || []).find((r) => r.id === roleId);
        if (!embedded) return null;
        const permMap = (user?.crm?.permissions || {}) as Record<
            string,
            Record<string, CrmRolePermissionFlags>
        >;
        return {
            _id: embedded.id,
            name: embedded.name,
            slug: embedded.id,
            displayName: embedded.name,
            permissions: permMap[embedded.id] || {},
            status: 'active' as const,
        };
    } catch (e) {
        console.error('getRoleById error:', e);
        return null;
    }
}
