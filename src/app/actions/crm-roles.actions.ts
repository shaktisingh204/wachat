
'use server';

import { getSession } from '@/app/actions/index.ts';
import { connectToDatabase } from '@/lib/mongodb';
import { getErrorMessage } from '@/lib/utils';
import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';
import type { CrmPermissions, CrmCustomRole } from '@/lib/definitions';
import { v4 as uuidv4 } from 'uuid';

export async function saveCrmPermissions(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access Denied' };

    const roleIds = formData.getAll('roleId') as string[];
    const permissionsToSave: CrmPermissions = { agent: {} };

    for (const roleId of roleIds) {
        if (!permissionsToSave[roleId as keyof CrmPermissions]) {
            (permissionsToSave[roleId as keyof CrmPermissions] as any) = {};
        }

        const crmModules = ['contacts', 'accounts', 'deals', 'tasks', 'automations', 'reports'];
        const actions = ['view', 'create', 'edit', 'delete'];

        for (const module of crmModules) {
            (permissionsToSave[roleId as keyof CrmPermissions] as any)[module] = {};
            for (const action of actions) {
                const key = `${roleId}_${module}_${action}`;
                const value = formData.get(key) === 'on';
                (permissionsToSave[roleId as keyof CrmPermissions] as any)[module][action] = value;
            }
        }
    }

    try {
        const { db } = await connectToDatabase();
        await db.collection('users').updateOne(
            { _id: new ObjectId(session.user._id) },
            { $set: { 'crm.permissions': permissionsToSave } }
        );
        revalidatePath('/dashboard/crm/hr-payroll/settings');
        return { message: 'Permissions saved successfully.' };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function saveRole(role: { id: string, name: string, permissions: any }): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access Denied' };

    const newRole: CrmCustomRole = {
        id: role.id || uuidv4(),
        name: role.name,
    };
    
    try {
        const { db } = await connectToDatabase();
        
        // Push the new role to the customRoles array
        await db.collection('users').updateOne(
            { _id: new ObjectId(session.user._id) },
            { $push: { 'crm.customRoles': newRole } }
        );

        revalidatePath('/dashboard/crm/hr-payroll/settings');
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
            }
        );
        revalidatePath('/dashboard/crm/hr-payroll/settings');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}
