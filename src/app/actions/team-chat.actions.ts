'use server';

import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import type { TeamChannel, TeamMessage } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { requirePermission } from '@/lib/rbac-server';
import { notifyManyTeamMembers } from '@/lib/team-notifications';

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB

export type TeamChannelView = Omit<WithId<TeamChannel>, '_id' | 'participants' | 'lastMessage' | 'createdAt' | 'updatedAt'> & {
    _id: string;
    participants: { userId: string; name: string; avatar?: string }[];
    lastMessage?: { content: string; senderId: string; createdAt: string };
    createdAt: string;
    updatedAt: string;
    unread?: number;
};

function serializeChannel(raw: any): TeamChannelView {
    return {
        _id: raw._id.toString(),
        type: raw.type,
        name: raw.name,
        participants: (raw.participants || []).map((p: any) => ({
            userId: p.userId?.toString() ?? String(p.userId),
            name: p.name,
            avatar: p.avatar,
        })),
        lastMessage: raw.lastMessage
            ? {
                  content: raw.lastMessage.content,
                  senderId: raw.lastMessage.senderId?.toString(),
                  createdAt:
                      raw.lastMessage.createdAt instanceof Date
                          ? raw.lastMessage.createdAt.toISOString()
                          : raw.lastMessage.createdAt,
              }
            : undefined,
        createdAt: raw.createdAt instanceof Date ? raw.createdAt.toISOString() : raw.createdAt,
        updatedAt: raw.updatedAt instanceof Date ? raw.updatedAt.toISOString() : raw.updatedAt,
    };
}

/* ──────────────────────────────────── LISTING ───────────────────────────────────── */

export async function listTeamChannels(): Promise<TeamChannelView[]> {
    const session = await getSession();
    if (!session?.user) return [];

    const guard = await requirePermission('team_chat', 'view');
    if (!guard.ok) return [];

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);
        const channels = await db
            .collection<TeamChannel>('team_channels')
            .find({ 'participants.userId': userObjectId } as any)
            .sort({ updatedAt: -1 })
            .limit(100)
            .toArray();
        return channels.map(serializeChannel);
    } catch (e) {
        console.error('[listTeamChannels] failed:', e);
        return [];
    }
}

/* ───────────────────────────────────── CREATE ───────────────────────────────────── */

export async function getOrCreateDmChannel(targetUserId: string): Promise<TeamChannelView | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!ObjectId.isValid(targetUserId)) return null;

    const guard = await requirePermission('team_chat', 'create');
    if (!guard.ok) return null;

    const currentUserId = new ObjectId(session.user._id);
    const targetId = new ObjectId(targetUserId);
    if (currentUserId.equals(targetId)) return null;

    try {
        const { db } = await connectToDatabase();

        const existing = await db.collection<TeamChannel>('team_channels').findOne({
            type: 'dm',
            $and: [
                { 'participants.userId': currentUserId },
                { 'participants.userId': targetId },
            ],
        } as any);
        if (existing) return serializeChannel(existing);

        const users = await db
            .collection('users')
            .find({ _id: { $in: [currentUserId, targetId] } })
            .toArray();
        const a = users.find((u) => u._id.equals(currentUserId));
        const b = users.find((u) => u._id.equals(targetId));
        if (!a || !b) return null;

        const newChannel: any = {
            type: 'dm',
            participants: [
                { userId: a._id, name: a.name || a.email, avatar: a.image },
                { userId: b._id, name: b.name || b.email, avatar: b.image },
            ],
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const result = await db.collection('team_channels').insertOne(newChannel);
        return serializeChannel({ ...newChannel, _id: result.insertedId });
    } catch (e) {
        console.error('[getOrCreateDmChannel] failed:', e);
        return null;
    }
}

export async function createGroupChannel(args: {
    name: string;
    memberUserIds: string[];
}): Promise<{ success: boolean; error?: string; channel?: TeamChannelView }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Authentication required.' };
    const name = (args.name || '').trim();
    if (!name) return { success: false, error: 'Group name is required.' };
    const memberIds = (args.memberUserIds || []).filter((id) => id && ObjectId.isValid(id));

    const guard = await requirePermission('team_chat', 'create');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const { db } = await connectToDatabase();
        const currentUserId = new ObjectId(session.user._id);
        const allIds = Array.from(new Set([session.user._id, ...memberIds])).map((id) => new ObjectId(id));

        const users = await db
            .collection('users')
            .find({ _id: { $in: allIds } }, { projection: { name: 1, email: 1, image: 1 } })
            .toArray();

        const participants = users.map((u) => ({
            userId: u._id,
            name: u.name || u.email,
            avatar: u.image,
        }));

        const newChannel: any = {
            type: 'group',
            name,
            participants,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const result = await db.collection('team_channels').insertOne(newChannel);

        await notifyManyTeamMembers(
            participants.filter((p) => !p.userId.equals(currentUserId)).map((p) => p.userId),
            {
                message: `${session.user.name} added you to the group "${name}"`,
                link: '/dashboard/team/team-chat',
                eventType: 'CHAT_GROUP_CREATED',
            },
        );

        revalidatePath('/dashboard/team/team-chat');
        return { success: true, channel: serializeChannel({ ...newChannel, _id: result.insertedId }) };
    } catch (e) {
        console.error('[createGroupChannel] failed:', e);
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function addChannelMembers(
    channelId: string,
    memberUserIds: string[],
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Authentication required.' };
    if (!ObjectId.isValid(channelId)) return { success: false, error: 'Invalid channel.' };

    const guard = await requirePermission('team_chat', 'edit');
    if (!guard.ok) return { success: false, error: guard.error };

    const validIds = (memberUserIds || []).filter((id) => id && ObjectId.isValid(id)).map((id) => new ObjectId(id));
    if (!validIds.length) return { success: false, error: 'No valid members.' };

    try {
        const { db } = await connectToDatabase();
        const channel = await db.collection<TeamChannel>('team_channels').findOne({ _id: new ObjectId(channelId) });
        if (!channel) return { success: false, error: 'Channel not found.' };
        if (channel.type === 'dm') return { success: false, error: 'Cannot add members to a DM.' };

        const existing = new Set(channel.participants.map((p: any) => p.userId.toString()));
        const newIds = validIds.filter((id) => !existing.has(id.toString()));
        if (!newIds.length) return { success: true };

        const users = await db
            .collection('users')
            .find({ _id: { $in: newIds } }, { projection: { name: 1, email: 1, image: 1 } })
            .toArray();
        const newParticipants = users.map((u) => ({
            userId: u._id,
            name: u.name || u.email,
            avatar: u.image,
        }));

        await db.collection('team_channels').updateOne(
            { _id: new ObjectId(channelId) },
            { $push: { participants: { $each: newParticipants } }, $set: { updatedAt: new Date() } } as any,
        );

        revalidatePath('/dashboard/team/team-chat');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/* ─────────────────────────────────── MESSAGES ───────────────────────────────────── */

export async function getChannelMessages(channelId: string): Promise<WithId<TeamMessage>[]> {
    const session = await getSession();
    if (!session?.user) return [];
    if (!ObjectId.isValid(channelId)) return [];

    const guard = await requirePermission('team_chat', 'view');
    if (!guard.ok) return [];

    try {
        const { db } = await connectToDatabase();
        const messages = await db
            .collection<TeamMessage>('team_messages')
            .find({ channelId: new ObjectId(channelId) })
            .sort({ createdAt: 1 })
            .limit(200)
            .toArray();

        // Mark as read by this user (fire-and-forget).
        const sessionUserId = new ObjectId(session.user._id);
        await db
            .collection('team_messages')
            .updateMany(
                { channelId: new ObjectId(channelId), readBy: { $ne: sessionUserId } } as any,
                { $addToSet: { readBy: sessionUserId } } as any,
            );

        return JSON.parse(JSON.stringify(messages));
    } catch (e) {
        console.error('[getChannelMessages] failed:', e);
        return [];
    }
}

export type OutgoingAttachment = {
    filename: string;
    contentType: string;
    /** Base64-encoded payload. The data-URL prefix (e.g. "data:image/png;base64,…") is stripped automatically. */
    base64: string;
};

async function storeAttachment(
    userId: ObjectId,
    attachment: OutgoingAttachment,
): Promise<{ fileId: string; url: string; type: 'image' | 'file'; name: string } | null> {
    const raw = (attachment.base64 || '').replace(/^data:[^;]+;base64,/, '').trim();
    if (!raw) return null;
    const buffer = Buffer.from(raw, 'base64');
    if (!buffer.byteLength) return null;
    if (buffer.byteLength > MAX_ATTACHMENT_BYTES) {
        throw new Error(`File too large (${buffer.byteLength} bytes). Max ${MAX_ATTACHMENT_BYTES}.`);
    }
    const { db } = await connectToDatabase();
    const fileId = randomUUID();
    await db.collection('sabflow_uploads').insertOne({
        fileId,
        userId,
        filename: attachment.filename || 'attachment',
        contentType: attachment.contentType || 'application/octet-stream',
        size: buffer.byteLength,
        data: buffer,
        source: 'team-chat',
        createdAt: new Date(),
    });
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    return {
        fileId,
        url: `${baseUrl}/api/sabflow/uploads/${fileId}`,
        type: (attachment.contentType || '').startsWith('image/') ? 'image' : 'file',
        name: attachment.filename || 'attachment',
    };
}

export async function sendTeamMessage(args: {
    channelId: string;
    content: string;
    attachments?: OutgoingAttachment[];
}): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied' };
    if (!ObjectId.isValid(args.channelId)) return { success: false, error: 'Invalid channel' };

    const guard = await requirePermission('team_chat', 'create');
    if (!guard.ok) return { success: false, error: guard.error };

    const content = (args.content || '').trim();
    const hasAttachments = Array.isArray(args.attachments) && args.attachments.length > 0;
    if (!content && !hasAttachments) return { success: false, error: 'Message is empty.' };

    try {
        const { db } = await connectToDatabase();
        const channelId = new ObjectId(args.channelId);
        const sessionUserId = new ObjectId(session.user._id);

        // Ensure the sender is a participant.
        const channel = await db.collection<TeamChannel>('team_channels').findOne({ _id: channelId });
        if (!channel) return { success: false, error: 'Channel not found.' };
        const isMember = channel.participants.some((p: any) => p.userId?.equals?.(sessionUserId));
        if (!isMember) return { success: false, error: 'You are not a member of this channel.' };

        let storedAttachments: { type: 'image' | 'file'; url: string; name: string }[] = [];
        if (hasAttachments) {
            for (const a of args.attachments!) {
                const stored = await storeAttachment(sessionUserId, a);
                if (stored) storedAttachments.push({ type: stored.type, url: stored.url, name: stored.name });
            }
        }

        const newMessage: any = {
            channelId,
            senderId: sessionUserId,
            content,
            attachments: storedAttachments.length ? storedAttachments : undefined,
            readBy: [sessionUserId],
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        await db.collection('team_messages').insertOne(newMessage);

        const preview = content.substring(0, 100) || (storedAttachments[0]?.name || 'Attachment');
        await db.collection('team_channels').updateOne(
            { _id: channelId },
            {
                $set: {
                    updatedAt: new Date(),
                    lastMessage: {
                        content: preview,
                        senderId: sessionUserId,
                        createdAt: new Date(),
                    },
                },
            },
        );

        // Notify other participants (so NotificationPopover shows it).
        const otherIds = channel.participants
            .map((p: any) => p.userId)
            .filter((id: ObjectId) => !id.equals(sessionUserId));
        await notifyManyTeamMembers(otherIds, {
            message: `${session.user.name}${channel.type === 'group' ? ` (#${channel.name})` : ''}: ${preview}`,
            link: '/dashboard/team/team-chat',
            eventType: 'CHAT_MESSAGE',
        });

        revalidatePath('/dashboard/team/team-chat');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}
