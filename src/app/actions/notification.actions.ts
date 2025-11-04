
'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId, Filter, WithId } from 'mongodb';
import { getSession } from '@/app/actions/index.ts';
import { connectToDatabase } from '@/lib/mongodb';
import type { Notification, NotificationWithProject, Project } from '@/lib/definitions';

export async function getAllNotifications(
    page: number = 1,
    limit: number = 20,
    eventTypeFilter?: string,
    projectId?: string | null,
): Promise<{ notifications: WithId<NotificationWithProject>[], total: number }> {
    const session = await getSession();
    if (!session?.user) return { notifications: [], total: 0 };
    
    try {
        const { db } = await connectToDatabase();
        
        const filter: Filter<Notification> = {};

        if (projectId && ObjectId.isValid(projectId)) {
            // Ensure the user has access to this specific project
            const hasAccess = await db.collection('projects').findOne({
                _id: new ObjectId(projectId),
                $or: [{ userId: new ObjectId(session.user._id) }, { 'agents.userId': new ObjectId(session.user._id) }]
            });
            if (!hasAccess) return { notifications: [], total: 0 };
            filter.projectId = new ObjectId(projectId);
        } else {
             // If no specific project, get notifications for all accessible projects
            const projectFilter: Filter<Project> = {
                $or: [{ userId: new ObjectId(session.user._id) }, { 'agents.userId': new ObjectId(session.user._id) }]
            };
            const accessibleProjects = await db.collection('projects').find(projectFilter).project({_id: 1}).toArray();
            const accessibleProjectIds = accessibleProjects.map(p => p._id);
            filter.projectId = { $in: accessibleProjectIds };
        }
        
        if (eventTypeFilter) {
            filter.eventType = eventTypeFilter;
        }

        const skip = (page - 1) * limit;

        const [notifications, total] = await Promise.all([
            db.collection('notifications').aggregate<WithId<NotificationWithProject>>([
                { $match: filter },
                { $sort: { createdAt: -1 } },
                { $skip: skip },
                { $limit: limit },
                {
                    $lookup: {
                        from: 'projects',
                        localField: 'projectId',
                        foreignField: '_id',
                        as: 'projectInfo'
                    }
                },
                {
                    $unwind: { path: '$projectInfo', preserveNullAndEmptyArrays: true }
                },
                {
                    $addFields: {
                        projectName: '$projectInfo.name'
                    }
                },
                {
                    $project: { projectInfo: 0 }
                }
            ]).toArray(),
            db.collection('notifications').countDocuments(filter)
        ]);
        
        return { notifications: JSON.parse(JSON.stringify(notifications)), total };
    } catch (e: any) {
        return { notifications: [], total: 0 };
    }
}

export async function markNotificationAsRead(notificationId: string): Promise<{ success: boolean }> {
  try {
    const { db } = await connectToDatabase();
    await db.collection('notifications').updateOne({ _id: new ObjectId(notificationId) }, { $set: { isRead: true } });
    revalidatePath('/dashboard/notifications');
    revalidatePath('/dashboard', 'layout');
    return { success: true };
  } catch (e) {
    return { success: false };
  }
}

export async function markAllNotificationsAsRead(): Promise<{ success: boolean, updatedCount?: number }> {
    const session = await getSession();
    if (!session?.user) return { success: false };

    try {
        const { db } = await connectToDatabase();
        const projectFilter: Filter<Project> = {
            $or: [{ userId: new ObjectId(session.user._id) }, { 'agents.userId': new ObjectId(session.user._id) }]
        };
        const accessibleProjects = await db.collection('projects').find(projectFilter).project({_id: 1}).toArray();
        const accessibleProjectIds = accessibleProjects.map(p => p._id);
        
        const result = await db.collection('notifications').updateMany(
            { projectId: { $in: accessibleProjectIds }, isRead: false },
            { $set: { isRead: true } }
        );
        revalidatePath('/dashboard/notifications');
        revalidatePath('/dashboard', 'layout');
        return { success: true, updatedCount: result.modifiedCount };
    } catch (e) {
        return { success: false };
    }
}
