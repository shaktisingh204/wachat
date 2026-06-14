'use server';

/* ──────────────────────────────────────────────────────────────────────
 * SabMail collaborative drafting — presence & collision detection (Tier 1).
 *
 * This is the ALWAYS-ON, zero-infra half of collaborative drafting: a
 * heartbeat-backed presence registry that tells every open composer who else
 * is editing the same draft right now. It needs no WebSocket and no sync
 * server — just Mongo with a TTL index — so it works in every environment.
 *
 * The optional real-time CRDT text-merge (Tier 2) layers on top via the Yjs
 * gateway (see `src/lib/sabmail/collab/use-collab-doc.ts`) and degrades to
 * this presence tier whenever the box-only gateway isn't reachable.
 * ──────────────────────────────────────────────────────────────────── */

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { getSabmailWorkspaceId } from '@/lib/sabmail/workspace';
import { getErrorMessage } from '@/lib/utils';

const PRESENCE_COLLECTION = 'sabmail_draft_presence';
/** A presence row is considered live for this long after its last heartbeat. */
const PRESENCE_TTL_SECONDS = 45;

export interface SabmailDraftEditor {
  userId: string;
  name: string;
  /** Deterministic chrome colour for the avatar (hex). */
  color: string;
  /** ISO timestamp of the editor's last heartbeat. */
  lastSeen: string;
}

export interface DraftPresenceResult {
  ok: true;
  /** My own identity (so the client can render "you" consistently). */
  me: { userId: string; name: string; color: string };
  /** Everyone ELSE currently editing this draft (excludes me). */
  others: SabmailDraftEditor[];
}

type PresenceResult = DraftPresenceResult | { ok: false; error: string };

/* Stable, pleasant avatar palette — index chosen by a hash of the userId so a
 * given person keeps the same colour across sessions and devices. */
const PALETTE = [
  '#3b7bff', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
];

function colorForUser(userId: string): string {
  let h = 0;
  for (let i = 0; i < userId.length; i += 1) {
    h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return PALETTE[h % PALETTE.length];
}

let ttlEnsured = false;
async function ensureTtlIndex(db: Awaited<ReturnType<typeof connectToDatabase>>['db']) {
  if (ttlEnsured) return;
  // Attempt at most once per process regardless of outcome — a conflicting or
  // failing createIndex must NOT re-run on every 12s heartbeat. Queries filter
  // on expiresAt > now, so presence stays correct even without the TTL sweep.
  ttlEnsured = true;
  try {
    await db
      .collection(PRESENCE_COLLECTION)
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await db
      .collection(PRESENCE_COLLECTION)
      .createIndex({ workspaceId: 1, draftId: 1 });
  } catch {
    /* best-effort */
  }
}

/**
 * Heartbeat + roster in one call. Upserts the caller's presence for `draftId`
 * (extending its TTL) and returns everyone ELSE currently editing it. The
 * compose modal calls this on open and then on a short interval.
 */
export async function syncSabmailDraftPresence(draftId: string): Promise<PresenceResult> {
  try {
    if (!draftId) return { ok: false, error: 'Missing draft id.' };
    const session = await getSession();
    const user = session?.user;
    if (!user?._id) return { ok: false, error: 'Not signed in.' };

    const workspaceId = await getSabmailWorkspaceId();
    if (!workspaceId) return { ok: false, error: 'No SabMail workspace selected.' };

    const { db } = await connectToDatabase();
    await ensureTtlIndex(db);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + PRESENCE_TTL_SECONDS * 1000);
    const userId = String(user._id);
    const name = (user.name || user.email || 'Someone').toString();
    const color = colorForUser(userId);

    await db.collection(PRESENCE_COLLECTION).updateOne(
      { workspaceId, draftId, userId },
      {
        $set: { workspaceId, draftId, userId, name, color, updatedAt: now, expiresAt },
        $setOnInsert: { joinedAt: now },
      },
      { upsert: true },
    );

    const rows = await db
      .collection(PRESENCE_COLLECTION)
      .find({ workspaceId, draftId, userId: { $ne: userId }, expiresAt: { $gt: now } })
      .toArray();

    const others: SabmailDraftEditor[] = rows.map((r) => ({
      userId: String(r.userId),
      name: String(r.name ?? 'Someone'),
      color: String(r.color ?? colorForUser(String(r.userId))),
      lastSeen: (r.updatedAt instanceof Date ? r.updatedAt : now).toISOString(),
    }));

    return { ok: true, me: { userId, name, color }, others };
  } catch (err) {
    return { ok: false, error: getErrorMessage(err) };
  }
}

/** Drop the caller's presence for a draft (compose modal close / unmount). */
export async function leaveSabmailDraft(draftId: string): Promise<{ ok: boolean }> {
  try {
    if (!draftId) return { ok: false };
    const session = await getSession();
    const userId = session?.user?._id ? String(session.user._id) : null;
    const workspaceId = await getSabmailWorkspaceId();
    if (!userId || !workspaceId) return { ok: false };
    const { db } = await connectToDatabase();
    await db.collection(PRESENCE_COLLECTION).deleteOne({ workspaceId, draftId, userId });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
