'use server';

import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { getErrorMessage } from '@/lib/utils';

/**
 * @-mention parser + notification fan-out.
 *
 * Token format produced by `<MentionTextarea>`:
 *   `@[Display Name](user:USER_ID)`
 *
 * Storage:
 *   mention_users   — per-mention audit row (one per mentioned user per entity)
 *   notifications   — generic in-app notification for the mentioned user
 *
 * Multi-tenant: notifications are scoped to the receiving userId; the
 * mention author (fromUserId) is recorded for the bell-popover display.
 */

type ParsedMention = {
  userId: string;
  name: string;
  position: number;
};

const MENTION_TOKEN_RE = /@\[([^\]]+)\]\(user:([a-zA-Z0-9_-]+)\)/g;

/** Pure helper — safe to call from anywhere. */
export async function parseMentionsServer(text: string): Promise<ParsedMention[]> {
  if (!text) return [];
  const out: ParsedMention[] = [];
  for (const match of text.matchAll(MENTION_TOKEN_RE)) {
    out.push({
      name: match[1],
      userId: match[2],
      position: match.index ?? 0,
    });
  }
  return out;
}

type MentionEntityType =
  | 'task_comment'
  | 'discussion_reply'
  | 'project_note'
  | 'ticket_reply'
  | 'lead_note'
  | 'deal_note'
  | 'generic';

export async function createMentionNotifications(
  entityType: MentionEntityType,
  entityId: string,
  mentions: ParsedMention[],
  fromUserId?: string,
): Promise<{ ok?: boolean; count?: number; error?: string }> {
  try {
    if (!Array.isArray(mentions) || mentions.length === 0) {
      return { ok: true, count: 0 };
    }
    const session = await getSession();
    const author = fromUserId || (session?.user?._id ? String(session.user._id) : null);
    if (!author) return { error: 'No author session available.' };

    const { db } = await connectToDatabase();
    const now = new Date();

    // Deduplicate by userId (a single comment shouldn't fan out twice).
    const unique = Array.from(
      new Map(mentions.filter((m) => ObjectId.isValid(m.userId)).map((m) => [m.userId, m])).values(),
    );
    if (unique.length === 0) return { ok: true, count: 0 };

    const authorObjId = ObjectId.isValid(author) ? new ObjectId(author) : null;

    const mentionRows = unique.map((m) => ({
      userId: new ObjectId(m.userId),
      name: m.name,
      entityType,
      entityId,
      fromUserId: authorObjId,
      createdAt: now,
      isRead: false,
    }));

    const notifRows = unique.map((m) => ({
      userId: new ObjectId(m.userId),
      message: `You were mentioned in a ${entityType.replace(/_/g, ' ')}`,
      link: deriveLink(entityType, entityId),
      isRead: false,
      createdAt: now,
      eventType: 'mention',
      sourceApp: 'crm' as const,
      fromUserId: authorObjId,
      meta: {
        entityType,
        entityId,
      },
    }));

    await Promise.all([
      db.collection('mention_users').insertMany(mentionRows),
      db.collection('notifications').insertMany(notifRows),
    ]);

    return { ok: true, count: unique.length };
  } catch (e: unknown) {
    return { error: getErrorMessage(e) };
  }
}

function deriveLink(entityType: MentionEntityType, entityId: string): string {
  switch (entityType) {
    case 'task_comment':
      return `/dashboard/crm/projects/tasks/${entityId}`;
    case 'discussion_reply':
      return `/dashboard/crm/discussions/${entityId}`;
    case 'project_note':
      return `/dashboard/crm/projects/${entityId}`;
    case 'ticket_reply':
      return `/dashboard/sabdesk/${entityId}`;
    case 'lead_note':
      return `/dashboard/crm/sales-crm/all-leads/${entityId}`;
    case 'deal_note':
      return `/dashboard/crm/deals/${entityId}`;
    default:
      return `/dashboard/crm`;
  }
}

/**
 * Convenience wrapper used by comment/reply save flows: extracts mentions
 * from rich-text body and dispatches notifications. Errors are swallowed
 * (logged) so a notification failure never blocks the comment itself.
 */
export async function processMentionsFromBody(
  entityType: MentionEntityType,
  entityId: string,
  body: string,
): Promise<void> {
  try {
    const parsed = await parseMentionsServer(body);
    if (parsed.length === 0) return;
    const res = await createMentionNotifications(entityType, entityId, parsed);
    if (res.error) console.warn('[mentions] notification dispatch failed:', res.error);
  } catch (e: unknown) {
    console.warn('[mentions] processMentionsFromBody error:', getErrorMessage(e));
  }
}

/** Fetch unread mention notifications for the bell popover. */
export async function getMyMentionNotifications(limit = 20): Promise<
  Array<{
    _id: string;
    message: string;
    link: string;
    isRead: boolean;
    createdAt: string;
    entityType?: string;
    entityId?: string;
  }>
> {
  const session = await getSession();
  if (!session?.user?._id) return [];
  const { db } = await connectToDatabase();
  const rows = await db
    .collection('notifications')
    .find({
      userId: new ObjectId(String(session.user._id)),
      eventType: 'mention',
    })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
  return rows.map((r) => ({
    _id: String(r._id),
    message: (r.message as string) ?? '',
    link: (r.link as string) ?? '/dashboard/crm',
    isRead: Boolean(r.isRead),
    createdAt:
      r.createdAt instanceof Date
        ? r.createdAt.toISOString()
        : new Date(r.createdAt as string).toISOString(),
    entityType: ((r.meta as Record<string, unknown> | undefined)?.entityType as string) || undefined,
    entityId: ((r.meta as Record<string, unknown> | undefined)?.entityId as string) || undefined,
  }));
}
