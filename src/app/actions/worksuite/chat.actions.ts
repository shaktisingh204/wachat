'use server';

import { ObjectId } from 'mongodb';
import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';

import { connectToDatabase } from '@/lib/mongodb';
import {
  hrList,
  hrGetById,
  hrDelete,
  requireSession,
  serialize,
} from '@/lib/hr-crud';
import type {
  WsUserChat,
  WsUserchatFile,
  WsMentionUser,
  WsMentionResourceType,
  WsUserActivity,
  WsNotification,
  WsUserInvitation,
  WsUserInvitationStatus,
  WsConversationSummary,
} from '@/lib/worksuite/chat-types';

/**
 * Worksuite internal chat / mentions / activity / notifications / invitations.
 *
 * All actions are tenant-scoped via `userId = session.user._id`. DM queries
 * match on the tenant and on the (from_user_id, to_user_id) pair for the
 * logged-in user; mentions/notifications filter by `recipient_user_id`
 * / `mentioned_user_id` for the current user so it sees only its own inbox.
 */

type FormState = { message?: string; error?: string; id?: string };

const COLS = {
  chat: 'crm_user_chats',
  chatFile: 'crm_userchat_files',
  mention: 'crm_mention_users',
  activity: 'crm_user_activities',
  notification: 'crm_notifications',
  invitation: 'crm_user_invitations',
} as const;

/* ═══════════════════ Helpers ═══════════════════ */

function toObjectId(id: string): ObjectId {
  return new ObjectId(id);
}

function parseDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;
  }
  return undefined;
}

/* ═══════════════════ 1:1 Chat / Messages ═══════════════════ */

export async function sendMessage(
  toUserId: string,
  message: string,
  fileUrls: Array<{ filename: string; url: string; size: number; mime_type?: string }> = [],
): Promise<FormState> {
  const user = await requireSession();
  if (!user) return { error: 'Access denied' };
  const trimmed = (message || '').trim();
  if (!trimmed && fileUrls.length === 0) {
    return { error: 'Message or file is required' };
  }
  if (!toUserId) return { error: 'Recipient required' };

  const { db } = await connectToDatabase();
  const now = new Date();
  const chatDoc = {
    userId: toObjectId(user._id),
    from_user_id: user._id,
    to_user_id: toUserId,
    message: trimmed,
    is_read: false,
    group_id: null,
    createdAt: now,
    updatedAt: now,
  };
  const res = await db.collection(COLS.chat).insertOne(chatDoc);
  const chatId = res.insertedId.toString();

  if (fileUrls.length > 0) {
    await db.collection(COLS.chatFile).insertMany(
      fileUrls.map((f) => ({
        userId: toObjectId(user._id),
        chat_id: chatId,
        filename: f.filename,
        url: f.url,
        size: Number(f.size) || 0,
        mime_type: f.mime_type,
        createdAt: now,
      })),
    );
  }

  revalidatePath('/dashboard/crm/messages');
  revalidatePath(`/dashboard/crm/messages/${toUserId}`);
  return { message: 'Message sent', id: chatId };
}

export async function markChatAsRead(chatId: string) {
  const user = await requireSession();
  if (!user) return { success: false, error: 'Access denied' };
  if (!ObjectId.isValid(chatId)) return { success: false, error: 'Invalid id' };
  const { db } = await connectToDatabase();
  await db.collection(COLS.chat).updateOne(
    {
      _id: toObjectId(chatId),
      userId: toObjectId(user._id),
      to_user_id: user._id,
    },
    { $set: { is_read: true, updatedAt: new Date() } },
  );
  revalidatePath('/dashboard/crm/messages');
  return { success: true };
}

export async function markAllChatsRead(fromUserId: string) {
  const user = await requireSession();
  if (!user) return { success: false, error: 'Access denied' };
  const { db } = await connectToDatabase();
  await db.collection(COLS.chat).updateMany(
    {
      userId: toObjectId(user._id),
      from_user_id: fromUserId,
      to_user_id: user._id,
      is_read: false,
    },
    { $set: { is_read: true, updatedAt: new Date() } },
  );
  revalidatePath('/dashboard/crm/messages');
  revalidatePath(`/dashboard/crm/messages/${fromUserId}`);
  return { success: true };
}

export async function getConversationWith(
  peerUserId: string,
): Promise<(WsUserChat & { files?: WsUserchatFile[] })[]> {
  const user = await requireSession();
  if (!user) return [];
  const { db } = await connectToDatabase();
  const chats = await db
    .collection(COLS.chat)
    .find({
      userId: toObjectId(user._id),
      $or: [
        { from_user_id: user._id, to_user_id: peerUserId },
        { from_user_id: peerUserId, to_user_id: user._id },
      ],
    })
    .sort({ createdAt: 1 })
    .toArray();

  if (chats.length === 0) return [];

  const ids = chats.map((c) => String(c._id));
  const files = await db
    .collection(COLS.chatFile)
    .find({ userId: toObjectId(user._id), chat_id: { $in: ids } })
    .toArray();

  const filesByChat = new Map<string, WsUserchatFile[]>();
  for (const f of files) {
    const key = String(f.chat_id);
    const arr = filesByChat.get(key) || [];
    arr.push(serialize(f) as unknown as WsUserchatFile);
    filesByChat.set(key, arr);
  }

  return chats.map((c) => {
    const ser = serialize(c) as unknown as WsUserChat & { _id: string };
    return { ...ser, files: filesByChat.get(String(c._id)) || [] };
  });
}

export async function listConversations(): Promise<WsConversationSummary[]> {
  const user = await requireSession();
  if (!user) return [];
  const { db } = await connectToDatabase();

  const pipeline = [
    {
      $match: {
        userId: toObjectId(user._id),
        $or: [{ from_user_id: user._id }, { to_user_id: user._id }],
      },
    },
    {
      $addFields: {
        peer_user_id: {
          $cond: [
            { $eq: ['$from_user_id', user._id] },
            '$to_user_id',
            '$from_user_id',
          ],
        },
      },
    },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: '$peer_user_id',
        last_message: { $first: '$message' },
        last_message_at: { $first: '$createdAt' },
        last_from_user_id: { $first: '$from_user_id' },
        unread_count: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$to_user_id', user._id] },
                  { $eq: ['$is_read', false] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
    { $sort: { last_message_at: -1 } },
  ];

  const rows = await db.collection(COLS.chat).aggregate(pipeline).toArray();
  return rows.map((r) => ({
    peer_user_id: String(r._id),
    last_message: String(r.last_message || ''),
    last_message_at: r.last_message_at
      ? new Date(r.last_message_at).toISOString()
      : undefined,
    last_from_user_id: String(r.last_from_user_id),
    unread_count: Number(r.unread_count || 0),
  }));
}

export async function getChatById(id: string) {
  return hrGetById<WsUserChat>(COLS.chat, id);
}

export async function deleteChat(id: string) {
  const user = await requireSession();
  if (!user) return { success: false, error: 'Access denied' };
  if (!ObjectId.isValid(id)) return { success: false, error: 'Invalid id' };
  const { db } = await connectToDatabase();
  await db
    .collection(COLS.chatFile)
    .deleteMany({ userId: toObjectId(user._id), chat_id: id });
  const r = await hrDelete(COLS.chat, id);
  revalidatePath('/dashboard/crm/messages');
  return r;
}

/* ═══════════════════ Chat files ═══════════════════ */

export async function getChatFiles(chatId: string) {
  const user = await requireSession();
  if (!user) return [];
  const { db } = await connectToDatabase();
  const docs = await db
    .collection(COLS.chatFile)
    .find({ userId: toObjectId(user._id), chat_id: chatId })
    .toArray();
  return serialize(docs) as unknown as WsUserchatFile[];
}

export async function deleteChatFile(id: string) {
  const r = await hrDelete(COLS.chatFile, id);
  revalidatePath('/dashboard/crm/messages');
  return r;
}

/* ═══════════════════ Mentions ═══════════════════ */

export async function notifyMention(
  resourceType: WsMentionResourceType,
  resourceId: string,
  mentionedUserId: string,
  body?: string,
): Promise<FormState> {
  const user = await requireSession();
  if (!user) return { error: 'Access denied' };
  if (!mentionedUserId) return { error: 'Mentioned user required' };
  const { db } = await connectToDatabase();
  const now = new Date();
  const res = await db.collection(COLS.mention).insertOne({
    userId: toObjectId(user._id),
    resource_type: resourceType,
    resource_id: resourceId,
    mentioned_user_id: mentionedUserId,
    mentioner_user_id: user._id,
    body,
    read_at: null,
    createdAt: now,
    updatedAt: now,
  });
  revalidatePath('/dashboard/crm/mentions');
  return { message: 'Mention sent', id: res.insertedId.toString() };
}

export async function getMentionsForMe(opts?: { unreadOnly?: boolean }) {
  const user = await requireSession();
  if (!user) return [];
  const { db } = await connectToDatabase();
  const filter: Record<string, unknown> = {
    userId: toObjectId(user._id),
    mentioned_user_id: user._id,
  };
  if (opts?.unreadOnly) filter.read_at = null;
  const docs = await db
    .collection(COLS.mention)
    .find(filter)
    .sort({ createdAt: -1 })
    .toArray();
  return serialize(docs) as unknown as WsMentionUser[];
}

export async function markMentionRead(id: string) {
  const user = await requireSession();
  if (!user) return { success: false, error: 'Access denied' };
  if (!ObjectId.isValid(id)) return { success: false, error: 'Invalid id' };
  const { db } = await connectToDatabase();
  await db.collection(COLS.mention).updateOne(
    {
      _id: toObjectId(id),
      userId: toObjectId(user._id),
      mentioned_user_id: user._id,
    },
    { $set: { read_at: new Date(), updatedAt: new Date() } },
  );
  revalidatePath('/dashboard/crm/mentions');
  return { success: true };
}

export async function markAllMentionsRead() {
  const user = await requireSession();
  if (!user) return { success: false, error: 'Access denied' };
  const { db } = await connectToDatabase();
  const now = new Date();
  await db.collection(COLS.mention).updateMany(
    {
      userId: toObjectId(user._id),
      mentioned_user_id: user._id,
      read_at: null,
    },
    { $set: { read_at: now, updatedAt: now } },
  );
  revalidatePath('/dashboard/crm/mentions');
  return { success: true };
}

export async function getUnreadMentionCount(): Promise<number> {
  const user = await requireSession();
  if (!user) return 0;
  const { db } = await connectToDatabase();
  const n = await db.collection(COLS.mention).countDocuments({
    userId: toObjectId(user._id),
    mentioned_user_id: user._id,
    read_at: null,
  });
  return Number(n) || 0;
}

export async function deleteMention(id: string) {
  const r = await hrDelete(COLS.mention, id);
  revalidatePath('/dashboard/crm/mentions');
  return r;
}

/* ═══════════════════ User Activity log ═══════════════════ */

export async function logUserActivity(
  actorUserId: string,
  action: string,
  resourceType?: string,
  resourceId?: string,
  description?: string,
  metadata?: Record<string, unknown>,
  extras?: { ip_address?: string; user_agent?: string },
): Promise<FormState> {
  const user = await requireSession();
  if (!user) return { error: 'Access denied' };
  if (!action) return { error: 'Action required' };
  const { db } = await connectToDatabase();
  const now = new Date();
  const res = await db.collection(COLS.activity).insertOne({
    userId: toObjectId(user._id),
    actor_user_id: actorUserId || user._id,
    action,
    resource_type: resourceType,
    resource_id: resourceId,
    description,
    metadata: metadata || {},
    ip_address: extras?.ip_address,
    user_agent: extras?.user_agent,
    occurred_at: now,
    createdAt: now,
    updatedAt: now,
  });
  revalidatePath('/dashboard/crm/activity');
  return { message: 'Activity logged', id: res.insertedId.toString() };
}

export interface UserActivityFilter {
  actorUserId?: string;
  action?: string;
  resourceType?: string;
  from?: string | Date;
  to?: string | Date;
  limit?: number;
}

export async function getUserActivities(
  filter: UserActivityFilter = {},
): Promise<WsUserActivity[]> {
  const user = await requireSession();
  if (!user) return [];
  const { db } = await connectToDatabase();
  const q: Record<string, unknown> = { userId: toObjectId(user._id) };
  if (filter.actorUserId) q.actor_user_id = filter.actorUserId;
  if (filter.action) q.action = filter.action;
  if (filter.resourceType) q.resource_type = filter.resourceType;
  const from = parseDate(filter.from);
  const to = parseDate(filter.to);
  if (from || to) {
    q.occurred_at = {
      ...(from ? { $gte: from } : {}),
      ...(to ? { $lte: to } : {}),
    };
  }
  const docs = await db
    .collection(COLS.activity)
    .find(q)
    .sort({ occurred_at: -1 })
    .limit(Math.min(Math.max(filter.limit || 200, 1), 1000))
    .toArray();
  return serialize(docs) as unknown as WsUserActivity[];
}

export async function deleteUserActivity(id: string) {
  const r = await hrDelete(COLS.activity, id);
  revalidatePath('/dashboard/crm/activity');
  return r;
}

/* ═══════════════════ Notifications ═══════════════════ */

export interface NotifyPayload {
  type: string;
  title: string;
  body?: string;
  resourceType?: string;
  resourceId?: string;
}

export async function notify(
  recipientUserId: string,
  payload: NotifyPayload,
): Promise<FormState> {
  const user = await requireSession();
  if (!user) return { error: 'Access denied' };
  if (!recipientUserId) return { error: 'Recipient required' };
  if (!payload?.type || !payload?.title) return { error: 'Type and title required' };
  const { db } = await connectToDatabase();
  const now = new Date();
  const res = await db.collection(COLS.notification).insertOne({
    userId: toObjectId(user._id),
    recipient_user_id: recipientUserId,
    type: payload.type,
    title: payload.title,
    body: payload.body,
    resource_type: payload.resourceType,
    resource_id: payload.resourceId,
    read_at: null,
    createdAt: now,
    updatedAt: now,
  });
  revalidatePath('/dashboard/crm/notifications');
  return { message: 'Notification sent', id: res.insertedId.toString() };
}

export async function getMyNotifications(opts?: { unreadOnly?: boolean }) {
  const user = await requireSession();
  if (!user) return [];
  const { db } = await connectToDatabase();
  const filter: Record<string, unknown> = {
    userId: toObjectId(user._id),
    recipient_user_id: user._id,
  };
  if (opts?.unreadOnly) filter.read_at = null;
  const docs = await db
    .collection(COLS.notification)
    .find(filter)
    .sort({ createdAt: -1 })
    .toArray();
  return serialize(docs) as unknown as WsNotification[];
}

export async function markNotificationRead(id: string) {
  const user = await requireSession();
  if (!user) return { success: false, error: 'Access denied' };
  if (!ObjectId.isValid(id)) return { success: false, error: 'Invalid id' };
  const { db } = await connectToDatabase();
  await db.collection(COLS.notification).updateOne(
    {
      _id: toObjectId(id),
      userId: toObjectId(user._id),
      recipient_user_id: user._id,
    },
    { $set: { read_at: new Date(), updatedAt: new Date() } },
  );
  revalidatePath('/dashboard/crm/notifications');
  return { success: true };
}

export async function markAllNotificationsRead() {
  const user = await requireSession();
  if (!user) return { success: false, error: 'Access denied' };
  const { db } = await connectToDatabase();
  const now = new Date();
  await db.collection(COLS.notification).updateMany(
    {
      userId: toObjectId(user._id),
      recipient_user_id: user._id,
      read_at: null,
    },
    { $set: { read_at: now, updatedAt: now } },
  );
  revalidatePath('/dashboard/crm/notifications');
  return { success: true };
}

export async function getUnreadNotificationCount(): Promise<number> {
  const user = await requireSession();
  if (!user) return 0;
  const { db } = await connectToDatabase();
  const n = await db.collection(COLS.notification).countDocuments({
    userId: toObjectId(user._id),
    recipient_user_id: user._id,
    read_at: null,
  });
  return Number(n) || 0;
}

export async function deleteNotification(id: string) {
  const r = await hrDelete(COLS.notification, id);
  revalidatePath('/dashboard/crm/notifications');
  return r;
}

/* ═══════════════════ User Invitations ═══════════════════ */

function generateToken(): string {
  return randomBytes(24).toString('hex');
}

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

export async function sendUserInvitation(
  email: string,
  roleId?: string,
): Promise<FormState> {
  const user = await requireSession();
  if (!user) return { error: 'Access denied' };
  const normalized = (email || '').trim().toLowerCase();
  if (!normalized) return { error: 'Email is required' };
  const { db } = await connectToDatabase();
  const now = new Date();
  const token = generateToken();
  const res = await db.collection(COLS.invitation).insertOne({
    userId: toObjectId(user._id),
    email: normalized,
    role_id: roleId,
    invited_by_user_id: user._id,
    token,
    accepted_at: null,
    expires_at: daysFromNow(7),
    status: 'pending' as WsUserInvitationStatus,
    createdAt: now,
    updatedAt: now,
  });
  revalidatePath('/dashboard/crm/settings/invitations');
  return { message: 'Invitation sent', id: res.insertedId.toString() };
}

export async function listInvitations(status?: WsUserInvitationStatus) {
  if (status) {
    return hrList<WsUserInvitation>(COLS.invitation, {
      sortBy: { createdAt: -1 },
      extraFilter: { status },
    });
  }
  return hrList<WsUserInvitation>(COLS.invitation, { sortBy: { createdAt: -1 } });
}

export async function getInvitationById(id: string) {
  return hrGetById<WsUserInvitation>(COLS.invitation, id);
}

/**
 * Accept an invitation by token. This is intentionally NOT tenant-scoped on
 * lookup (the recipient is outside the owning tenant). Instead we look up
 * by the opaque token, validate expiry, then mark it accepted.
 */
export async function acceptInvitation(
  token: string,
): Promise<FormState> {
  if (!token) return { error: 'Token required' };
  const { db } = await connectToDatabase();
  const inv = await db.collection(COLS.invitation).findOne({ token });
  if (!inv) return { error: 'Invitation not found' };
  if (inv.status !== 'pending') {
    return { error: `Invitation is ${inv.status}` };
  }
  const expires = parseDate(inv.expires_at);
  if (expires && expires < new Date()) {
    await db
      .collection(COLS.invitation)
      .updateOne(
        { _id: inv._id },
        { $set: { status: 'expired', updatedAt: new Date() } },
      );
    return { error: 'Invitation expired' };
  }
  const now = new Date();
  await db.collection(COLS.invitation).updateOne(
    { _id: inv._id },
    {
      $set: {
        status: 'accepted' as WsUserInvitationStatus,
        accepted_at: now,
        updatedAt: now,
      },
    },
  );
  revalidatePath('/dashboard/crm/settings/invitations');
  return { message: 'Invitation accepted', id: String(inv._id) };
}

export async function revokeInvitation(id: string) {
  const user = await requireSession();
  if (!user) return { success: false, error: 'Access denied' };
  if (!ObjectId.isValid(id)) return { success: false, error: 'Invalid id' };
  const { db } = await connectToDatabase();
  await db.collection(COLS.invitation).updateOne(
    { _id: toObjectId(id), userId: toObjectId(user._id) },
    {
      $set: {
        status: 'revoked' as WsUserInvitationStatus,
        updatedAt: new Date(),
      },
    },
  );
  revalidatePath('/dashboard/crm/settings/invitations');
  return { success: true };
}

export async function deleteInvitation(id: string) {
  const r = await hrDelete(COLS.invitation, id);
  revalidatePath('/dashboard/crm/settings/invitations');
  return r;
}
