
'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions';
import type { CrmTask } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';

export async function getCrmTasks(status?: 'To-Do' | 'In Progress' | 'Completed'): Promise<WithId<CrmTask>[]> {
    const session = await getSession();
    if (!session?.user) return [];

    try {
        const { db } = await connectToDatabase();
        const filter: Filter<CrmTask> = { userId: new ObjectId(session.user._id) };
        if (status) {
            filter.status = status;
        }

        const tasks = await db.collection<CrmTask>('crm_tasks')
            .find(filter)
            .sort({ dueDate: 1 })
            .toArray();
            
        return JSON.parse(JSON.stringify(tasks));
    } catch (e) {
        console.error("Failed to fetch CRM tasks:", e);
        return [];
    }
}

export async function createCrmTask(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: "Access denied" };

    try {
        const dueDate = formData.get('dueDate') as string;
        const newTaskData: Omit<CrmTask, '_id'> = {
            userId: new ObjectId(session.user._id),
            title: formData.get('title') as string,
            description: formData.get('description') as string | undefined,
            status: 'To-Do',
            priority: (formData.get('priority') as CrmTask['priority']) || 'Medium',
            type: (formData.get('type') as CrmTask['type']) || 'Follow-up',
            ...(dueDate && { dueDate: new Date(dueDate) }),
            createdAt: new Date(),
        };

        const contactId = formData.get('contactId') as string;
        if (contactId && ObjectId.isValid(contactId)) {
            newTaskData.contactId = new ObjectId(contactId);
        }
        const dealId = formData.get('dealId') as string;
        if (dealId && ObjectId.isValid(dealId)) {
            newTaskData.dealId = new ObjectId(dealId);
        }

        const { db } = await connectToDatabase();
        await db.collection('crm_tasks').insertOne(newTaskData as any);
        
        revalidatePath('/dashboard/crm/tasks');
        return { message: 'Task created successfully.' };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}


export async function updateCrmTaskStatus(taskId: string, status: CrmTask['status']): Promise<{ success: boolean; error?: string }> {
    if (!ObjectId.isValid(taskId)) {
        return { success: false, error: 'Invalid Task ID.' };
    }
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

    const { db } = await connectToDatabase();
    const task = await db.collection('crm_tasks').findOne({ _id: new ObjectId(taskId), userId: new ObjectId(session.user._id) });
    if (!task) return { success: false, error: 'Task not found.' };

    try {
        await db.collection('crm_tasks').updateOne(
            { _id: new ObjectId(taskId) },
            { $set: { status, updatedAt: new Date() } }
        );
        
        revalidatePath('/dashboard/crm/tasks');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function deleteCrmTask(taskId: string): Promise<{ success: boolean; error?: string }> {
    if (!ObjectId.isValid(taskId)) {
        return { success: false, error: 'Invalid Task ID.' };
    }
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

    const { db } = await connectToDatabase();
    const task = await db.collection('crm_tasks').findOne({ _id: new ObjectId(taskId), userId: new ObjectId(session.user._id) });
    if (!task) return { success: false, error: 'Task not found.' };

    try {
        await db.collection('crm_tasks').deleteOne({ _id: new ObjectId(taskId) });
        revalidatePath('/dashboard/crm/tasks');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}
