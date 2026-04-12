
'use server';

import type { WithId, User } from '@/lib/definitions';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

function toObjectIdSafe(id: any): ObjectId | null {
    try {
        return new ObjectId(String(id));
    } catch {
        return null;
    }
}

export async function executeTeamAction(
    actionName: string,
    inputs: any,
    user: WithId<User>,
    logger: any
) {
    try {
        const { db } = await connectToDatabase();

        switch (actionName) {
            case 'createTask': {
                const title = String(inputs.title ?? '').trim();
                if (!title) throw new Error('title is required.');
                const projectId = inputs.projectId ? toObjectIdSafe(inputs.projectId) : null;
                const doc: any = {
                    userId: user._id,
                    projectId,
                    title,
                    description: inputs.description ? String(inputs.description) : '',
                    status: 'todo',
                    priority: ['low', 'medium', 'high'].includes(String(inputs.priority))
                        ? String(inputs.priority)
                        : 'medium',
                    assignedTo: inputs.assignedTo ? String(inputs.assignedTo) : null,
                    dueDate: inputs.dueDate ? new Date(String(inputs.dueDate)) : null,
                    comments: [],
                    createdAt: new Date(),
                    updatedAt: new Date(),
                };
                const res = await db.collection('team_tasks').insertOne(doc);
                logger.log(`[Team] Created task ${res.insertedId}`);
                return { output: { taskId: res.insertedId.toString() } };
            }

            case 'updateTaskStatus': {
                const taskId = toObjectIdSafe(inputs.taskId);
                if (!taskId) throw new Error('Invalid taskId.');
                const status = String(inputs.status ?? '').trim();
                if (!status) throw new Error('status is required.');
                const res = await db.collection('team_tasks').updateOne(
                    { _id: taskId, userId: user._id },
                    { $set: { status, updatedAt: new Date() } }
                );
                if (res.matchedCount === 0) throw new Error('Task not found.');
                return { output: { success: 'true' } };
            }

            case 'assignTask': {
                const taskId = toObjectIdSafe(inputs.taskId);
                if (!taskId) throw new Error('Invalid taskId.');
                const assignedTo = String(inputs.assignedTo ?? '').trim();
                if (!assignedTo) throw new Error('assignedTo is required.');
                const res = await db.collection('team_tasks').updateOne(
                    { _id: taskId, userId: user._id },
                    { $set: { assignedTo, updatedAt: new Date() } }
                );
                if (res.matchedCount === 0) throw new Error('Task not found.');
                return { output: { success: 'true' } };
            }

            case 'addTaskComment': {
                const taskId = toObjectIdSafe(inputs.taskId);
                if (!taskId) throw new Error('Invalid taskId.');
                const comment = String(inputs.comment ?? '').trim();
                if (!comment) throw new Error('comment is required.');
                const commentDoc = {
                    _id: new ObjectId(),
                    text: comment,
                    authorId: user._id,
                    createdAt: new Date(),
                };
                const res = await db.collection('team_tasks').updateOne(
                    { _id: taskId, userId: user._id },
                    { $push: { comments: commentDoc } as any, $set: { updatedAt: new Date() } }
                );
                if (res.matchedCount === 0) throw new Error('Task not found.');
                return { output: { commentId: commentDoc._id.toString() } };
            }

            case 'listTasks': {
                const query: any = { userId: user._id };
                if (inputs.projectId) {
                    const pid = toObjectIdSafe(inputs.projectId);
                    if (pid) query.projectId = pid;
                }
                if (inputs.status) query.status = String(inputs.status);
                if (inputs.assignedTo) query.assignedTo = String(inputs.assignedTo);
                const tasks = await db.collection('team_tasks')
                    .find(query)
                    .sort({ createdAt: -1 })
                    .limit(100)
                    .toArray();
                return { output: { tasks: JSON.parse(JSON.stringify(tasks)), count: tasks.length } };
            }

            default:
                return { error: `Team action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Team action failed.' };
    }
}
