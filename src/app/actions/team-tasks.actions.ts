'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import type { TeamTask, Project } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { logActivity } from '@/app/actions/activity.actions';
import { requirePermission } from '@/lib/rbac-server';
import { notifyTeamMember } from '@/lib/team-notifications';

export type TeamTaskView = WithId<TeamTask> & {
    assigneeName?: string;
    assigneeEmail?: string;
    ownerUserId: string;
};

function scopeFilterForSession(session: any): Filter<TeamTask> {
    // Tasks are scoped to the project owner (the inviter). An agent on a
    // project sees that owner's tasks — the OR below captures both paths.
    const sessionUserId = new ObjectId(session.user._id);
    return { $or: [{ userId: sessionUserId }, { assignedTo: sessionUserId }] } as any;
}

export async function getTeamTasks(
    status?: 'To-Do' | 'In Progress' | 'Completed',
    projectId?: string,
): Promise<TeamTaskView[]> {
    const session = await getSession();
    if (!session?.user) return [];

    const guard = await requirePermission('team_tasks', 'view', projectId || null);
    if (!guard.ok) return [];

    try {
        const { db } = await connectToDatabase();
        const filter: Filter<TeamTask> = scopeFilterForSession(session);
        if (status) (filter as any).status = status;

        const tasks = await db.collection<TeamTask>('team_tasks')
            .aggregate<TeamTaskView>([
                { $match: filter },
                { $sort: { dueDate: 1, createdAt: -1 } },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'assignedTo',
                        foreignField: '_id',
                        as: 'assignee',
                    },
                },
                { $unwind: { path: '$assignee', preserveNullAndEmptyArrays: true } },
                {
                    $addFields: {
                        assigneeName: '$assignee.name',
                        assigneeEmail: '$assignee.email',
                        ownerUserId: { $toString: '$userId' },
                    },
                },
                { $project: { assignee: 0 } },
            ])
            .toArray();

        return JSON.parse(JSON.stringify(tasks));
    } catch (e) {
        console.error('[getTeamTasks] failed:', e);
        return [];
    }
}

/**
 * Return the list of users who can be assigned tasks by the caller.
 * Owners: agents of every project they own (deduplicated).
 * Agents: the owner of the current project plus other agents.
 */
export async function getAssignableTeamMembers(
    projectId?: string | null,
): Promise<{ _id: string; name: string; email: string }[]> {
    const session = await getSession();
    if (!session?.user) return [];

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);

        let projectFilter: Filter<Project>;
        if (projectId && ObjectId.isValid(projectId)) {
            projectFilter = { _id: new ObjectId(projectId) } as any;
        } else {
            projectFilter = {
                $or: [{ userId }, { 'agents.userId': userId }],
            } as any;
        }

        const projects = await db.collection<Project>('projects').find(projectFilter).toArray();
        const userIds = new Set<string>();
        for (const p of projects) {
            userIds.add(p.userId.toString());
            for (const a of p.agents || []) {
                if (a.userId) userIds.add(a.userId.toString());
            }
        }

        const objectIds = Array.from(userIds).map((id) => new ObjectId(id));
        if (!objectIds.length) return [];

        const users = await db
            .collection('users')
            .find({ _id: { $in: objectIds } }, { projection: { name: 1, email: 1 } })
            .toArray();

        return users.map((u) => ({
            _id: u._id.toString(),
            name: u.name || u.email,
            email: u.email,
        }));
    } catch (e) {
        console.error('[getAssignableTeamMembers] failed:', e);
        return [];
    }
}

export async function createTeamTask(
    prevState: any,
    formData: FormData,
): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    const projectId = (formData.get('projectId') as string) || null;
    const guard = await requirePermission('team_tasks', 'create', projectId);
    if (!guard.ok) return { error: guard.error };

    try {
        const dueDate = formData.get('dueDate') as string;
        const title = (formData.get('title') as string)?.trim();
        if (!title) return { error: 'Title is required.' };

        const newTaskData: Omit<TeamTask, '_id'> = {
            userId: new ObjectId(session.user._id),
            title,
            description: (formData.get('description') as string | undefined)?.trim() || undefined,
            status: 'To-Do',
            priority: (formData.get('priority') as TeamTask['priority']) || 'Medium',
            ...(dueDate && { dueDate: new Date(dueDate) }),
            createdAt: new Date(),
        };

        const plan = (session.user as any).plan;
        if (plan?.features?.teamTasks === false) {
            return { error: 'Team Tasks feature is not enabled on your plan.' };
        }
        const teamTaskLimit = plan?.teamTaskLimit ?? 500;
        const { db } = await connectToDatabase();

        const currentTaskCount = await db.collection('team_tasks').countDocuments({ userId: new ObjectId(session.user._id) });
        if (currentTaskCount >= teamTaskLimit) {
            return { error: `Team Task limit reached. Your plan allows up to ${teamTaskLimit} tasks.` };
        }

        const assignedTo = formData.get('assignedTo') as string;
        if (assignedTo && ObjectId.isValid(assignedTo)) {
            newTaskData.assignedTo = new ObjectId(assignedTo);
        }

        const inserted = await db.collection('team_tasks').insertOne(newTaskData as any);

        // Notify the assignee (if not the creator).
        if (newTaskData.assignedTo && !newTaskData.assignedTo.equals(new ObjectId(session.user._id))) {
            await notifyTeamMember({
                recipientUserId: newTaskData.assignedTo,
                projectId: projectId || undefined,
                message: `${session.user.name} assigned you a task: ${title}`,
                link: '/dashboard/team/tasks',
                eventType: 'TASK_ASSIGNED',
            });
        }

        revalidatePath('/dashboard/team/tasks');
        await logActivity(
            'TASK_CREATED',
            { title, assignedTo: assignedTo || null, taskId: inserted.insertedId.toString() },
            projectId || undefined,
        );
        return { message: 'Task created.' };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function updateTeamTaskStatus(
    taskId: string,
    status: TeamTask['status'],
): Promise<{ success: boolean; error?: string }> {
    if (!ObjectId.isValid(taskId)) return { success: false, error: 'Invalid task id.' };
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

    const guard = await requirePermission('team_tasks', 'edit');
    if (!guard.ok) return { success: false, error: guard.error };

    const { db } = await connectToDatabase();
    const task = await db.collection<TeamTask>('team_tasks').findOne({ _id: new ObjectId(taskId) });
    if (!task) return { success: false, error: 'Task not found.' };

    const sessionUserId = new ObjectId(session.user._id);
    const isOwner = task.userId.equals(sessionUserId);
    const isAssignee = task.assignedTo?.equals(sessionUserId);
    if (!isOwner && !isAssignee) return { success: false, error: 'Not allowed on this task.' };

    try {
        await db.collection('team_tasks').updateOne(
            { _id: new ObjectId(taskId) },
            { $set: { status, updatedAt: new Date() } },
        );
        revalidatePath('/dashboard/team/tasks');
        await logActivity('TASK_UPDATED', { taskId, status });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function updateTeamTask(
    taskId: string,
    patch: Partial<Pick<TeamTask, 'title' | 'description' | 'priority' | 'dueDate' | 'assignedTo'>>,
): Promise<{ success: boolean; error?: string }> {
    if (!ObjectId.isValid(taskId)) return { success: false, error: 'Invalid task id.' };
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

    const guard = await requirePermission('team_tasks', 'edit');
    if (!guard.ok) return { success: false, error: guard.error };

    const { db } = await connectToDatabase();
    const task = await db.collection<TeamTask>('team_tasks').findOne({
        _id: new ObjectId(taskId),
        userId: new ObjectId(session.user._id),
    });
    if (!task) return { success: false, error: 'Task not found.' };

    const $set: any = { updatedAt: new Date() };
    if (patch.title !== undefined) $set.title = String(patch.title).trim();
    if (patch.description !== undefined) $set.description = patch.description;
    if (patch.priority !== undefined) $set.priority = patch.priority;
    if (patch.dueDate !== undefined) $set.dueDate = patch.dueDate ? new Date(patch.dueDate as any) : null;
    if (patch.assignedTo !== undefined) {
        $set.assignedTo = patch.assignedTo && ObjectId.isValid(patch.assignedTo as any)
            ? new ObjectId(patch.assignedTo as any)
            : null;
    }

    try {
        await db.collection('team_tasks').updateOne({ _id: new ObjectId(taskId) }, { $set });
        // Fire a notification when a new assignee is set.
        if ($set.assignedTo && !$set.assignedTo.equals(new ObjectId(session.user._id))) {
            await notifyTeamMember({
                recipientUserId: $set.assignedTo,
                message: `${session.user.name} reassigned a task to you: ${task.title}`,
                link: '/dashboard/team/tasks',
                eventType: 'TASK_ASSIGNED',
            });
        }
        revalidatePath('/dashboard/team/tasks');
        await logActivity('TASK_UPDATED', { taskId, patch });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function deleteTeamTask(taskId: string): Promise<{ success: boolean; error?: string }> {
    if (!ObjectId.isValid(taskId)) return { success: false, error: 'Invalid task id.' };
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

    const guard = await requirePermission('team_tasks', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    const { db } = await connectToDatabase();
    const task = await db.collection<TeamTask>('team_tasks').findOne({
        _id: new ObjectId(taskId),
        userId: new ObjectId(session.user._id),
    });
    if (!task) return { success: false, error: 'Task not found.' };

    try {
        await db.collection('team_tasks').deleteOne({ _id: new ObjectId(taskId) });
        revalidatePath('/dashboard/team/tasks');
        await logActivity('TASK_DELETED', { taskId, title: task.title });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}
