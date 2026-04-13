import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import type { Notification } from '@/lib/definitions';

export type NotifyInput = {
    recipientUserId: string | ObjectId;
    projectId?: string | ObjectId | null;
    message: string;
    link?: string;
    eventType: string;
    sourceApp?: Notification['sourceApp'];
};

/**
 * Low-level helper: insert a notification row. Used by team features
 * (task assigned, invite accepted, new chat message, role changed).
 *
 * We reuse the existing `notifications` collection but route team events
 * through `sourceApp: 'system'` and stamp `recipientUserId` so the popover
 * can filter per-user even for project-wide events.
 */
export async function notifyTeamMember(input: NotifyInput): Promise<void> {
    const { recipientUserId, projectId, message, link, eventType, sourceApp = 'system' } = input;
    try {
        const { db } = await connectToDatabase();
        const row: any = {
            recipientUserId: new ObjectId(String(recipientUserId)),
            message,
            link: link || '',
            isRead: false,
            createdAt: new Date(),
            eventType,
            sourceApp,
            wabaId: '', // schema backwards-compat — unused for team events
        };
        if (projectId) {
            const id = typeof projectId === 'string' ? new ObjectId(projectId) : projectId;
            row.projectId = id;
        }
        await db.collection('notifications').insertOne(row);
    } catch (e) {
        // Notifications are fire-and-forget — never block the caller.
        console.warn('[notifyTeamMember] failed:', (e as any)?.message);
    }
}

export async function notifyManyTeamMembers(
    recipientUserIds: (string | ObjectId)[],
    payload: Omit<NotifyInput, 'recipientUserId'>,
): Promise<void> {
    if (!recipientUserIds?.length) return;
    const unique = Array.from(
        new Set(recipientUserIds.map((id) => (typeof id === 'string' ? id : id.toString()))),
    );
    await Promise.all(
        unique.map((id) => notifyTeamMember({ recipientUserId: id, ...payload })),
    );
}
