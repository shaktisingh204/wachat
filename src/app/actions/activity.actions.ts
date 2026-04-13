
'use server';

import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import type { ActivityLog, ActivityAction, WithId } from '@/lib/definitions';

export async function logActivity(
    action: ActivityAction | string,
    details: any,
    projectId?: string | ObjectId
): Promise<void> {
    const session = await getSession();
    if (!session?.user) return; // Silent return if not auth

    try {
        const { db } = await connectToDatabase();

        const logEntry: Omit<ActivityLog, '_id'> = {
            userId: new ObjectId(session.user._id),
            action,
            details,
            createdAt: new Date(),
        };

        if (projectId) {
            logEntry.projectId = new ObjectId(projectId);
        }

        await db.collection('activity_logs').insertOne(logEntry);
    } catch (error) {
        console.error("Failed to log activity:", error);
        // Silent fail to not disrupt main flow
    }
}

export type ActivityFilters = {
    actorUserId?: string;
    actionPrefix?: string; // e.g. 'TASK' | 'MEMBER' | 'ROLE' | 'CHAT'
    sinceIso?: string;
    untilIso?: string;
};

export async function getActivityLogs(
    projectId?: string,
    page: number = 1,
    limit: number = 20,
    filters?: ActivityFilters,
): Promise<{ logs: WithId<ActivityLog>[], total: number, totalPages: number }> {
    const session = await getSession();
    if (!session?.user) {
        return { logs: [], total: 0, totalPages: 0 };
    }

    try {
        const { db } = await connectToDatabase();
        const skip = (page - 1) * limit;

        const query: any = {};

        if (projectId && ObjectId.isValid(projectId)) {
            query.projectId = new ObjectId(projectId);
        } else {
            // Show every activity across the projects the current user can access
            // (owned + agent on). This matches what the rest of the app does in
            // `getAllNotifications`.
            const userObjectId = new ObjectId(session.user._id);
            const accessibleProjects = await db.collection('projects').find(
                { $or: [{ userId: userObjectId }, { 'agents.userId': userObjectId }] } as any,
                { projection: { _id: 1 } },
            ).toArray();
            const projectIds = accessibleProjects.map((p) => p._id);
            query.$or = [
                { userId: userObjectId },
                ...(projectIds.length ? [{ projectId: { $in: projectIds } }] : []),
            ];
        }

        if (filters?.actorUserId && ObjectId.isValid(filters.actorUserId)) {
            query.userId = new ObjectId(filters.actorUserId);
        }
        if (filters?.actionPrefix) {
            query.action = { $regex: `^${filters.actionPrefix}`, $options: 'i' };
        }
        if (filters?.sinceIso || filters?.untilIso) {
            query.createdAt = {};
            if (filters?.sinceIso) (query.createdAt as any).$gte = new Date(filters.sinceIso);
            if (filters?.untilIso) (query.createdAt as any).$lte = new Date(filters.untilIso);
        }

        const [logs, total] = await Promise.all([
            db.collection<ActivityLog>('activity_logs')
                .aggregate([
                    { $match: query },
                    { $sort: { createdAt: -1 } },
                    { $skip: skip },
                    { $limit: limit },
                    {
                        $lookup: {
                            from: 'users',
                            localField: 'userId',
                            foreignField: '_id',
                            as: 'user'
                        }
                    },
                    { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
                    {
                        $project: {
                            _id: 1,
                            userId: 1,
                            projectId: 1,
                            action: 1,
                            details: 1,
                            createdAt: 1,
                            user: { name: 1, email: 1, avatar: 1 }
                        }
                    }
                ]).toArray(),
            db.collection('activity_logs').countDocuments(query)
        ]);

        return {
            logs: JSON.parse(JSON.stringify(logs)),
            total,
            totalPages: Math.ceil(total / limit)
        };

    } catch (e) {
        console.error("Error fetching activity logs:", e);
        return { logs: [], total: 0, totalPages: 0 };
    }
}
