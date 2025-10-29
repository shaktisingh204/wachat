

'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions';
import type { CrmPermissions } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';

export async function saveRole(data: { id: string, name: string, permissions: any }): Promise<{ success: boolean, error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: "Access denied." };

    const { id, name, permissions } = data;
    const isNew = !id;

    try {
        const { db } = await connectToDatabase();
        const user = await db.collection('users').findOne({ _id: new ObjectId(session.user._id) });
        const existingRoles = user?.crm?.customRoles || [];
        
        if (isNew) {
            const newRole = { id: uuidv4(), name, permissions: {} };
            await db.collection('users').updateOne(
                { _id: new ObjectId(session.user._id) },
                { $push: { 'crm.customRoles': newRole } }
            );
        } else {
            const roleIndex = existingRoles.findIndex((r: any) => r.id === id);
            if (roleIndex === -1) return { success: false, error: 'Role not found.' };

            const updateField = `crm.customRoles.${roleIndex}.name`;
            await db.collection('users').updateOne(
                { _id: new ObjectId(session.user._id) },
                { $set: { [updateField]: name } }
            );
        }
        revalidatePath('/dashboard/team/manage-roles');
        return { success: true };
    } catch(e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function deleteRole(roleId: string): Promise<{ success: boolean, error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: "Access denied." };

    if (!roleId || roleId === 'agent') return { success: false, error: 'Cannot delete a default role.' };

    try {
        const { db } = await connectToDatabase();
        await db.collection('users').updateOne(
            { _id: new ObjectId(session.user._id) },
            { $pull: { 'crm.customRoles': { id: roleId } } }
        );
        revalidatePath('/dashboard/team/manage-roles');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}


export async function saveCrmPermissions(prevState: any, formData: FormData): Promise<{ message?: string, error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: "Access denied." };

    try {
        const { db } = await connectToDatabase();
        const user = await db.collection('users').findOne({ _id: new ObjectId(session.user._id) });
        if (!user) return { error: "User not found." };
        
        const allRoles = [{ id: 'agent', name: 'Agent' }, ...(user.crm?.customRoles || [])];
        const newPermissions: any = {};
        
        for (const role of allRoles) {
            newPermissions[role.id] = {};
            const modules = ['contacts', 'accounts', 'deals', 'tasks', 'automations', 'reports'];
            const actions = ['view', 'create', 'edit', 'delete'];
            
            for (const mod of modules) {
                newPermissions[role.id][mod] = {};
                for (const action of actions) {
                    const key = `${role.id}_${mod}_${action}`;
                    newPermissions[role.id][mod][action] = formData.get(key) === 'on';
                }
            }
        }
        
        await db.collection('users').updateOne(
            { _id: new ObjectId(session.user._id) },
            { $set: { 'crm.permissions': newPermissions } }
        );

        revalidatePath('/dashboard/team/manage-roles');
        return { message: 'Permissions updated successfully.' };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

