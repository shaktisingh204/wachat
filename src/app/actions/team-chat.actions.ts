'use server';

import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import type {
    TeamChannel,
    TeamMessage,
    TeamMessageReaction,
    TeamMessagePin,
    TeamMessageBookmark,
    TeamPresence,
    TeamHuddle,
} from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { requirePermission } from '@/lib/rbac-server';
import { notifyManyTeamMembers } from '@/lib/team-notifications';
import type {
    TeamThreadView,
    PinnedMessageView,
    BookmarkView,
    PresenceStatus,
    PresenceView,
    HuddleView,
} from './team-chat.actions.types';

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB

type TeamChannelView = Omit<WithId<TeamChannel>, '_id' | 'participants' | 'lastMessage' | 'createdAt' | 'updatedAt'> & {
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
                link: '/dashboard/crm/team/team-chat',
                eventType: 'CHAT_GROUP_CREATED',
            },
        );

        revalidatePath('/dashboard/crm/team/team-chat');
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

        revalidatePath('/dashboard/crm/team/team-chat');
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

type OutgoingAttachment = {
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
        const notificationMessage = `${session.user.name}${channel.type === 'group' ? ` (#${channel.name})` : ''}: ${preview}`;
        await notifyManyTeamMembers(otherIds, {
            message: notificationMessage,
            link: '/dashboard/crm/team/team-chat',
            eventType: 'CHAT_MESSAGE',
        });

        import('@/lib/integrations/slack').then(({ sendSlackNotification }) => {
            void sendSlackNotification(notificationMessage).catch(() => {});
        }).catch(() => {});

        revalidatePath('/dashboard/crm/team/team-chat');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/* ════════════════════════════════════════════════════════════════════
 * SabCliq extensions
 * ──────────────────────────────────────────────────────────────────
 * Reactions, threads, pins, bookmarks, presence, and huddles are
 * implemented directly against Mongo for now. The matching Rust
 * crates exist (`rust/crates/sabcliq-*`) and TS clients live in
 * `@/lib/rust-client/sabcliq-*`, but they aren't wired into the
 * api gateway yet — switch the implementations below when they are.
 * ═══════════════════════════════════════════════════════════════════ */

/* ─── Common helpers ─────────────────────────────────────────────── */

async function assertChannelMembership(
    channelId: string,
): Promise<
    | { ok: true; channel: WithId<TeamChannel>; userId: ObjectId; sessionUserName: string }
    | { ok: false; error: string }
> {
    const session = await getSession();
    if (!session?.user) return { ok: false, error: 'Authentication required.' };
    if (!ObjectId.isValid(channelId)) return { ok: false, error: 'Invalid channel.' };
    const guard = await requirePermission('team_chat', 'view');
    if (!guard.ok) return { ok: false, error: guard.error };

    const { db } = await connectToDatabase();
    const channel = await db
        .collection<TeamChannel>('team_channels')
        .findOne({ _id: new ObjectId(channelId) });
    if (!channel) return { ok: false, error: 'Channel not found.' };
    const userId = new ObjectId(session.user._id);
    const isMember = channel.participants.some((p: any) =>
        p.userId?.equals?.(userId),
    );
    if (!isMember) return { ok: false, error: 'Not a member of this channel.' };
    return {
        ok: true,
        channel: channel as WithId<TeamChannel>,
        userId,
        sessionUserName: session.user.name || session.user.email || 'Someone',
    };
}

async function assertMessageMembership(
    messageId: string,
): Promise<
    | { ok: true; message: WithId<TeamMessage>; channel: WithId<TeamChannel>; userId: ObjectId; sessionUserName: string }
    | { ok: false; error: string }
> {
    const session = await getSession();
    if (!session?.user) return { ok: false, error: 'Authentication required.' };
    if (!ObjectId.isValid(messageId)) return { ok: false, error: 'Invalid message.' };
    const { db } = await connectToDatabase();
    const message = await db
        .collection<TeamMessage>('team_messages')
        .findOne({ _id: new ObjectId(messageId) });
    if (!message) return { ok: false, error: 'Message not found.' };
    const channel = await db
        .collection<TeamChannel>('team_channels')
        .findOne({ _id: message.channelId });
    if (!channel) return { ok: false, error: 'Channel not found.' };
    const userId = new ObjectId(session.user._id);
    const isMember = channel.participants.some((p: any) =>
        p.userId?.equals?.(userId),
    );
    if (!isMember) return { ok: false, error: 'Not a member of this channel.' };
    return {
        ok: true,
        message: message as WithId<TeamMessage>,
        channel: channel as WithId<TeamChannel>,
        userId,
        sessionUserName: session.user.name || session.user.email || 'Someone',
    };
}

async function recomputeReactionSummary(
    messageId: ObjectId,
): Promise<void> {
    const { db } = await connectToDatabase();
    const rows = await db
        .collection<TeamMessageReaction>('team_message_reactions')
        .aggregate([
            { $match: { messageId } },
            {
                $group: {
                    _id: '$emoji',
                    count: { $sum: 1 },
                    userIds: { $addToSet: '$userId' },
                },
            },
            { $project: { _id: 0, emoji: '$_id', count: 1, userIds: 1 } },
            { $sort: { count: -1, emoji: 1 } },
        ])
        .toArray();
    await db
        .collection('team_messages')
        .updateOne({ _id: messageId }, { $set: { reactions: rows } });
}

function serializeObjectIdsDeep<T>(value: T): T {
    return JSON.parse(JSON.stringify(value));
}

/* ─── Reactions ──────────────────────────────────────────────────── */

export async function addReactionToTeamMessage(
    messageId: string,
    emoji: string,
): Promise<{ success: boolean; error?: string }> {
    const ctx = await assertMessageMembership(messageId);
    if (!ctx.ok) return { success: false, error: ctx.error };
    const trimmed = (emoji || '').trim();
    if (!trimmed) return { success: false, error: 'Emoji required.' };

    try {
        const { db } = await connectToDatabase();
        await db.collection('team_message_reactions').updateOne(
            {
                messageId: ctx.message._id,
                userId: ctx.userId,
                emoji: trimmed,
            },
            {
                $setOnInsert: {
                    messageId: ctx.message._id,
                    channelId: ctx.channel._id,
                    userId: ctx.userId,
                    emoji: trimmed,
                    createdAt: new Date(),
                },
            },
            { upsert: true },
        );
        await recomputeReactionSummary(ctx.message._id);
        revalidatePath('/dashboard/team/team-chat');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function removeReactionFromTeamMessage(
    messageId: string,
    emoji: string,
): Promise<{ success: boolean; error?: string }> {
    const ctx = await assertMessageMembership(messageId);
    if (!ctx.ok) return { success: false, error: ctx.error };
    const trimmed = (emoji || '').trim();
    if (!trimmed) return { success: false, error: 'Emoji required.' };

    try {
        const { db } = await connectToDatabase();
        await db.collection('team_message_reactions').deleteOne({
            messageId: ctx.message._id,
            userId: ctx.userId,
            emoji: trimmed,
        });
        await recomputeReactionSummary(ctx.message._id);
        revalidatePath('/dashboard/team/team-chat');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/* ─── Threads ────────────────────────────────────────────────────── */

export async function getMessageThread(
    rootMessageId: string,
): Promise<TeamThreadView | null> {
    const ctx = await assertMessageMembership(rootMessageId);
    if (!ctx.ok) return null;
    try {
        const { db } = await connectToDatabase();
        const replies = await db
            .collection<TeamMessage>('team_messages')
            .find({ threadRootId: ctx.message._id })
            .sort({ createdAt: 1 })
            .limit(500)
            .toArray();
        return serializeObjectIdsDeep({
            root: ctx.message,
            replies,
        });
    } catch (e) {
        console.error('[getMessageThread] failed:', e);
        return null;
    }
}

export async function sendThreadReply(args: {
    rootMessageId: string;
    channelId: string;
    body: string;
    attachmentIds?: string[];
}): Promise<{ success: boolean; error?: string }> {
    const ctx = await assertMessageMembership(args.rootMessageId);
    if (!ctx.ok) return { success: false, error: ctx.error };
    if (!ObjectId.isValid(args.channelId) || !ctx.channel._id.equals(new ObjectId(args.channelId))) {
        return { success: false, error: 'Channel does not match the thread root.' };
    }
    const guard = await requirePermission('team_chat', 'create');
    if (!guard.ok) return { success: false, error: guard.error };
    const body = (args.body || '').trim();
    if (!body && !(args.attachmentIds && args.attachmentIds.length)) {
        return { success: false, error: 'Reply is empty.' };
    }

    try {
        const { db } = await connectToDatabase();
        const now = new Date();
        // Resolve SabFiles attachment ids → stored attachment shape.
        const attachments: WithId<TeamMessage>['attachments'] = [];
        if (args.attachmentIds && args.attachmentIds.length) {
            const ids = args.attachmentIds.filter((id) => !!id);
            // SabFiles ids may be uuid strings — fall back to a generic name when not in mongo.
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
            for (const id of ids) {
                attachments.push({
                    type: 'file',
                    url: `${baseUrl}/api/sabfiles/${id}`,
                    name: id,
                });
            }
        }
        const newMessage: any = {
            channelId: ctx.channel._id,
            senderId: ctx.userId,
            content: body,
            attachments: attachments.length ? attachments : undefined,
            threadRootId: ctx.message._id,
            readBy: [ctx.userId],
            createdAt: now,
            updatedAt: now,
        };
        await db.collection('team_messages').insertOne(newMessage);
        await db.collection('team_messages').updateOne(
            { _id: ctx.message._id },
            {
                $inc: { replyCount: 1 },
                $set: { lastReplyAt: now, updatedAt: now },
            },
        );
        revalidatePath('/dashboard/team/team-chat');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/* ─── Pins ───────────────────────────────────────────────────────── */

export async function pinTeamMessage(
    messageId: string,
): Promise<{ success: boolean; error?: string }> {
    const ctx = await assertMessageMembership(messageId);
    if (!ctx.ok) return { success: false, error: ctx.error };
    const guard = await requirePermission('team_chat', 'edit');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const { db } = await connectToDatabase();
        const now = new Date();
        await db.collection<TeamMessagePin>('team_message_pins').updateOne(
            { messageId: ctx.message._id },
            {
                $setOnInsert: {
                    channelId: ctx.channel._id,
                    messageId: ctx.message._id,
                    pinnedBy: ctx.userId,
                    pinnedAt: now,
                },
            },
            { upsert: true },
        );
        await db
            .collection('team_messages')
            .updateOne({ _id: ctx.message._id }, { $set: { pinnedAt: now } });
        revalidatePath('/dashboard/team/team-chat');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function unpinTeamMessage(
    messageId: string,
): Promise<{ success: boolean; error?: string }> {
    const ctx = await assertMessageMembership(messageId);
    if (!ctx.ok) return { success: false, error: ctx.error };
    const guard = await requirePermission('team_chat', 'edit');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const { db } = await connectToDatabase();
        await db
            .collection('team_message_pins')
            .deleteOne({ messageId: ctx.message._id });
        await db
            .collection('team_messages')
            .updateOne({ _id: ctx.message._id }, { $unset: { pinnedAt: '' } });
        revalidatePath('/dashboard/team/team-chat');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function listPinnedMessages(
    channelId: string,
): Promise<PinnedMessageView[]> {
    const ctx = await assertChannelMembership(channelId);
    if (!ctx.ok) return [];
    try {
        const { db } = await connectToDatabase();
        const pins = await db
            .collection<TeamMessagePin>('team_message_pins')
            .find({ channelId: ctx.channel._id })
            .sort({ pinnedAt: -1 })
            .limit(50)
            .toArray();
        if (!pins.length) return [];
        const msgIds = pins.map((p) => p.messageId);
        const messages = await db
            .collection<TeamMessage>('team_messages')
            .find({ _id: { $in: msgIds } })
            .toArray();
        const byId = new Map(messages.map((m) => [m._id.toString(), m]));
        const out: PinnedMessageView[] = [];
        for (const p of pins) {
            const m = byId.get(p.messageId.toString());
            if (!m) continue;
            out.push({
                ...(m as any),
                pinnedAt: p.pinnedAt.toISOString?.() ?? String(p.pinnedAt),
                pinnedBy: p.pinnedBy.toString(),
            } as PinnedMessageView);
        }
        return serializeObjectIdsDeep(out);
    } catch (e) {
        console.error('[listPinnedMessages] failed:', e);
        return [];
    }
}

/* ─── Bookmarks ──────────────────────────────────────────────────── */

export async function bookmarkTeamMessage(
    messageId: string,
): Promise<{ success: boolean; error?: string }> {
    const ctx = await assertMessageMembership(messageId);
    if (!ctx.ok) return { success: false, error: ctx.error };

    try {
        const { db } = await connectToDatabase();
        await db.collection<TeamMessageBookmark>('team_message_bookmarks').updateOne(
            { userId: ctx.userId, messageId: ctx.message._id },
            {
                $setOnInsert: {
                    userId: ctx.userId,
                    channelId: ctx.channel._id,
                    messageId: ctx.message._id,
                    savedAt: new Date(),
                },
            },
            { upsert: true },
        );
        revalidatePath('/dashboard/team/team-chat');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function unbookmarkTeamMessage(
    messageId: string,
): Promise<{ success: boolean; error?: string }> {
    const ctx = await assertMessageMembership(messageId);
    if (!ctx.ok) return { success: false, error: ctx.error };

    try {
        const { db } = await connectToDatabase();
        await db
            .collection('team_message_bookmarks')
            .deleteOne({ userId: ctx.userId, messageId: ctx.message._id });
        revalidatePath('/dashboard/team/team-chat');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function listMyBookmarks(): Promise<BookmarkView[]> {
    const session = await getSession();
    if (!session?.user) return [];
    const guard = await requirePermission('team_chat', 'view');
    if (!guard.ok) return [];

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);
        const bookmarks = await db
            .collection<TeamMessageBookmark>('team_message_bookmarks')
            .find({ userId })
            .sort({ savedAt: -1 })
            .limit(200)
            .toArray();
        if (!bookmarks.length) return [];
        const msgIds = bookmarks.map((b) => b.messageId);
        const messages = await db
            .collection<TeamMessage>('team_messages')
            .find({ _id: { $in: msgIds } })
            .toArray();
        const byId = new Map(messages.map((m) => [m._id.toString(), m]));
        const out: BookmarkView[] = bookmarks.map((b) => ({
            _id: b._id.toString(),
            channelId: b.channelId.toString(),
            messageId: b.messageId.toString(),
            savedAt: b.savedAt.toISOString?.() ?? String(b.savedAt),
            message: byId.get(b.messageId.toString()) as WithId<TeamMessage> | undefined,
        }));
        return serializeObjectIdsDeep(out);
    } catch (e) {
        console.error('[listMyBookmarks] failed:', e);
        return [];
    }
}

/* ─── Presence ───────────────────────────────────────────────────── */

export async function setTeamPresence(
    status: PresenceStatus,
    statusText?: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Authentication required.' };
    const valid: PresenceStatus[] = ['online', 'away', 'dnd', 'offline'];
    if (!valid.includes(status)) return { success: false, error: 'Invalid status.' };

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);
        const now = new Date();
        await db.collection<TeamPresence>('team_presence').updateOne(
            { userId },
            {
                $set: {
                    status,
                    statusText: (statusText || '').slice(0, 120) || undefined,
                    lastActiveAt: now,
                    updatedAt: now,
                },
                $setOnInsert: { userId },
            },
            { upsert: true },
        );
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function getTeamPresenceMap(
    userIds: string[],
): Promise<Record<string, PresenceView>> {
    const session = await getSession();
    if (!session?.user) return {};
    const valid = (userIds || []).filter((id) => id && ObjectId.isValid(id));
    if (!valid.length) return {};

    try {
        const { db } = await connectToDatabase();
        const ids = valid.map((id) => new ObjectId(id));
        const rows = await db
            .collection<TeamPresence>('team_presence')
            .find({ userId: { $in: ids } })
            .toArray();
        const out: Record<string, PresenceView> = {};
        for (const r of rows) {
            out[r.userId.toString()] = {
                userId: r.userId.toString(),
                status: r.status,
                statusText: r.statusText,
                lastActiveAt:
                    r.lastActiveAt instanceof Date
                        ? r.lastActiveAt.toISOString()
                        : String(r.lastActiveAt),
            };
        }
        // Default missing users to offline.
        for (const id of valid) {
            if (!out[id]) {
                out[id] = {
                    userId: id,
                    status: 'offline',
                    lastActiveAt: new Date(0).toISOString(),
                };
            }
        }
        return out;
    } catch (e) {
        console.error('[getTeamPresenceMap] failed:', e);
        return {};
    }
}

/* ─── Huddles ────────────────────────────────────────────────────── */

function serializeHuddle(raw: any): HuddleView {
    return {
        _id: raw._id.toString(),
        channelId: raw.channelId.toString(),
        startedBy: raw.startedBy.toString(),
        status: raw.status,
        participantIds: (raw.participantIds || []).map((id: ObjectId) =>
            id.toString(),
        ),
        startedAt:
            raw.startedAt instanceof Date
                ? raw.startedAt.toISOString()
                : String(raw.startedAt),
        endedAt: raw.endedAt
            ? raw.endedAt instanceof Date
                ? raw.endedAt.toISOString()
                : String(raw.endedAt)
            : undefined,
    };
}

export async function startTeamHuddle(
    channelId: string,
): Promise<{ success: boolean; error?: string; huddle?: HuddleView }> {
    const ctx = await assertChannelMembership(channelId);
    if (!ctx.ok) return { success: false, error: ctx.error };

    try {
        const { db } = await connectToDatabase();
        // Reuse existing active huddle if there is one.
        const existing = await db
            .collection<TeamHuddle>('team_huddles')
            .findOne({ channelId: ctx.channel._id, status: 'active' });
        if (existing) {
            await db.collection('team_huddles').updateOne(
                { _id: existing._id },
                {
                    $addToSet: { participantIds: ctx.userId },
                    $set: { updatedAt: new Date() },
                },
            );
            const refreshed = await db
                .collection('team_huddles')
                .findOne({ _id: existing._id });
            return { success: true, huddle: serializeHuddle(refreshed) };
        }
        const now = new Date();
        const doc: any = {
            channelId: ctx.channel._id,
            startedBy: ctx.userId,
            status: 'active',
            participantIds: [ctx.userId],
            startedAt: now,
            updatedAt: now,
        };
        const result = await db.collection('team_huddles').insertOne(doc);
        revalidatePath('/dashboard/team/team-chat');
        return {
            success: true,
            huddle: serializeHuddle({ ...doc, _id: result.insertedId }),
        };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function joinTeamHuddle(
    huddleId: string,
): Promise<{ success: boolean; error?: string; huddle?: HuddleView }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Authentication required.' };
    if (!ObjectId.isValid(huddleId)) return { success: false, error: 'Invalid huddle.' };

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);
        const huddle = await db
            .collection<TeamHuddle>('team_huddles')
            .findOne({ _id: new ObjectId(huddleId) });
        if (!huddle) return { success: false, error: 'Huddle not found.' };
        if (huddle.status !== 'active') {
            return { success: false, error: 'Huddle is no longer active.' };
        }
        // Verify caller is a channel member.
        const channel = await db
            .collection<TeamChannel>('team_channels')
            .findOne({ _id: huddle.channelId });
        const isMember = channel?.participants.some((p: any) =>
            p.userId?.equals?.(userId),
        );
        if (!isMember) return { success: false, error: 'Not a member of this channel.' };

        await db.collection('team_huddles').updateOne(
            { _id: huddle._id },
            {
                $addToSet: { participantIds: userId },
                $set: { updatedAt: new Date() },
            },
        );
        const refreshed = await db
            .collection('team_huddles')
            .findOne({ _id: huddle._id });
        return { success: true, huddle: serializeHuddle(refreshed) };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function endTeamHuddle(
    huddleId: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Authentication required.' };
    if (!ObjectId.isValid(huddleId)) return { success: false, error: 'Invalid huddle.' };

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('team_huddles').findOneAndUpdate(
            { _id: new ObjectId(huddleId), status: 'active' },
            { $set: { status: 'ended', endedAt: new Date(), updatedAt: new Date() } },
        );
        if (!result) return { success: false, error: 'Huddle not found or already ended.' };
        revalidatePath('/dashboard/team/team-chat');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function getActiveHuddle(
    channelId: string,
): Promise<HuddleView | null> {
    const ctx = await assertChannelMembership(channelId);
    if (!ctx.ok) return null;
    try {
        const { db } = await connectToDatabase();
        const huddle = await db
            .collection<TeamHuddle>('team_huddles')
            .findOne({ channelId: ctx.channel._id, status: 'active' });
        return huddle ? serializeHuddle(huddle) : null;
    } catch (e) {
        console.error('[getActiveHuddle] failed:', e);
        return null;
    }
}

