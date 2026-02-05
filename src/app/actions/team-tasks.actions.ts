'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import type { TeamTask } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { logActivity } from '@/app/actions/activity.actions';

export async function getTeamTasks(status?: 'To-Do' | 'In Progress' | 'Completed'): Promise<WithId<TeamTask>[]> {
    const session = await getSession();
    if (!session?.user) return [];

    try {
        const { db } = await connectToDatabase();
        const filter: Filter<TeamTask> = { userId: new ObjectId(session.user._id) };
        if (status) {
            filter.status = status;
        }

        const tasks = await db.collection<TeamTask>('team_tasks')
            .find(filter)
            .sort({ dueDate: 1 })
            .toArray();

        return JSON.parse(JSON.stringify(tasks));
    } catch (e) {
        console.error("Failed to fetch Team tasks:", e);
        return [];
    }
}

export async function createTeamTask(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: "Access denied" };

    try {
        const dueDate = formData.get('dueDate') as string;
        const newTaskData: Omit<TeamTask, '_id'> = {
            userId: new ObjectId(session.user._id),
            title: formData.get('title') as string,
            description: formData.get('description') as string | undefined,
            status: 'To-Do',
            priority: (formData.get('priority') as TeamTask['priority']) || 'Medium',
            ...(dueDate && { dueDate: new Date(dueDate) }),
            createdAt: new Date(),
        };

        // Check Plan Limits & Access
        const plan = (session.user as any).plan;

        if (plan?.features?.teamTasks === false) {
            return { error: 'Team Tasks feature is not enabled on your plan.' };
        }

        const teamTaskLimit = plan?.teamTaskLimit ?? 50;
        const { db } = await connectToDatabase();

        const currentTaskCount = await db.collection('team_tasks').countDocuments({ userId: new ObjectId(session.user._id) });
        if (currentTaskCount >= teamTaskLimit) {
            return { error: `Team Task limit reached. Your plan allows up to ${teamTaskLimit} tasks.` };
        }

        const assignedTo = formData.get('assignedTo') as string;
        if (assignedTo && ObjectId.isValid(assignedTo)) {
            newTaskData.assignedTo = new ObjectId(assignedTo);
        }

        // reused db connection from above
        // const { db } = await connectToDatabase();
        await db.collection('team_tasks').insertOne(newTaskData as any);

        revalidatePath('/dashboard/team/tasks');
        await logActivity('TASK_CREATED', { title: newTaskData.title, assignedTo: assignedTo || 'Unassigned' }, undefined);
        return { message: 'Task created successfully.' };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}


export async function updateTeamTaskStatus(taskId: string, status: TeamTask['status']): Promise<{ success: boolean; error?: string }> {
    if (!ObjectId.isValid(taskId)) {
        return { success: false, error: 'Invalid Task ID.' };
    }
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

    const { db } = await connectToDatabase();
    const task = await db.collection('team_tasks').findOne({ _id: new ObjectId(taskId), userId: new ObjectId(session.user._id) });
    if (!task) return { success: false, error: 'Task not found.' };

    try {
        await db.collection('team_tasks').updateOne(
            { _id: new ObjectId(taskId) },
            { $set: { status, updatedAt: new Date() } }
        );

        revalidatePath('/dashboard/team/tasks');
        await logActivity('TASK_UPDATED', { taskId, status }, undefined);
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function deleteTeamTask(taskId: string): Promise<{ success: boolean; error?: string }> {
    if (!ObjectId.isValid(taskId)) {
        return { success: false, error: 'Invalid Task ID.' };
    }
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

    const { db } = await connectToDatabase();
    const task = await db.collection('team_tasks').findOne({ _id: new ObjectId(taskId), userId: new ObjectId(session.user._id) });
    if (!task) return { success: false, error: 'Task not found.' };

    try {
        await db.collection('team_tasks').deleteOne({ _id: new ObjectId(taskId) });
        revalidatePath('/dashboard/team/tasks');
        await logActivity('TASK_DELETED', { taskId }, undefined);
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}
