'use server';

import { getSession } from '@/app/actions/index';
import { connectToDatabase } from '@/lib/mongodb';
import { getErrorMessage } from '@/lib/utils';
import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';
import type { GlobalPermissions, CrmCustomRole, User } from '@/lib/definitions';
import { v4 as uuidv4 } from 'uuid';
import { logActivity } from '@/app/actions/activity.actions';

import { globalModules } from '@/lib/permission-modules';

export async function saveRolePermissions(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access Denied' };

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
        revalidatePath('/dashboard/team/manage-roles');
        await logActivity('ROLE_UPDATED', { roles: roleIds, action: 'Permissions Updated' }, undefined);
        return { message: 'Permissions saved successfully.' };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function saveRole(role: { id: string, name: string, permissions: any }): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access Denied' };

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

    try {
        const { db } = await connectToDatabase();

        await db.collection('users').updateOne(
            { _id: new ObjectId(session.user._id) },
            { $push: { 'crm.customRoles': newRole } } as any
        );

        revalidatePath('/dashboard/team/manage-roles');
        await logActivity('ROLE_UPDATED', { role: newRole.name, action: 'Role Created' }, undefined);
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

    try {
        const { db } = await connectToDatabase();
        await db.collection('users').updateOne(
            { _id: new ObjectId(session.user._id) },
            {
                $pull: { 'crm.customRoles': { id: roleId } },
                $unset: { [`crm.permissions.${roleId}`]: "" }
            } as any
        );
        revalidatePath('/dashboard/team/manage-roles');
        await logActivity('ROLE_UPDATED', { roleId, action: 'Role Deleted' }, undefined);
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function getCustomRoles(): Promise<CrmCustomRole[]> {
    const session = await getSession();
    if (!session?.user) return [];

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
