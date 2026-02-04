
'use server';

import { getSession } from '@/app/actions/index';
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

export async function getActivityLogs(
    projectId?: string,
    page: number = 1,
    limit: number = 20
): Promise<{ logs: WithId<ActivityLog>[], total: number, totalPages: number }> {
    const session = await getSession();
    if (!session?.user) {
        return { logs: [], total: 0, totalPages: 0 };
    }

    try {
        const { db } = await connectToDatabase();
        const skip = (page - 1) * limit;

        const query: any = {};

        // If projectId is provided, filter by it.
        // If NOT provided, we might want to show global activities for this user or all projects they are part of.
        // For now, let's stick to projectId filter or empty for "My Actions"?
        // Usually Activity Feed is Project-based.

        if (projectId && ObjectId.isValid(projectId)) {
            query.projectId = new ObjectId(projectId);
        } else {
            // If no project specified, maybe show logs where the user is the actor?
            // Or show logs for all projects the user is part of?
            // Let's safe default to "Actions I did" if no project specified
            query.userId = new ObjectId(session.user._id);
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
