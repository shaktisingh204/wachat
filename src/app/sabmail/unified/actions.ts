'use server';

/* ──────────────────────────────────────────────────────────────────────
 * Cross-channel unified inbox — SabMail (email) + SabSMS (SMS/MMS/RCS).
 *
 * Merges two independently project-scoped modules into one triage surface.
 * The tenancy bridge: the active SabMail workspace comes from the
 * `sabmail_project` cookie (we're rendering under /sabmail), while the SMS
 * side is resolved from the SAME user's `kind:'sms'` projects — so a user sees
 * their email and their SMS in one list without juggling cookies.
 *
 * Reads only here. Replies route to each channel's native send path: email
 * composes inline; SMS hands off to /sabsms/inbox (its cookie-scoped engine
 * owns the carrier send), after pinning the right SMS project via
 * {@link openSabsmsConversation}.
 * ──────────────────────────────────────────────────────────────────── */

import { ObjectId } from 'mongodb';
import { cookies } from 'next/headers';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { getSabmailWorkspaceId } from '@/lib/sabmail/workspace';
import { listSabmailAccounts } from '@/app/actions/sabmail-projects.actions';
import { listSabmailMessages } from '@/app/sabmail/inbox/actions';
import { loadConversations } from '@/app/sabsms/inbox/actions';
import { SABSMS_COLLECTIONS } from '@/lib/sabsms/db/collections';
import { getErrorMessage } from '@/lib/utils';

export type UnifiedChannel = 'email' | 'sms';

export interface UnifiedConversation {
  /** Channel-prefixed composite id, unique across both stores. */
  key: string;
  channel: UnifiedChannel;
  title: string;
  preview: string;
  fromLabel: string;
  /** ISO timestamp of the latest activity (drives the merged sort). */
  lastAt: string | null;
  unread: boolean;
  unreadCount: number;
  /** Email-only locator. */
  email?: { accountId: string; uid: number; folder: string; flagged: boolean; hasAttachments: boolean };
  /** SMS-only locator. */
  sms?: { workspaceId: string; conversationId: string; contactPhone?: string };
}

export interface SmsWorkspaceRef {
  id: string;
  name: string;
}

export interface UnifiedInboxData {
  ok: true;
  conversations: UnifiedConversation[];
  /** The primary IMAP account used for the email side (for inline reply). */
  primaryAccount: { id: string; email: string } | null;
  smsWorkspaces: SmsWorkspaceRef[];
  /** Per-channel reachability so the UI can explain a missing side. */
  channels: { email: boolean; sms: boolean };
  /** Soft per-channel error (e.g. IMAP unreachable) without failing the page. */
  notes: string[];
}

type UnifiedResult = UnifiedInboxData | { ok: false; error: string };

const EMAIL_PAGE = 25;

function timeKey(iso: string | null): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

/** Resolve the signed-in user's SMS workspaces (kind:'sms' projects). */
async function resolveSmsWorkspaces(userId: ObjectId): Promise<SmsWorkspaceRef[]> {
  const { db } = await connectToDatabase();
  const rows = await db
    .collection('projects')
    .find(
      { kind: 'sms', $or: [{ userId }, { 'agents.userId': userId }] },
      { projection: { name: 1 } },
    )
    .limit(10)
    .toArray();
  return rows.map((r) => ({ id: String(r._id), name: String(r.name ?? 'SMS') }));
}

export async function loadUnifiedInbox(): Promise<UnifiedResult> {
  try {
    const session = await getSession();
    if (!session?.user?._id) return { ok: false, error: 'Not signed in.' };
    const userId = new ObjectId(String(session.user._id));

    const mailWorkspaceId = await getSabmailWorkspaceId();
    if (!mailWorkspaceId) return { ok: false, error: 'No SabMail workspace selected.' };

    const notes: string[] = [];
    const conversations: UnifiedConversation[] = [];

    // ── Email side (live IMAP via the primary connected mailbox) ──────────
    let primaryAccount: { id: string; email: string } | null = null;
    let emailReachable = false;
    try {
      const accounts = (await listSabmailAccounts()).filter((a) => a.provider === 'imap');
      if (accounts[0]) {
        primaryAccount = { id: accounts[0].id, email: accounts[0].email };
        const res = await listSabmailMessages(accounts[0].id, 'INBOX', 1, EMAIL_PAGE);
        if (res.ok) {
          emailReachable = true;
          for (const m of res.messages) {
            const from = m.fromName?.trim() || m.fromEmail || 'Unknown sender';
            conversations.push({
              key: `email:${accounts[0].id}:${m.uid}`,
              channel: 'email',
              title: m.subject?.trim() || '(no subject)',
              preview: m.fromEmail || '',
              fromLabel: from,
              lastAt: m.date,
              unread: !m.seen,
              unreadCount: m.seen ? 0 : 1,
              email: {
                accountId: accounts[0].id,
                uid: m.uid,
                folder: 'INBOX',
                flagged: m.flagged,
                hasAttachments: m.hasAttachments,
              },
            });
          }
        } else {
          notes.push(`Email: ${res.error}`);
        }
      }
    } catch (err) {
      notes.push(`Email: ${getErrorMessage(err)}`);
    }

    // ── SMS side (resolved SMS workspaces, read-only direct query) ────────
    const smsWorkspaces = await resolveSmsWorkspaces(userId);
    let smsReachable = false;
    for (const ws of smsWorkspaces) {
      try {
        const convs = await loadConversations(ws.id, { scope: 'all', sort: 'newest' });
        smsReachable = true;
        if (convs.length === 0) continue;

        // Conversations don't store the contact phone; derive it from messages
        // (contact number = inbound.from = outbound.to). Best-effort.
        const phoneByConv = new Map<string, string>();
        try {
          const { db } = await connectToDatabase();
          const ids = convs.map((c) => c.id);
          const msgs = await db
            .collection(SABSMS_COLLECTIONS.messages)
            .find(
              { workspaceId: ws.id, conversationId: { $in: ids } },
              { projection: { conversationId: 1, from: 1, to: 1, direction: 1 } },
            )
            .limit(4000)
            .toArray();
          for (const m of msgs) {
            const cid = String(m.conversationId);
            if (phoneByConv.has(cid)) continue;
            const phone = m.direction === 'inbound' ? m.from : m.to;
            if (phone) phoneByConv.set(cid, String(phone));
          }
        } catch {
          /* fall back to a friendly label below */
        }

        for (const c of convs) {
          const phone = c.contactPhone?.trim() || phoneByConv.get(c.id) || '';
          const who = phone || 'SMS conversation';
          conversations.push({
            key: `sms:${ws.id}:${c.id}`,
            channel: 'sms',
            title: who,
            preview: c.lastMessagePreview?.trim() || '',
            fromLabel: who,
            lastAt: c.lastMessageAt ?? c.createdAt ?? null,
            unread: (c.unreadCount ?? 0) > 0,
            unreadCount: c.unreadCount ?? 0,
            sms: { workspaceId: ws.id, conversationId: c.id, contactPhone: phone || undefined },
          });
        }
      } catch (err) {
        notes.push(`SMS (${ws.name}): ${getErrorMessage(err)}`);
      }
    }

    conversations.sort((a, b) => timeKey(b.lastAt) - timeKey(a.lastAt));

    return {
      ok: true,
      conversations,
      primaryAccount,
      smsWorkspaces,
      channels: { email: emailReachable, sms: smsReachable },
      notes,
    };
  } catch (err) {
    return { ok: false, error: getErrorMessage(err) };
  }
}

/**
 * Pin the SMS project (so /sabsms opens in the right workspace) before the
 * client deep-links to the native SMS inbox to reply. Validates ownership so a
 * user can only ever pin a workspace they actually belong to.
 */
export async function openSabsmsConversation(
  workspaceId: string,
): Promise<{ ok: boolean }> {
  try {
    const session = await getSession();
    if (!session?.user?._id) return { ok: false };
    if (!ObjectId.isValid(workspaceId)) return { ok: false };
    const userId = new ObjectId(String(session.user._id));
    const { db } = await connectToDatabase();
    const project = await db.collection('projects').findOne(
      {
        _id: new ObjectId(workspaceId),
        kind: 'sms',
        $or: [{ userId }, { 'agents.userId': userId }],
      },
      { projection: { _id: 1 } },
    );
    if (!project) return { ok: false };
    const jar = await cookies();
    jar.set('sabsms_project', workspaceId, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
