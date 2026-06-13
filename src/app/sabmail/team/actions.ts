'use server';

import { ObjectId, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { SABMAIL_COLLECTIONS } from '@/lib/sabmail/db/collections';
import { getSabmailWorkspaceId, getActiveSabmailProject } from '@/lib/sabmail/workspace';
import { getErrorMessage } from '@/lib/utils';

/* ──────────────────────────────────────────────────────────────────────
 * SabMail — Team / shared inbox (collaboration & triage layer).
 *
 * A lightweight conversation + internal-comment store that lets a team
 * triage incoming mail together: assign an owner, move through a status
 * lifecycle (open → snoozed → closed), and leave INTERNAL notes that are
 * never sent to the customer. This is a collaboration layer over Mongo —
 * it is NOT yet bound to live IMAP threads (that linkage lands in a later
 * phase); for now conversations are created/triaged manually.
 *
 * Every action is tenant-scoped by the active SabMail `workspaceId` and
 * each query is filtered by `{ workspaceId }`. Uses the reserved
 * `conversations` + `comments` collection names — no schema change to the
 * shared collections module.
 * ──────────────────────────────────────────────────────────────────── */

export type SabmailConversationStatus = 'open' | 'snoozed' | 'closed';

/** The stored shape of a shared-inbox conversation (one Mongo doc). */
export interface SabmailConversationDoc {
  workspaceId: string;
  subject: string;
  fromEmail: string;
  status: SabmailConversationStatus;
  assigneeId?: string;
  assigneeName?: string;
  slaDueAt?: Date;
  lastMessageAt: Date;
  createdAt: Date;
}

/** The stored shape of an internal comment (never sent to the customer). */
export interface SabmailCommentDoc {
  workspaceId: string;
  conversationId: string;
  authorName: string;
  body: string;
  createdAt: Date;
}

/** Safe (serialisable) conversation projection sent to the client. */
export interface SabmailConversationRow {
  id: string;
  subject: string;
  fromEmail: string;
  status: SabmailConversationStatus;
  assigneeId: string | null;
  assigneeName: string | null;
  slaDueAt: string | null;
  lastMessageAt: string;
  createdAt: string;
}

/** Safe (serialisable) comment projection sent to the client. */
export interface SabmailCommentRow {
  id: string;
  conversationId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

/** A workspace member that can be assigned a conversation. */
export interface SabmailTeamMember {
  id: string;
  name: string;
  email: string;
}

export type SabmailConversationFilter = 'all' | SabmailConversationStatus;

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };
type VoidResult = { ok: true } | { ok: false; error: string };

const STATUS_SET: SabmailConversationStatus[] = ['open', 'snoozed', 'closed'];

function toISO(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function toConversationRow(doc: WithId<SabmailConversationDoc>): SabmailConversationRow {
  return {
    id: String(doc._id),
    subject: doc.subject || '(no subject)',
    fromEmail: doc.fromEmail || '',
    status: STATUS_SET.includes(doc.status) ? doc.status : 'open',
    assigneeId: doc.assigneeId ?? null,
    assigneeName: doc.assigneeName ?? null,
    slaDueAt: doc.slaDueAt ? toISO(doc.slaDueAt) : null,
    lastMessageAt: toISO(doc.lastMessageAt ?? doc.createdAt),
    createdAt: toISO(doc.createdAt),
  };
}

function toCommentRow(doc: WithId<SabmailCommentDoc>): SabmailCommentRow {
  return {
    id: String(doc._id),
    conversationId: doc.conversationId,
    authorName: doc.authorName || 'Teammate',
    body: doc.body || '',
    createdAt: toISO(doc.createdAt),
  };
}

/* ── workspace members (best-effort, for the assignee picker) ─────────── */

/**
 * The workspace members eligible to own a conversation — the project owner
 * plus its agents. Best-effort: returns `[]` if the project can't be read,
 * so the UI falls back to a free-text / "me" assignee.
 */
export async function listTeamMembers(): Promise<SabmailTeamMember[]> {
  try {
    const project = await getActiveSabmailProject();
    if (!project) return [];

    const members: SabmailTeamMember[] = [];
    const seen = new Set<string>();

    const agents = Array.isArray((project as { agents?: unknown }).agents)
      ? ((project as { agents: Array<Record<string, unknown>> }).agents)
      : [];
    for (const agent of agents) {
      const id = String(agent.userId ?? '');
      if (!id || seen.has(id)) continue;
      seen.add(id);
      members.push({
        id,
        name: String(agent.name ?? agent.email ?? 'Teammate'),
        email: String(agent.email ?? ''),
      });
    }

    return members;
  } catch {
    return [];
  }
}

/* ── conversation actions ────────────────────────────────────────────── */

/** List conversations for the active workspace (newest activity first). */
export async function listTeamConversations(
  filter: SabmailConversationFilter = 'all',
): Promise<SabmailConversationRow[]> {
  try {
    const workspaceId = await getSabmailWorkspaceId();
    if (!workspaceId) return [];

    const query: Record<string, unknown> = { workspaceId };
    if (filter !== 'all' && STATUS_SET.includes(filter)) {
      query.status = filter;
    }

    const { db } = await connectToDatabase();
    const docs = await db
      .collection(SABMAIL_COLLECTIONS.conversations)
      .find(query)
      .sort({ lastMessageAt: -1 })
      .limit(200)
      .toArray();

    return docs.map((d) => toConversationRow(d as WithId<SabmailConversationDoc>));
  } catch (err) {
    console.error('[sabmail] listTeamConversations failed:', err);
    return [];
  }
}

/** Create a new conversation to triage in the shared inbox. */
export async function createTeamConversation(input: {
  subject: string;
  fromEmail: string;
}): Promise<Result<{ conversation: SabmailConversationRow }>> {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };

  try {
    const subject = input.subject?.trim();
    if (!subject) return { ok: false, error: 'Add a subject for the conversation.' };

    const fromEmail = input.fromEmail?.trim().toLowerCase();
    if (!fromEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEmail)) {
      return { ok: false, error: 'Enter a valid customer email address.' };
    }

    const now = new Date();
    const doc: SabmailConversationDoc = {
      workspaceId,
      subject,
      fromEmail,
      status: 'open',
      lastMessageAt: now,
      createdAt: now,
    };

    const { db } = await connectToDatabase();
    const res = await db
      .collection(SABMAIL_COLLECTIONS.conversations)
      .insertOne(doc as never);

    return {
      ok: true,
      conversation: toConversationRow({ ...doc, _id: res.insertedId } as WithId<SabmailConversationDoc>),
    };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

/** Assign (or unassign) a conversation to a teammate. */
export async function assignConversation(
  id: string,
  assignee: { assigneeId?: string | null; assigneeName?: string | null },
): Promise<Result<{ conversation: SabmailConversationRow }>> {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };

  try {
    if (!id || !ObjectId.isValid(id)) {
      return { ok: false, error: 'Invalid conversation id.' };
    }

    const name = assignee.assigneeName?.trim() || '';
    const memberId = assignee.assigneeId?.trim() || '';

    const set: Record<string, unknown> = {};
    const unset: Record<string, unknown> = {};
    if (name) {
      set.assigneeName = name;
      if (memberId) set.assigneeId = memberId;
      else unset.assigneeId = '';
    } else {
      unset.assigneeName = '';
      unset.assigneeId = '';
    }

    const update: Record<string, unknown> = {};
    if (Object.keys(set).length) update.$set = set;
    if (Object.keys(unset).length) update.$unset = unset;

    const { db } = await connectToDatabase();
    const res = await db
      .collection(SABMAIL_COLLECTIONS.conversations)
      .findOneAndUpdate(
        { _id: new ObjectId(id), workspaceId },
        update,
        { returnDocument: 'after' },
      );

    const doc = (res as { value?: unknown } | null)?.value ?? res;
    if (!doc) return { ok: false, error: 'Conversation not found.' };

    return { ok: true, conversation: toConversationRow(doc as WithId<SabmailConversationDoc>) };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

/** Move a conversation through its status lifecycle. */
export async function setConversationStatus(
  id: string,
  status: SabmailConversationStatus,
): Promise<Result<{ conversation: SabmailConversationRow }>> {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };

  try {
    if (!id || !ObjectId.isValid(id)) {
      return { ok: false, error: 'Invalid conversation id.' };
    }
    if (!STATUS_SET.includes(status)) {
      return { ok: false, error: 'Unknown status.' };
    }

    const { db } = await connectToDatabase();
    const res = await db
      .collection(SABMAIL_COLLECTIONS.conversations)
      .findOneAndUpdate(
        { _id: new ObjectId(id), workspaceId },
        { $set: { status } },
        { returnDocument: 'after' },
      );

    const doc = (res as { value?: unknown } | null)?.value ?? res;
    if (!doc) return { ok: false, error: 'Conversation not found.' };

    return { ok: true, conversation: toConversationRow(doc as WithId<SabmailConversationDoc>) };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

/* ── internal comments (never sent to the customer) ──────────────────── */

/** List internal comments on a conversation (oldest first — thread order). */
export async function listConversationComments(
  conversationId: string,
): Promise<SabmailCommentRow[]> {
  try {
    const workspaceId = await getSabmailWorkspaceId();
    if (!workspaceId) return [];
    if (!conversationId || !ObjectId.isValid(conversationId)) return [];

    const { db } = await connectToDatabase();
    const docs = await db
      .collection(SABMAIL_COLLECTIONS.comments)
      .find({ workspaceId, conversationId })
      .sort({ createdAt: 1 })
      .limit(500)
      .toArray();

    return docs.map((d) => toCommentRow(d as WithId<SabmailCommentDoc>));
  } catch (err) {
    console.error('[sabmail] listConversationComments failed:', err);
    return [];
  }
}

/** Add an internal note to a conversation. Bumps the conversation activity. */
export async function addConversationComment(
  conversationId: string,
  body: string,
): Promise<Result<{ comment: SabmailCommentRow }>> {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };

  try {
    if (!conversationId || !ObjectId.isValid(conversationId)) {
      return { ok: false, error: 'Invalid conversation id.' };
    }
    const text = body?.trim();
    if (!text) return { ok: false, error: 'Write a note before adding it.' };

    const { db } = await connectToDatabase();

    // Guard: the conversation must exist in this workspace.
    const convo = await db
      .collection(SABMAIL_COLLECTIONS.conversations)
      .findOne({ _id: new ObjectId(conversationId), workspaceId });
    if (!convo) return { ok: false, error: 'Conversation not found.' };

    // Resolve the author from the active member list (best-effort).
    let authorName = 'Teammate';
    try {
      const project = await getActiveSabmailProject();
      const owner = (project as { ownerName?: unknown; displayName?: unknown } | null) ?? null;
      authorName =
        String(owner?.displayName ?? owner?.ownerName ?? '').trim() || 'Teammate';
    } catch {
      /* fall back to the neutral author */
    }

    const now = new Date();
    const doc: SabmailCommentDoc = {
      workspaceId,
      conversationId,
      authorName,
      body: text,
      createdAt: now,
    };

    const res = await db
      .collection(SABMAIL_COLLECTIONS.comments)
      .insertOne(doc as never);

    // Bump conversation activity so it floats to the top of the list.
    await db
      .collection(SABMAIL_COLLECTIONS.conversations)
      .updateOne(
        { _id: new ObjectId(conversationId), workspaceId },
        { $set: { lastMessageAt: now } },
      );

    return {
      ok: true,
      comment: toCommentRow({ ...doc, _id: res.insertedId } as WithId<SabmailCommentDoc>),
    };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}
