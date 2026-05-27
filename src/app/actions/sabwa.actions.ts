'use server';

/**
 * SabWa — server-action skeleton (Phase 1).
 *
 * ─── TODO: wire to Rust engine ─────────────────────────────────────────────
 *   The actual Baileys session pool runs in the Rust engine located at
 *   `services/sabwa-engine`. All side-effecting calls in this file should
 *   ultimately proxy through `engineFetch()` against:
 *
 *     base URL: process.env.SABWA_ENGINE_URL ?? 'http://localhost:4001'
 *     auth:     X-Sabwa-Service-Token: process.env.SABWA_ENGINE_TOKEN
 *
 *   For Phase 1 every function is a stub that throws
 *   `SabWa Phase 1 — not implemented yet` so callers can be wired without
 *   the engine being live yet.
 *
 *   Source of truth for signatures: SABWA_PLAN.md § 13.
 * ───────────────────────────────────────────────────────────────────────────
 */

import type { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';
import type {
  SabwaAutoReply,
  SabwaAutoReplyAction,
  SabwaAutoReplyTrigger,
  SabwaBroadcast,
  SabwaChatType,
  SabwaContact,
  SabwaMessage,
  SabwaPairMethod,
  SabwaQuickReply,
  SabwaRateLimitProfile,
  SabwaScheduled,
  SabwaScheduledPayload,
  SabwaSession,
  SabwaSessionStatus,
  SabwaTemplate,
  SabwaWebhookEvent,
  SabwaDeviceMeta,
} from '@/lib/sabwa/types';
import { engineFetch, SabwaEngineError } from '@/lib/sabwa/engine-client';
import { getSession } from '@/app/actions/user.actions';
import { recordFlowAction } from '@/lib/sabflow/audit/middleware';
import { getProjects } from '@/app/actions/project.actions';
import { ObjectId as MongoObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getErrorMessage } from '@/lib/utils';

// ─── Common result shape ────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type SabwaActionResult<T extends object = {}> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

const NOT_IMPLEMENTED = 'This feature is not available yet.';

// IdLike — server actions are called from client code where ObjectId is a
// string, but internally we treat both interchangeably.
type IdLike = string | ObjectId;

// ─── Internal helpers ───────────────────────────────────────────────────────

const idStr = (v: IdLike): string => (typeof v === 'string' ? v : String(v));

/** Confirm a user session exists; returns the user id or an error result. */
async function requireAuth(): Promise<
  { ok: true; userId: string } | { ok: false; error: string }
> {
  const session = await getSession();
  const userId = (session as { user?: { _id?: string } } | null)?.user?._id;
  if (!session || !userId) return { ok: false, error: 'Authentication required.' };
  return { ok: true, userId: String(userId) };
}

/** Confirm auth + project ownership. */
async function requireProject(
  projectId: IdLike,
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  const pid = idStr(projectId);
  const projects = await getProjects();
  if (!projects.some((p) => String(p._id) === pid)) {
    return { ok: false, error: 'Project not found or access denied.' };
  }
  return auth;
}

/** Scope:path pairs we've already logged for this session, to avoid log spam. */
const loggedFailures = new Set<string>();

/** Convert any error coming back from the engine into a `{ ok: false }` result. */
function engineFailure(scope: string, err: unknown): { ok: false; error: string } {
  if (err instanceof SabwaEngineError) {
    const path = err.path?.split('?')[0] ?? 'unknown';
    const key = `${scope}:${path}`;
    if (!loggedFailures.has(key)) {
      loggedFailures.add(key);
      console.warn(
        `[sabwa.${scope}] engine error (silenced after first)`,
        { status: err.status, path },
      );
    }
    return { ok: false, error: err.message };
  }
  const key = `${scope}:unexpected`;
  if (!loggedFailures.has(key)) {
    loggedFailures.add(key);
    console.warn(
      `[sabwa.${scope}] unexpected error (silenced after first)`,
      err,
    );
  }
  return {
    ok: false,
    error: err instanceof Error ? err.message : 'Unexpected error.',
  };
}

/** Build a URL query string, skipping undefined/null/empty values. */
function buildQs(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    if (v instanceof Date) sp.set(k, v.toISOString());
    else if (Array.isArray(v)) sp.set(k, v.join(','));
    else sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

/** Typed GET against the engine. */
function engineGet<T>(
  path: string,
  opts: { treatNotFoundAsEmpty: true },
): Promise<T | null>;
function engineGet<T>(path: string, opts?: { treatNotFoundAsEmpty?: boolean }): Promise<T>;
function engineGet<T>(
  path: string,
  opts: { treatNotFoundAsEmpty?: boolean } = {},
): Promise<T | null> {
  if (opts.treatNotFoundAsEmpty) {
    return engineFetch<T>(path, { method: 'GET', treatNotFoundAsEmpty: true });
  }
  return engineFetch<T>(path, { method: 'GET' });
}

/** Typed write (POST/PATCH/PUT/DELETE) against the engine. */
function engineSend<T>(
  path: string,
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  json?: unknown,
): Promise<T> {
  return engineFetch<T>(path, { method, json });
}

// ─── Shared payload shapes ──────────────────────────────────────────────────

interface SabwaSendMessagePayload {
  type: SabwaScheduledPayload['type'];
  body?: string;
  mediaSabFileId?: string;
  caption?: string;
  quotedMessageId?: string;
  mentionJids?: string[];
}

interface SabwaChatListFilter {
  type?: SabwaChatType;
  query?: string;
  unreadOnly?: boolean;
  archivedOnly?: boolean;
  labelId?: IdLike;
  limit?: number;
  cursor?: string;
}

interface SabwaScheduledListFilter {
  status?: SabwaScheduled['status'];
  jid?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  cursor?: string;
}

interface SabwaScheduledDraft {
  kind: SabwaScheduled['kind'];
  scheduledFor: Date | string;
  cron?: string;
  timezone: string;
  targets: SabwaScheduled['targets'];
  payload: SabwaScheduledPayload;
  status?: SabwaScheduledStatus;
}

interface SabwaBulkCampaignDraft {
  name: string;
  payload: SabwaScheduledPayload;
  recipients: string[]; // jids
  perMinute?: number;
  jitterSec?: number;
  variants?: SabwaScheduledPayload[];
}

interface SabwaContactListFilter {
  query?: string;
  tag?: string;
  blocked?: boolean;
  limit?: number;
  cursor?: string;
}

interface SabwaAuditListFilter {
  actorId?: IdLike;
  action?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  cursor?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// === Sessions ===
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Start a pairing flow for a new WhatsApp linked-device session.
 *
 * Canonical contract (SABWA_PLAN.md §13):
 *   pairSession({ projectId, userId, pairMethod, phoneE164? })
 *
 * This shim accepts both the canonical object form and the legacy 3-arg
 * positional form (projectId, method, phone) used by `/sabwa/connect`.
 */
export async function pairSession(
  arg1: IdLike | { projectId: IdLike; userId?: IdLike; pairMethod: SabwaPairMethod; phoneE164?: string },
  method?: SabwaPairMethod,
  phone?: string,
): Promise<
  SabwaActionResult<{ sessionId: string; qr?: string; pairCode?: string }>
> {
  const input = typeof arg1 === 'object' && arg1 !== null && 'projectId' in arg1
    ? arg1
    : { projectId: arg1 as IdLike, pairMethod: method as SabwaPairMethod, phoneE164: phone };
  const projectId = idStr(input.projectId);
  if (!projectId) return { ok: false, error: 'projectId is required.' };
  if (input.pairMethod !== 'qr' && input.pairMethod !== 'code') {
    return { ok: false, error: 'pairMethod must be "qr" or "code".' };
  }
  if (input.pairMethod === 'code' && !input.phoneE164) {
    return { ok: false, error: 'phoneE164 is required for code pairing.' };
  }
  const auth = await requireProject(projectId);
  if (!auth.ok) return auth;
  try {
    const body = {
      projectId,
      userId: input.userId ? idStr(input.userId) : auth.userId,
      pairMethod: input.pairMethod,
      phoneE164: input.phoneE164,
    };
    const res = await engineSend<{ sessionId: string; qr?: string; pairCode?: string }>(
      '/v1/sessions',
      'POST',
      body,
    );
    revalidatePath('/sabwa/connect');
    revalidatePath('/sabwa/devices');
    void recordFlowAction('sabwa.session.connected', {
      userId: auth.userId,
      target: res.sessionId,
      metadata: { projectId, pairMethod: input.pairMethod },
    });
    return { ok: true, ...res };
  } catch (err) {
    return engineFailure('pairSession', err);
  }
}

/** Log out an active SabWa session and wipe its auth state. */
export async function logoutSession(
  sessionId: IdLike,
): Promise<SabwaActionResult> {
  const id = idStr(sessionId);
  if (!id) return { ok: false, error: 'sessionId is required.' };
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    await engineSend(`/v1/sessions/${encodeURIComponent(id)}`, 'DELETE');
    revalidatePath('/sabwa/devices');
    revalidatePath('/sabwa/connect');
    void recordFlowAction('sabwa.session.disconnected', {
      userId: auth.userId,
      target: id,
    });
    return { ok: true };
  } catch (err) {
    return engineFailure('logoutSession', err);
  }
}

/** Rename a session's user-facing label. */
export async function renameSession(
  sessionId: IdLike,
  label: string,
): Promise<SabwaActionResult> {
  const id = idStr(sessionId);
  if (!id) return { ok: false, error: 'sessionId is required.' };
  if (!label || label.length > 80) {
    return { ok: false, error: 'label must be 1–80 characters.' };
  }
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    await engineSend(`/v1/sessions/${encodeURIComponent(id)}`, 'PATCH', { label });
    revalidatePath('/sabwa/devices');
    revalidatePath('/sabwa/settings');
    return { ok: true };
  } catch (err) {
    return engineFailure('renameSession', err);
  }
}

/** List all SabWa sessions belonging to a project. */
export async function listSessions(
  projectId: IdLike,
): Promise<SabwaActionResult<{ sessions: SabwaSession[] }>> {
  const pid = idStr(projectId);
  if (!pid) return { ok: false, error: 'projectId is required.' };
  const auth = await requireProject(pid);
  if (!auth.ok) return auth;
  try {
    const res = await engineGet<{ sessions: SabwaSession[] }>(
      `/v1/sessions${buildQs({ projectId: pid })}`,
    );
    return { ok: true, sessions: res.sessions ?? [] };
  } catch (err) {
    return engineFailure('listSessions', err);
  }
}

/**
 * Fetch the current connection status + lightweight metadata for a single
 * SabWa session. Used by the Overview hero, the SessionSwitcher, and
 * anything that needs to render a fresh status badge without subscribing
 * to the live stream.
 */
interface SabwaSessionStatusInfo {
  sessionId: string;
  status: SabwaSessionStatus | 'syncing';
  phoneE164?: string;
  pushName?: string;
  profilePicUrl?: string;
  lastSeenAt?: string;
  banRiskScore?: number; // 0–100
  banRiskReasons?: string[];
}

export async function getSessionStatus(
  sessionId: IdLike,
): Promise<SabwaActionResult<{ session: SabwaSessionStatusInfo }>> {
  const id = idStr(sessionId);
  if (!id) return { ok: false, error: 'sessionId is required.' };
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    const res = await engineGet<{ session: SabwaSessionStatusInfo }>(
      `/v1/sessions/${encodeURIComponent(id)}/status`,
    );
    return { ok: true, session: res.session };
  } catch (err) {
    return engineFailure('getSessionStatus', err);
  }
}

/**
 * Convenience alias used by the Overview page — the spec names it
 * `listScheduled`, while the full CRUD surface is `listScheduledMessages`.
 * Both return the same shape so the page is decoupled from the rename.
 */
export async function listScheduled(
  _input: { sessionId: IdLike; status?: SabwaScheduled['status']; limit?: number },
): Promise<
  SabwaActionResult<{ items: SabwaScheduled[]; nextCursor?: string }>
> {
  try {
    return await listScheduledMessages(_input.sessionId, {
      status: _input.status,
      limit: _input.limit,
    });
  } catch {
    // The Phase-1 stub throws _NOT_IMPLEMENTED_ — surface an empty queue so
    // the Overview can still render its "Nothing pending" state.
    return { ok: true, items: [] };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// === Chats ===
// ═══════════════════════════════════════════════════════════════════════════

/** List chats for a session with optional filters and pagination. */
export async function listChats(
  sessionId: IdLike,
  filter: SabwaChatListFilter = {},
): Promise<SabwaActionResult<{ chats: unknown[]; nextCursor?: string }>> {
  const sid = idStr(sessionId);
  if (!sid) return { ok: false, error: 'sessionId is required.' };
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    const res = await engineGet<{ chats: unknown[]; nextCursor?: string }>(
      `/v1/chats${buildQs({
        sessionId: sid,
        type: filter.type,
        filter: filter.query,
        unread: filter.unreadOnly,
        archived: filter.archivedOnly,
        labelId: filter.labelId ? idStr(filter.labelId) : undefined,
        limit: filter.limit,
        cursor: filter.cursor,
      })}`,
    );
    return { ok: true, chats: res.chats ?? [], nextCursor: res.nextCursor };
  } catch (err) {
    return engineFailure('listChats', err);
  }
}

/** Pagination cursor for `getChatMessages` — supports cursor OR a `before` ts. */
interface SabwaMessagePageCursor {
  cursor?: string;
  before?: Date | string | number;
  limit?: number;
}

/** Fetch a window of messages for a chat using a cursor for pagination. */
export async function getChatMessages(
  sessionId: IdLike,
  jid: string,
  cursor?: string | SabwaMessagePageCursor,
): Promise<
  SabwaActionResult<{ messages: SabwaMessage[]; nextCursor?: string }>
> {
  const sid = idStr(sessionId);
  if (!sid || !jid) {
    return { ok: false, error: 'sessionId and chatJid are required.' };
  }
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  const c = typeof cursor === 'string' ? { cursor } : cursor ?? {};
  try {
    const res = await engineGet<{ messages: SabwaMessage[]; nextCursor?: string }>(
      `/v1/messages${buildQs({
        sessionId: sid,
        chatJid: jid,
        before: c.before instanceof Date ? c.before.toISOString() : c.before,
        cursor: c.cursor,
        limit: c.limit,
      })}`,
    );
    return { ok: true, messages: res.messages ?? [], nextCursor: res.nextCursor };
  } catch (err) {
    return engineFailure('getChatMessages', err);
  }
}

/** Send a message to a chat (text or media). */
export async function sendMessage(
  sessionId: IdLike,
  jid: string,
  payload: SabwaSendMessagePayload,
): Promise<SabwaActionResult<{ messageId: string }>> {
  const sid = idStr(sessionId);
  if (!sid || !jid || !payload) {
    return { ok: false, error: 'sessionId, chatJid, and payload are required.' };
  }
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    const res = await engineSend<{ messageId: string }>('/v1/messages', 'POST', {
      sessionId: sid,
      chatJid: jid,
      payload,
    });
    revalidatePath('/sabwa/chats');
    revalidatePath('/sabwa/inbox');
    return { ok: true, messageId: res.messageId };
  } catch (err) {
    return engineFailure('sendMessage', err);
  }
}

/** Mark a chat as fully read (clear unread counter, send read receipts). */
export async function markRead(
  sessionId: IdLike,
  jid: string,
): Promise<SabwaActionResult> {
  const sid = idStr(sessionId);
  if (!sid || !jid) {
    return { ok: false, error: 'sessionId and chatJid are required.' };
  }
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    await engineSend('/v1/messages/mark-read', 'POST', { sessionId: sid, chatJid: jid });
    revalidatePath('/sabwa/chats');
    revalidatePath('/sabwa/inbox');
    return { ok: true };
  } catch (err) {
    return engineFailure('markRead', err);
  }
}

// patchChat — internal shared mutator hitting the engine's per-chat PATCH.
async function patchChat(
  sessionId: IdLike,
  jid: string,
  patch: Record<string, unknown>,
  scope: string,
): Promise<SabwaActionResult> {
  const sid = idStr(sessionId);
  if (!sid || !jid) {
    return { ok: false, error: 'sessionId and chatJid are required.' };
  }
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    await engineSend(`/v1/chats/${encodeURIComponent(jid)}`, 'PATCH', {
      sessionId: sid,
      ...patch,
    });
    revalidatePath('/sabwa/chats');
    revalidatePath('/sabwa/inbox');
    return { ok: true };
  } catch (err) {
    return engineFailure(scope, err);
  }
}

/** Pin or unpin a chat in the inbox. */
export async function pinChat(
  sessionId: IdLike,
  jid: string,
  pinned: boolean,
): Promise<SabwaActionResult> {
  return patchChat(sessionId, jid, { pinned }, 'pinChat');
}

/** Mute a chat for a given duration (in seconds) or unmute it. */
export async function muteChat(
  sessionId: IdLike,
  jid: string,
  muteForSec: number | null,
): Promise<SabwaActionResult> {
  return patchChat(
    sessionId,
    jid,
    { muted: muteForSec !== null, muteForSec },
    'muteChat',
  );
}

/** Archive or unarchive a chat. */
export async function archiveChat(
  sessionId: IdLike,
  jid: string,
  archived: boolean,
): Promise<SabwaActionResult> {
  return patchChat(sessionId, jid, { archived }, 'archiveChat');
}

/** Delete a chat (optionally also clearing its messages). */
export async function deleteChat(
  sessionId: IdLike,
  jid: string,
  opts: { clearMessages?: boolean } = {},
): Promise<SabwaActionResult> {
  const sid = idStr(sessionId);
  if (!sid || !jid) {
    return { ok: false, error: 'sessionId and chatJid are required.' };
  }
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    await engineSend(
      `/v1/chats/${encodeURIComponent(jid)}${buildQs({
        sessionId: sid,
        clearMessages: opts.clearMessages,
      })}`,
      'DELETE',
    );
    revalidatePath('/sabwa/chats');
    revalidatePath('/sabwa/inbox');
    return { ok: true };
  } catch (err) {
    return engineFailure('deleteChat', err);
  }
}

/**
 * Update mutable chat state in one call (pin/mute/archive/labels/etc.).
 * Used by the inbox UI as a single PATCH endpoint instead of N action calls.
 */
interface SabwaChatStatePatch {
  pinned?: boolean;
  muted?: boolean;
  muteForSec?: number | null;
  archived?: boolean;
  read?: boolean;
  labels?: string[];
}

export async function updateChatState(
  sessionId: IdLike,
  jid: string,
  patch: SabwaChatStatePatch,
): Promise<SabwaActionResult> {
  return patchChat(sessionId, jid, patch as Record<string, unknown>, 'updateChatState');
}

/**
 * Per-message mutations (reply/react/star/forward/delete/edit). The `op`
 * field disambiguates which write the engine performs.
 */
type SabwaMessageOp =
  | { op: 'react'; emoji: string | null }
  | { op: 'star'; starred: boolean }
  | { op: 'forward'; toJids: string[] }
  | { op: 'delete'; forEveryone?: boolean }
  | { op: 'edit'; body: string };

export async function updateMessage(
  sessionId: IdLike,
  chatJid: string,
  messageId: string,
  op: SabwaMessageOp,
): Promise<SabwaActionResult> {
  const sid = idStr(sessionId);
  if (!sid || !chatJid || !messageId || !op) {
    return { ok: false, error: 'sessionId, chatJid, messageId, and op are required.' };
  }
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    await engineSend(`/v1/messages/${encodeURIComponent(messageId)}`, 'PATCH', {
      sessionId: sid,
      chatJid,
      ...op,
    });
    revalidatePath('/sabwa/chats');
    revalidatePath('/sabwa/inbox');
    return { ok: true };
  } catch (err) {
    return engineFailure('updateMessage', err);
  }
}

/** Full-text search across stored messages for the current session. */
interface SabwaMessageSearchFilter {
  query: string;
  jid?: string;
  fromMe?: boolean;
  limit?: number;
  cursor?: string;
}

export async function searchMessages(
  sessionId: IdLike,
  filter: SabwaMessageSearchFilter,
): Promise<SabwaActionResult<{ messages: SabwaMessage[]; nextCursor?: string }>> {
  const sid = idStr(sessionId);
  if (!sid || !filter?.query) {
    return { ok: false, error: 'sessionId and query are required.' };
  }
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    const res = await engineGet<{ messages: SabwaMessage[]; nextCursor?: string }>(
      `/v1/messages/search${buildQs({
        sessionId: sid,
        q: filter.query,
        jid: filter.jid,
        fromMe: filter.fromMe,
        limit: filter.limit,
        cursor: filter.cursor,
      })}`,
    );
    return { ok: true, messages: res.messages ?? [], nextCursor: res.nextCursor };
  } catch (err) {
    return engineFailure('searchMessages', err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// === Groups ===
// ═══════════════════════════════════════════════════════════════════════════

/** Create a new WhatsApp group with the given subject and initial members. */
export async function createGroup(
  input: { sessionId: IdLike; subject: string; participants: string[] },
): Promise<SabwaActionResult<{ jid: string; tempRequestId?: string }>> {
  const sid = idStr(input?.sessionId);
  if (!sid || !input?.subject || !input?.participants?.length) {
    return { ok: false, error: 'sessionId, subject, and participants are required.' };
  }
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    const res = await engineSend<{ jid: string; tempRequestId?: string }>(
      '/v1/groups',
      'POST',
      { sessionId: sid, subject: input.subject, participants: input.participants },
    );
    revalidatePath('/sabwa/groups');
    return { ok: true, jid: res.jid, tempRequestId: res.tempRequestId };
  } catch (err) {
    return engineFailure('createGroup', err);
  }
}

// participantsOp — internal helper for add/remove/promote/demote routes.
async function participantsOp(
  sessionId: IdLike,
  jid: string,
  op: 'add' | 'remove' | 'promote' | 'demote',
  jids: string[],
  scope: string,
): Promise<SabwaActionResult> {
  const sid = idStr(sessionId);
  if (!sid || !jid || !jids?.length) {
    return { ok: false, error: 'sessionId, groupJid, and jids are required.' };
  }
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  const groupSeg = encodeURIComponent(jid);
  try {
    switch (op) {
      case 'add':
        await engineSend(`/v1/groups/${groupSeg}/participants`, 'POST', {
          sessionId: sid,
          jids,
        });
        break;
      case 'remove':
        await engineSend(`/v1/groups/${groupSeg}/participants`, 'DELETE', {
          sessionId: sid,
          jids,
        });
        break;
      case 'promote':
        await engineSend(`/v1/groups/${groupSeg}/admins`, 'POST', {
          sessionId: sid,
          jids,
        });
        break;
      case 'demote':
        for (const j of jids) {
          await engineSend(
            `/v1/groups/${groupSeg}/admins/${encodeURIComponent(j)}`,
            'DELETE',
            { sessionId: sid },
          );
        }
        break;
    }
    revalidatePath('/sabwa/groups');
    revalidatePath(`/sabwa/groups/${jid}`);
    return { ok: true };
  } catch (err) {
    return engineFailure(scope, err);
  }
}

/** Add participants to a group (only admins). */
export async function addParticipants(
  sessionId: IdLike,
  jid: string,
  participants: string[],
): Promise<SabwaActionResult> {
  return participantsOp(sessionId, jid, 'add', participants, 'addParticipants');
}

/** Remove participants from a group (only admins). */
export async function removeParticipants(
  sessionId: IdLike,
  jid: string,
  participants: string[],
): Promise<SabwaActionResult> {
  return participantsOp(sessionId, jid, 'remove', participants, 'removeParticipants');
}

/** Promote a participant to group admin. */
export async function promoteAdmin(
  sessionId: IdLike,
  jid: string,
  participant: string,
): Promise<SabwaActionResult> {
  return participantsOp(sessionId, jid, 'promote', [participant], 'promoteAdmin');
}

/** Demote a group admin back to a regular participant. */
export async function demoteAdmin(
  sessionId: IdLike,
  jid: string,
  participant: string,
): Promise<SabwaActionResult> {
  return participantsOp(sessionId, jid, 'demote', [participant], 'demoteAdmin');
}

// patchGroup — shared mutator for group-identity PATCH routes.
async function patchGroup(
  sessionId: IdLike,
  jid: string,
  patch: Record<string, unknown>,
  scope: string,
): Promise<SabwaActionResult> {
  const sid = idStr(sessionId);
  if (!sid || !jid) {
    return { ok: false, error: 'sessionId and groupJid are required.' };
  }
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    await engineSend(`/v1/groups/${encodeURIComponent(jid)}`, 'PATCH', {
      sessionId: sid,
      ...patch,
    });
    revalidatePath('/sabwa/groups');
    revalidatePath(`/sabwa/groups/${jid}`);
    return { ok: true };
  } catch (err) {
    return engineFailure(scope, err);
  }
}

/** Update a group's subject (name). */
export async function updateGroupSubject(
  sessionId: IdLike,
  jid: string,
  subject: string,
): Promise<SabwaActionResult> {
  return patchGroup(sessionId, jid, { subject }, 'updateGroupSubject');
}

/** Update a group's description. */
export async function updateGroupDescription(
  sessionId: IdLike,
  jid: string,
  description: string,
): Promise<SabwaActionResult> {
  return patchGroup(sessionId, jid, { description }, 'updateGroupDescription');
}

/**
 * Fetch (or revoke + regenerate, if `revoke: true`) the current group
 * invite code. Maps to `GET /v1/groups/:jid/invite-link?revoke=true|false`.
 */
export async function getInviteCode(
  input: { sessionId: IdLike; groupJid: string; revoke?: boolean },
): Promise<SabwaActionResult<{ code: string; url: string }>> {
  const sid = idStr(input?.sessionId);
  if (!sid || !input?.groupJid) {
    return { ok: false, error: 'sessionId and groupJid are required.' };
  }
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    const res = await engineGet<{ code: string; url: string }>(
      `/v1/groups/${encodeURIComponent(input.groupJid)}/invite-link${buildQs({
        sessionId: sid,
        revoke: input.revoke ? 'true' : 'false',
      })}`,
    );
    if (input.revoke) revalidatePath(`/sabwa/groups/${input.groupJid}`);
    return { ok: true, code: res.code, url: res.url };
  } catch (err) {
    return engineFailure('getInviteCode', err);
  }
}

/**
 * @deprecated Pass `revoke: true` to `getInviteCode` instead.
 * Kept as a thin alias so older callers continue to compile.
 */
export async function revokeInviteCode(
  sessionId: IdLike,
  jid: string,
): Promise<SabwaActionResult<{ code: string; url: string }>> {
  return getInviteCode({ sessionId, groupJid: jid, revoke: true });
}

/** Tag a group with a user-defined category (Family / Work / etc.). */
export async function setGroupCategory(
  inputOrSessionId:
    | { sessionId: IdLike; groupJid: string; categoryId?: IdLike | null }
    | IdLike,
  categoryIdLegacy?: IdLike,
): Promise<SabwaActionResult> {
  const input =
    typeof inputOrSessionId === 'object' && inputOrSessionId !== null && 'groupJid' in inputOrSessionId
      ? inputOrSessionId
      : {
          sessionId: inputOrSessionId as IdLike,
          groupJid: '',
          categoryId: categoryIdLegacy,
        };
  if (!input.groupJid) {
    return { ok: false, error: 'groupJid is required.' };
  }
  return patchGroup(
    input.sessionId,
    input.groupJid,
    {
      category:
        input.categoryId === null || input.categoryId === undefined
          ? null
          : idStr(input.categoryId as IdLike),
    },
    'setGroupCategory',
  );
}

// ─── Object-form group actions used by /sabwa/groups/* pages ────────────────
//
// These mirror SABWA_PLAN.md §6 (pages 6, 7, 8). They proxy to the Rust
// engine `/v1/groups/*` routes documented in `services/sabwa-engine/src/routes/groups.rs`.

interface SabwaGroupSummary {
  jid: string;
  subject: string;
  description?: string | null;
  participantCount: number;
  category?: string | null;
  announcement: boolean;
  restrict: boolean;
  isAdmin?: boolean;
  muted?: boolean;
  lastActivityAt?: string | Date | null;
  profilePicUrl?: string | null;
}

interface SabwaGroupParticipantDto {
  jid: string;
  name?: string | null;
  profilePicUrl?: string | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  joinedAt?: string | Date | null;
  lastSeenAt?: string | Date | null;
}

interface SabwaGroupDetail {
  jid: string;
  subject: string;
  description?: string | null;
  creator?: string | null;
  announcement: boolean;
  restrict: boolean;
  ephemeralDuration?: number | null;
  category?: string | null;
  participants: SabwaGroupParticipantDto[];
  inviteCode?: string | null;
  iconUrl?: string | null;
  pendingRequests?: Array<{ jid: string; requestedAt?: string | Date }>;
  isCommunity?: boolean;
}

interface SabwaGroupCategory {
  id: string;
  name: string;
  color: string;
  icon?: string;
  groupCount?: number;
  order?: number;
}

interface SabwaGroupPatch {
  subject?: string;
  description?: string;
  iconUrl?: string;
  announcement?: boolean;
  restrict?: boolean;
  ephemeralDuration?: number | null;
}

/** List groups for a session, optionally filtered by category. */
export async function listGroups(
  input: { sessionId: IdLike; category?: string | null },
): Promise<SabwaActionResult<{ groups: SabwaGroupSummary[] }>> {
  const sid = idStr(input?.sessionId);
  if (!sid) return { ok: false, error: 'sessionId is required.' };
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    const res = await engineGet<{ groups: SabwaGroupSummary[] }>(
      `/v1/groups${buildQs({ sessionId: sid, category: input.category ?? undefined })}`,
    );
    return { ok: true, groups: res.groups ?? [] };
  } catch (err) {
    return engineFailure('listGroups', err);
  }
}

/** Fetch detailed metadata for a single group. */
export async function getGroup(
  input: { sessionId: IdLike; groupJid: string },
): Promise<SabwaActionResult<{ group: SabwaGroupDetail }>> {
  const sid = idStr(input?.sessionId);
  if (!sid || !input?.groupJid) {
    return { ok: false, error: 'sessionId and groupJid are required.' };
  }
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    const res = await engineGet<{ group: SabwaGroupDetail }>(
      `/v1/groups/${encodeURIComponent(input.groupJid)}${buildQs({ sessionId: sid })}`,
    );
    return { ok: true, group: res.group };
  } catch (err) {
    return engineFailure('getGroup', err);
  }
}

/** Add / remove / promote / demote participants in one call. */
export async function updateGroupParticipants(
  input: {
    sessionId: IdLike;
    groupJid: string;
    op: 'add' | 'remove' | 'promote' | 'demote';
    jids: string[];
  },
): Promise<SabwaActionResult<{ queued: boolean }>> {
  const r = await participantsOp(
    input.sessionId,
    input.groupJid,
    input.op,
    input.jids,
    'updateGroupParticipants',
  );
  if (!r.ok) return r;
  return { ok: true, queued: true };
}

/** Patch group identity / permissions in a single call. */
export async function updateGroup(
  input: { sessionId: IdLike; groupJid: string; patch: SabwaGroupPatch },
): Promise<SabwaActionResult<{ queued: boolean }>> {
  const r = await patchGroup(
    input.sessionId,
    input.groupJid,
    input.patch as Record<string, unknown>,
    'updateGroup',
  );
  if (!r.ok) return r;
  return { ok: true, queued: true };
}

// ─── Group categories (SabNode-side, not WA) ────────────────────────────────

/** List user-defined group categories for the active session. */
export async function listGroupCategories(
  sessionId: IdLike,
): Promise<SabwaActionResult<{ categories: SabwaGroupCategory[] }>> {
  const sid = idStr(sessionId);
  if (!sid) return { ok: false, error: 'sessionId is required.' };
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    const res = await engineGet<{ categories: SabwaGroupCategory[] }>(
      `/v1/group-categories${buildQs({ sessionId: sid })}`,
      { treatNotFoundAsEmpty: true },
    );
    if (!res) return { ok: true, categories: [] };
    return { ok: true, categories: res.categories ?? [] };
  } catch (err) {
    return engineFailure('listGroupCategories', err);
  }
}

/** Create or update a group category. */
export async function upsertGroupCategory(
  input: {
    sessionId: IdLike;
    id?: string;
    name: string;
    color: string;
    icon?: string;
    order?: number;
  },
): Promise<SabwaActionResult<{ category: SabwaGroupCategory }>> {
  const sid = idStr(input?.sessionId);
  if (!sid || !input?.name || !input?.color) {
    return { ok: false, error: 'sessionId, name, and color are required.' };
  }
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    const { id, ...body } = input;
    const payload = { ...body, sessionId: sid };
    const res = id
      ? await engineSend<{ category: SabwaGroupCategory }>(
          `/v1/group-categories/${encodeURIComponent(id)}`,
          'PATCH',
          payload,
        )
      : await engineSend<{ category: SabwaGroupCategory }>(
          '/v1/group-categories',
          'POST',
          payload,
        );
    revalidatePath('/sabwa/groups/categories');
    return { ok: true, category: res.category };
  } catch (err) {
    return engineFailure('upsertGroupCategory', err);
  }
}

/** Delete a group category (groups previously tagged are uncategorised). */
export async function deleteGroupCategory(
  id: IdLike,
): Promise<SabwaActionResult> {
  const cid = idStr(id);
  if (!cid) return { ok: false, error: 'category id is required.' };
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    await engineSend(`/v1/group-categories/${encodeURIComponent(cid)}`, 'DELETE');
    revalidatePath('/sabwa/groups/categories');
    return { ok: true };
  } catch (err) {
    return engineFailure('deleteGroupCategory', err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// === Broadcasts & bulk ===
// ═══════════════════════════════════════════════════════════════════════════

/** Create a WhatsApp broadcast list (1:1 fan-out, no cross-visibility). */
export async function createBroadcastList(
  sessionId: IdLike,
  name: string,
  recipients: string[],
): Promise<SabwaActionResult<{ broadcastId: string }>> {
  const sid = idStr(sessionId);
  if (!sid || !name || !recipients?.length) {
    return { ok: false, error: 'sessionId, name, and recipients are required.' };
  }
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    const res = await engineSend<{ broadcastId: string }>('/v1/broadcasts', 'POST', {
      sessionId: sid,
      name,
      recipients,
    });
    revalidatePath('/sabwa/broadcasts');
    return { ok: true, broadcastId: res.broadcastId };
  } catch (err) {
    return engineFailure('createBroadcastList', err);
  }
}

/** Send a payload through an existing broadcast list. */
export async function sendBroadcast(
  sessionId: IdLike,
  broadcastId: IdLike,
  payload: SabwaScheduledPayload,
): Promise<SabwaActionResult<{ jobId: string }>> {
  const sid = idStr(sessionId);
  const bid = idStr(broadcastId);
  if (!sid || !bid || !payload) {
    return { ok: false, error: 'sessionId, broadcastId, and payload are required.' };
  }
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    const res = await engineSend<{ jobId: string }>(
      `/v1/broadcasts/${encodeURIComponent(bid)}/send`,
      'POST',
      { sessionId: sid, payload },
    );
    revalidatePath('/sabwa/broadcasts');
    void recordFlowAction('sabwa.broadcast.sent', {
      userId: auth.userId,
      target: bid,
      metadata: { sessionId: sid, jobId: res.jobId },
    });
    return { ok: true, jobId: res.jobId };
  } catch (err) {
    return engineFailure('sendBroadcast', err);
  }
}

/** Start a bulk-sender campaign with rate-limit + anti-ban controls. */
export async function startBulkCampaign(
  sessionId: IdLike,
  campaign: SabwaBulkCampaignDraft,
): Promise<SabwaActionResult<{ campaignId: string }>> {
  const sid = idStr(sessionId);
  if (!sid || !campaign?.name || !campaign?.payload || !campaign?.recipients?.length) {
    return { ok: false, error: 'sessionId, name, payload, and recipients are required.' };
  }
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    const res = await engineSend<{ campaignId: string }>('/v1/bulk', 'POST', {
      sessionId: sid,
      ...campaign,
    });
    revalidatePath('/sabwa/bulk');
    return { ok: true, campaignId: res.campaignId };
  } catch (err) {
    return engineFailure('startBulkCampaign', err);
  }
}

// bulkCampaignOp — shared helper for pause/resume/abort routes.
async function bulkCampaignOp(
  campaignId: IdLike,
  op: 'pause' | 'resume' | 'abort',
  scope: string,
): Promise<SabwaActionResult> {
  const id = idStr(campaignId);
  if (!id) return { ok: false, error: 'campaignId is required.' };
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    await engineSend(
      `/v1/bulk/${encodeURIComponent(id)}/${encodeURIComponent(op)}`,
      'POST',
    );
    revalidatePath('/sabwa/bulk');
    if (op === 'abort') {
      void recordFlowAction('sabwa.broadcast.cancelled', {
        userId: auth.userId,
        target: id,
        metadata: { op },
      });
    }
    return { ok: true };
  } catch (err) {
    return engineFailure(scope, err);
  }
}

/** Pause a running bulk campaign (resumable). */
export async function pauseBulkCampaign(
  campaignId: IdLike,
): Promise<SabwaActionResult> {
  return bulkCampaignOp(campaignId, 'pause', 'pauseBulkCampaign');
}

/** Permanently abort a bulk campaign — pending recipients are skipped. */
export async function abortBulkCampaign(
  campaignId: IdLike,
): Promise<SabwaActionResult> {
  return bulkCampaignOp(campaignId, 'abort', 'abortBulkCampaign');
}

/** Resume a previously-paused bulk campaign. */
export async function resumeBulkCampaign(
  campaignId: IdLike,
): Promise<SabwaActionResult> {
  return bulkCampaignOp(campaignId, 'resume', 'resumeBulkCampaign');
}

// ═══════════════════════════════════════════════════════════════════════════
// === Scheduler ===
// ═══════════════════════════════════════════════════════════════════════════

/** Schedule a one-off or recurring message for later delivery. */
export async function scheduleMessage(
  sessionId: IdLike,
  draft: SabwaScheduledDraft,
): Promise<SabwaActionResult<{ scheduledId: string }>> {
  const sid = idStr(sessionId);
  if (!sid || !draft?.payload || !draft?.targets?.length) {
    return { ok: false, error: 'sessionId, targets, and payload are required.' };
  }
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    const res = await engineSend<{ scheduledId: string }>('/v1/scheduled', 'POST', {
      sessionId: sid,
      ...draft,
    });
    revalidatePath('/sabwa/scheduler');
    revalidatePath('/sabwa/scheduler/queue');
    return { ok: true, scheduledId: res.scheduledId };
  } catch (err) {
    return engineFailure('scheduleMessage', err);
  }
}

/** Update fields on an existing scheduled message (target, payload, time). */
export async function updateScheduledMessage(
  scheduledId: IdLike,
  patch: Partial<SabwaScheduledDraft>,
): Promise<SabwaActionResult> {
  const id = idStr(scheduledId);
  if (!id) return { ok: false, error: 'scheduledId is required.' };
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    await engineSend(`/v1/scheduled/${encodeURIComponent(id)}`, 'PATCH', patch);
    revalidatePath('/sabwa/scheduler');
    revalidatePath('/sabwa/scheduler/queue');
    return { ok: true };
  } catch (err) {
    return engineFailure('updateScheduledMessage', err);
  }
}

/** Cancel a scheduled message before it fires. */
export async function cancelScheduledMessage(
  scheduledId: IdLike,
): Promise<SabwaActionResult> {
  const id = idStr(scheduledId);
  if (!id) return { ok: false, error: 'scheduledId is required.' };
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    await engineSend(`/v1/scheduled/${encodeURIComponent(id)}`, 'DELETE');
    revalidatePath('/sabwa/scheduler');
    revalidatePath('/sabwa/scheduler/queue');
    return { ok: true };
  } catch (err) {
    return engineFailure('cancelScheduledMessage', err);
  }
}

/** List scheduled messages for a session, filtered by status / target. */
export async function listScheduledMessages(
  sessionId: IdLike,
  filter: SabwaScheduledListFilter = {},
): Promise<
  SabwaActionResult<{ items: SabwaScheduled[]; nextCursor?: string }>
> {
  const sid = idStr(sessionId);
  if (!sid) return { ok: false, error: 'sessionId is required.' };
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    const res = await engineGet<{ items: SabwaScheduled[]; nextCursor?: string }>(
      `/v1/scheduled${buildQs({
        sessionId: sid,
        status: filter.status,
        jid: filter.jid,
        from: filter.from,
        to: filter.to,
        limit: filter.limit,
        cursor: filter.cursor,
      })}`,
      { treatNotFoundAsEmpty: true },
    );
    if (!res) return { ok: true, items: [] };
    return { ok: true, items: res.items ?? [], nextCursor: res.nextCursor };
  } catch (err) {
    return engineFailure('listScheduledMessages', err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// === Contacts ===
// ═══════════════════════════════════════════════════════════════════════════

interface ListContactsArgs {
  sessionId: IdLike;
  search?: string;
  tag?: string;
  source?: 'synced' | 'manual' | 'imported';
  limit?: number;
  cursor?: string;
}

/** List contacts cached for a session, with optional search + tag filters. */
export async function listContacts(
  args: ListContactsArgs,
): Promise<SabwaActionResult<{ contacts: SabwaContact[]; nextCursor?: string }>> {
  try {
    const qs = new URLSearchParams({ sessionId: String(args.sessionId) });
    if (args.search) qs.set('search', args.search);
    if (args.tag) qs.set('tag', args.tag);
    if (args.source) qs.set('source', args.source);
    if (args.limit) qs.set('limit', String(args.limit));
    if (args.cursor) qs.set('cursor', args.cursor);
    const data = await engineFetch<{
      contacts: SabwaContact[];
      nextCursor?: string;
    }>(`/v1/contacts?${qs.toString()}`);
    return {
      ok: true,
      contacts: data.contacts ?? [],
      nextCursor: data.nextCursor,
    };
  } catch (err) {
    if (err instanceof SabwaEngineError) return { ok: false, error: err.message };
    return { ok: true, contacts: [] };
  }
}

interface GetContactArgs {
  sessionId: IdLike;
  jid: string;
}

/** Fetch a single contact's full record. */
export async function getContact(
  args: GetContactArgs,
): Promise<SabwaActionResult<{ contact: SabwaContact | null }>> {
  try {
    const qs = new URLSearchParams({ sessionId: String(args.sessionId) });
    const data = await engineFetch<{ contact: SabwaContact | null }>(
      `/v1/contacts/${encodeURIComponent(args.jid)}?${qs.toString()}`,
    );
    return { ok: true, contact: data.contact ?? null };
  } catch (err) {
    if (err instanceof SabwaEngineError) return { ok: false, error: err.message };
    return { ok: true, contact: null };
  }
}

interface UpdateContactArgs {
  sessionId: IdLike;
  jid: string;
  patch: Partial<
    Pick<
      SabwaContact,
      'name' | 'tags' | 'notes' | 'customFields' | 'isBlocked'
    >
  >;
}

/** Apply a patch to a contact's editable fields (name, tags, notes, …). */
export async function updateContact(
  args: UpdateContactArgs,
): Promise<SabwaActionResult> {
  try {
    await engineFetch(
      `/v1/contacts/${encodeURIComponent(args.jid)}`,
      {
        method: 'PATCH',
        json: { sessionId: String(args.sessionId), patch: args.patch },
      },
    );
    return { ok: true };
  } catch (err) {
    if (err instanceof SabwaEngineError) return { ok: false, error: err.message };
    return { ok: false, error: 'Failed to update contact' };
  }
}

/** Replace or append the tags attached to a contact. */
export async function upsertContactTags(
  sessionId: IdLike,
  jid: string,
  tags: string[],
  opts: { replace?: boolean } = {},
): Promise<SabwaActionResult> {
  const sid = idStr(sessionId);
  if (!sid || !jid) {
    return { ok: false, error: 'sessionId and jid are required.' };
  }
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    await engineSend(`/v1/contacts/${encodeURIComponent(jid)}/tags`, 'POST', {
      sessionId: sid,
      tags,
      replace: opts.replace ?? false,
    });
    revalidatePath('/sabwa/contacts');
    return { ok: true };
  } catch (err) {
    return engineFailure('upsertContactTags', err);
  }
}

/** Block a contact on WhatsApp from this session. */
export async function blockContact(
  sessionId: IdLike,
  jid: string,
): Promise<SabwaActionResult> {
  const sid = idStr(sessionId);
  if (!sid || !jid) {
    return { ok: false, error: 'sessionId and jid are required.' };
  }
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    await engineSend(`/v1/contacts/${encodeURIComponent(jid)}/block`, 'POST', {
      sessionId: sid,
    });
    revalidatePath('/sabwa/contacts');
    void recordFlowAction('sabwa.contact.blocked', {
      userId: auth.userId,
      target: jid,
      metadata: { sessionId: sid },
    });
    return { ok: true };
  } catch (err) {
    return engineFailure('blockContact', err);
  }
}

/** Unblock a previously blocked contact. */
export async function unblockContact(
  sessionId: IdLike,
  jid: string,
): Promise<SabwaActionResult> {
  const sid = idStr(sessionId);
  if (!sid || !jid) {
    return { ok: false, error: 'sessionId and jid are required.' };
  }
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    await engineSend(`/v1/contacts/${encodeURIComponent(jid)}/block`, 'DELETE', {
      sessionId: sid,
    });
    revalidatePath('/sabwa/contacts');
    void recordFlowAction('sabwa.contact.unblocked', {
      userId: auth.userId,
      target: jid,
      metadata: { sessionId: sid },
    });
    return { ok: true };
  } catch (err) {
    return engineFailure('unblockContact', err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// === Templates ===
// ═══════════════════════════════════════════════════════════════════════════

interface UpsertTemplateArgs {
  id?: IdLike;
  sessionId: IdLike;
  name: string;
  category?: string;
  body: string;
  variables?: string[];
  mediaSabFileId?: string;
}

/** List all message templates for a session. */
export async function listTemplates(
  sessionId: IdLike,
): Promise<SabwaActionResult<{ templates: SabwaTemplate[] }>> {
  try {
    const qs = new URLSearchParams({ sessionId: String(sessionId) });
    const data = await engineFetch<{ templates: SabwaTemplate[] }>(
      `/v1/templates?${qs.toString()}`,
      { treatNotFoundAsEmpty: true },
    );
    if (!data) return { ok: true, templates: [] };
    return { ok: true, templates: data.templates ?? [] };
  } catch (err) {
    if (err instanceof SabwaEngineError) return { ok: false, error: err.message };
    return { ok: true, templates: [] };
  }
}

/** Create or update a message template. */
export async function syncTemplates(
  sessionId: IdLike,
): Promise<SabwaActionResult<{ synced: number }>> {
  try {
    const data = await engineFetch<{ synced: number }>(`/v1/templates/sync`, {
      method: 'POST',
      json: { sessionId: String(sessionId) },
    });
    return { ok: true, synced: data.synced };
  } catch (err) {
    if (err instanceof SabwaEngineError) return { ok: false, error: err.message };
    return { ok: false, error: 'Failed to sync templates' };
  }
}

/** Upsert a message template. */
export async function upsertTemplate(
  args: UpsertTemplateArgs,
): Promise<SabwaActionResult<{ templateId: string }>> {
  try {
    const data = await engineFetch<{ templateId: string }>(`/v1/templates`, {
      method: 'POST',
      json: {
        ...args,
        sessionId: String(args.sessionId),
        id: args.id ? String(args.id) : undefined,
      },
    });
    return { ok: true, templateId: data.templateId };
  } catch (err) {
    if (err instanceof SabwaEngineError) return { ok: false, error: err.message };
    return { ok: false, error: 'Failed to save template' };
  }
}

/** Delete a message template. */
export async function deleteTemplate(
  id: IdLike,
): Promise<SabwaActionResult> {
  try {
    await engineFetch(`/v1/templates/${encodeURIComponent(String(id))}`, {
      method: 'DELETE',
    });
    return { ok: true };
  } catch (err) {
    if (err instanceof SabwaEngineError) return { ok: false, error: err.message };
    return { ok: false, error: 'Failed to delete template' };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// === Quick replies ===
// ═══════════════════════════════════════════════════════════════════════════

interface UpsertQuickReplyArgs {
  id?: IdLike;
  sessionId: IdLike;
  shortcut: string;
  body: string;
  mediaSabFileId?: string;
  enabled?: boolean;
}

/** List all slash-command quick replies for a session. */
export async function listQuickReplies(
  sessionId: IdLike,
): Promise<SabwaActionResult<{ quickReplies: SabwaQuickReply[] }>> {
  try {
    const qs = new URLSearchParams({ sessionId: String(sessionId) });
    const data = await engineFetch<{ quickReplies: SabwaQuickReply[] }>(
      `/v1/quick-replies?${qs.toString()}`,
      { treatNotFoundAsEmpty: true },
    );
    if (!data) return { ok: true, quickReplies: [] };
    return { ok: true, quickReplies: data.quickReplies ?? [] };
  } catch (err) {
    if (err instanceof SabwaEngineError) return { ok: false, error: err.message };
    return { ok: true, quickReplies: [] };
  }
}

/** Create or update a quick reply. */
export async function upsertQuickReply(
  args: UpsertQuickReplyArgs,
): Promise<SabwaActionResult<{ quickReplyId: string }>> {
  try {
    const data = await engineFetch<{ quickReplyId: string }>(
      `/v1/quick-replies`,
      {
        method: 'POST',
        json: {
          ...args,
          sessionId: String(args.sessionId),
          id: args.id ? String(args.id) : undefined,
        },
      },
    );
    return { ok: true, quickReplyId: data.quickReplyId };
  } catch (err) {
    if (err instanceof SabwaEngineError) return { ok: false, error: err.message };
    return { ok: false, error: 'Failed to save quick reply' };
  }
}

/** Delete a quick reply. */
export async function deleteQuickReply(
  id: IdLike,
): Promise<SabwaActionResult> {
  try {
    await engineFetch(`/v1/quick-replies/${encodeURIComponent(String(id))}`, {
      method: 'DELETE',
    });
    return { ok: true };
  } catch (err) {
    if (err instanceof SabwaEngineError) return { ok: false, error: err.message };
    return { ok: false, error: 'Failed to delete quick reply' };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// === Auto-replies ===
// ═══════════════════════════════════════════════════════════════════════════

interface UpsertAutoReplyArgs {
  id?: IdLike;
  sessionId: IdLike;
  name: string;
  enabled: boolean;
  priority?: number;
  triggers: SabwaAutoReplyTrigger[];
  actions: SabwaAutoReplyAction[];
}

/** List auto-reply rules for a session, in priority order. */
export async function listAutoReplies(
  sessionId: IdLike,
): Promise<SabwaActionResult<{ autoReplies: SabwaAutoReply[] }>> {
  try {
    const qs = new URLSearchParams({ sessionId: String(sessionId) });
    const data = await engineFetch<{ autoReplies: SabwaAutoReply[] }>(
      `/v1/auto-replies?${qs.toString()}`,
      { treatNotFoundAsEmpty: true },
    );
    if (!data) return { ok: true, autoReplies: [] };
    return { ok: true, autoReplies: data.autoReplies ?? [] };
  } catch (err) {
    if (err instanceof SabwaEngineError) return { ok: false, error: err.message };
    return { ok: true, autoReplies: [] };
  }
}

/** Create or update an auto-reply rule. */
export async function upsertAutoReply(
  args: UpsertAutoReplyArgs,
): Promise<SabwaActionResult<{ autoReplyId: string }>> {
  const auth = await requireAuth();
  try {
    const data = await engineFetch<{ autoReplyId: string }>(
      `/v1/auto-replies`,
      {
        method: 'POST',
        json: {
          ...args,
          sessionId: String(args.sessionId),
          id: args.id ? String(args.id) : undefined,
        },
      },
    );
    if (auth.ok) {
      void recordFlowAction(
        args.id ? 'sabwa.automation.updated' : 'sabwa.automation.created',
        {
          userId: auth.userId,
          target: data.autoReplyId,
          metadata: { sessionId: String(args.sessionId) },
        },
      );
    }
    return { ok: true, autoReplyId: data.autoReplyId };
  } catch (err) {
    if (err instanceof SabwaEngineError) return { ok: false, error: err.message };
    return { ok: false, error: 'Failed to save auto-reply' };
  }
}

/** Delete an auto-reply rule. */
export async function deleteAutoReply(
  id: IdLike,
): Promise<SabwaActionResult> {
  const auth = await requireAuth();
  try {
    await engineFetch(`/v1/auto-replies/${encodeURIComponent(String(id))}`, {
      method: 'DELETE',
    });
    if (auth.ok) {
      void recordFlowAction('sabwa.automation.deleted', {
        userId: auth.userId,
        target: String(id),
      });
    }
    return { ok: true };
  } catch (err) {
    if (err instanceof SabwaEngineError) return { ok: false, error: err.message };
    return { ok: false, error: 'Failed to delete auto-reply' };
  }
}

/** Toggle an auto-reply rule on or off. */
export async function setAutoReplyEnabled(
  id: IdLike,
  enabled: boolean,
): Promise<SabwaActionResult> {
  const auth = await requireAuth();
  try {
    await engineFetch(
      `/v1/auto-replies/${encodeURIComponent(String(id))}/enabled`,
      { method: 'PATCH', json: { enabled } },
    );
    if (auth.ok) {
      void recordFlowAction('sabwa.automation.toggled', {
        userId: auth.userId,
        target: String(id),
        metadata: { enabled },
      });
    }
    return { ok: true };
  } catch (err) {
    if (err instanceof SabwaEngineError) return { ok: false, error: err.message };
    return { ok: false, error: 'Failed to toggle auto-reply' };
  }
}

/** Re-order auto-reply rules; first match wins. */
export async function reorderAutoReplies(
  sessionId: IdLike,
  orderedIds: IdLike[],
): Promise<SabwaActionResult> {
  try {
    await engineFetch(`/v1/auto-replies/reorder`, {
      method: 'POST',
      json: {
        sessionId: String(sessionId),
        orderedIds: orderedIds.map(String),
      },
    });
    return { ok: true };
  } catch (err) {
    if (err instanceof SabwaEngineError) return { ok: false, error: err.message };
    return { ok: false, error: 'Failed to reorder auto-replies' };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// === Labels ===
// ═══════════════════════════════════════════════════════════════════════════

interface SabwaLabelRow {
  id: string;
  name: string;
  color: string;
  chatCount?: number;
  createdAt?: string;
}

interface SabwaLabelUpsertInput {
  sessionId: IdLike;
  id?: string;
  name: string;
  color: string;
}

/** List all chat labels for a session. */
export async function listLabels(
  sessionId: IdLike,
): Promise<SabwaActionResult<{ labels: SabwaLabelRow[] }>> {
  const sid = idStr(sessionId);
  if (!sid) return { ok: false, error: 'sessionId is required.' };
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    const res = await engineGet<{ labels: SabwaLabelRow[] }>(
      `/v1/labels${buildQs({ sessionId: sid })}`,
      { treatNotFoundAsEmpty: true },
    );
    if (!res) return { ok: true, labels: [] };
    return { ok: true, labels: res.labels ?? [] };
  } catch (err) {
    return engineFailure('listLabels', err);
  }
}

/** Create or update a chat label. */
export async function upsertLabel(
  input: SabwaLabelUpsertInput,
): Promise<SabwaActionResult<{ label: SabwaLabelRow }>> {
  const sid = idStr(input?.sessionId);
  if (!sid || !input?.name || !input?.color) {
    return { ok: false, error: 'sessionId, name, and color are required.' };
  }
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    const { id, ...rest } = input;
    const body = { ...rest, sessionId: sid };
    const res = id
      ? await engineSend<{ label: SabwaLabelRow }>(
          `/v1/labels/${encodeURIComponent(id)}`,
          'PATCH',
          body,
        )
      : await engineSend<{ label: SabwaLabelRow }>('/v1/labels', 'POST', body);
    revalidatePath('/sabwa/labels');
    if (!id) {
      void recordFlowAction('sabwa.label.created', {
        userId: auth.userId,
        target: res.label?.id,
        metadata: { name: input.name, color: input.color, sessionId: sid },
      });
    }
    return { ok: true, label: res.label };
  } catch (err) {
    return engineFailure('upsertLabel', err);
  }
}

/** Delete a chat label (chats keep their tag references). */
export async function deleteLabel(
  id: string,
): Promise<SabwaActionResult> {
  if (!id) return { ok: false, error: 'id is required.' };
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    await engineSend(`/v1/labels/${encodeURIComponent(id)}`, 'DELETE');
    revalidatePath('/sabwa/labels');
    void recordFlowAction('sabwa.label.removed', {
      userId: auth.userId,
      target: id,
    });
    return { ok: true };
  } catch (err) {
    return engineFailure('deleteLabel', err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// === Starred messages ===
// ═══════════════════════════════════════════════════════════════════════════

interface SabwaStarredEntry {
  chatJid: string;
  chatName: string;
  message: SabwaMessage;
}

/** List every starred message in a session, across all chats. */
export async function listStarred(
  sessionId: IdLike,
): Promise<SabwaActionResult<{ items: SabwaStarredEntry[] }>> {
  const sid = idStr(sessionId);
  if (!sid) return { ok: false, error: 'sessionId is required.' };
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    const res = await engineGet<{ items: SabwaStarredEntry[] }>(
      `/v1/messages/starred${buildQs({ sessionId: sid })}`,
    );
    return { ok: true, items: res.items ?? [] };
  } catch (err) {
    return engineFailure('listStarred', err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// === AI ===
// ═══════════════════════════════════════════════════════════════════════════

/** Generate `n` candidate replies for a chat using conversation context. */
export async function suggestReply(
  _sessionId: IdLike,
  _chatJid: string,
  _n: number = 3,
): Promise<SabwaActionResult<{ suggestions: string[] }>> {
  return { ok: false, error: 'This feature is coming soon.' };
}

/** Summarise the last `window` of messages in a chat. */
export async function summariseChat(
  _sessionId: IdLike,
  _chatJid: string,
  _window: '24h' | '7d' | 'all',
): Promise<SabwaActionResult<{ summary: string }>> {
  return { ok: false, error: 'This feature is coming soon.' };
}

/** Translate a single message into the target language. */
export async function translateMessage(
  _messageId: IdLike,
  _targetLang: string,
): Promise<SabwaActionResult<{ translation: string; detectedLang?: string }>> {
  return { ok: false, error: 'This feature is coming soon.' };
}

// ═══════════════════════════════════════════════════════════════════════════
// === Analytics ===
// ═══════════════════════════════════════════════════════════════════════════

type SabwaAnalyticsRange = '7d' | '30d' | '90d' | 'custom';

interface SabwaAnalyticsInput {
  sessionId: IdLike;
  range: SabwaAnalyticsRange;
  from?: Date | string;
  to?: Date | string;
}

interface SabwaAnalyticsKpis {
  todayIn: number;
  todayOut: number;
  medianResponseMs: number;
  scheduledHitRate: number; // 0..1
  aiCalls: number;
  banRiskScore: number; // 0..100
}

interface SabwaAnalyticsSeriesPoint {
  date: string; // ISO date (yyyy-mm-dd)
  in: number;
  out: number;
}

interface SabwaAnalyticsHistogramBin {
  bucket: string; // e.g. "0-30s"
  count: number;
}

interface SabwaAnalyticsTopContact {
  jid: string;
  name?: string;
  count: number;
}

interface SabwaAnalyticsHeatCell {
  day: number; // 0=Sun..6=Sat
  hour: number; // 0..23
  count: number;
}

interface SabwaAnalyticsHourBar {
  hour: number; // 0..23
  count: number;
}

interface SabwaAnalyticsAiDay {
  date: string;
  suggest: number;
  summarise: number;
  translate: number;
}

interface SabwaAnalyticsPayload {
  kpis: SabwaAnalyticsKpis;
  messagesByDay: SabwaAnalyticsSeriesPoint[];
  responseHistogram: SabwaAnalyticsHistogramBin[];
  topContacts: SabwaAnalyticsTopContact[];
  groupHeatmap: SabwaAnalyticsHeatCell[];
  hourlySendPattern: SabwaAnalyticsHourBar[];
  aiUsageByDay: SabwaAnalyticsAiDay[];
}

/** Aggregated analytics for the dashboard. */
export async function getAnalytics(
  input: SabwaAnalyticsInput,
): Promise<SabwaActionResult<{ analytics: SabwaAnalyticsPayload }>> {
  const emptyAnalytics: SabwaAnalyticsPayload = {
    kpis: {
      todayIn: 0,
      todayOut: 0,
      medianResponseMs: 0,
      scheduledHitRate: 0,
      aiCalls: 0,
      banRiskScore: 0,
    },
    messagesByDay: [],
    responseHistogram: [],
    topContacts: [],
    groupHeatmap: [],
    hourlySendPattern: [],
    aiUsageByDay: [],
  };
  const sid = idStr(input?.sessionId);
  if (!sid) return { ok: true, analytics: emptyAnalytics };
  try {
    const res = await engineGet<{ analytics: SabwaAnalyticsPayload }>(
      `/v1/analytics${buildQs({
        sessionId: sid,
        range: input.range,
        from: input.from instanceof Date ? input.from : input.from,
        to: input.to instanceof Date ? input.to : input.to,
      })}`,
      { treatNotFoundAsEmpty: true },
    );
    if (!res) return { ok: true, analytics: emptyAnalytics };
    return { ok: true, analytics: res.analytics ?? emptyAnalytics };
  } catch (err) {
    if (err instanceof SabwaEngineError) {
      // Soft-fall back to empty payload so the dashboard still renders.
      return { ok: true, analytics: emptyAnalytics };
    }
    return engineFailure('getAnalytics', err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// === Exports ===
// ═══════════════════════════════════════════════════════════════════════════

type SabwaExportFormat = 'json' | 'csv' | 'txt' | 'pdf';
type SabwaExportStatus =
  | 'queued'
  | 'running'
  | 'ready'
  | 'failed'
  | 'expired';

interface SabwaExportScope {
  kind: 'all' | 'chats' | 'date_range';
  jids?: string[];
  from?: Date | string;
  to?: Date | string;
}

interface SabwaExportCreateInput {
  sessionId: IdLike;
  scope: SabwaExportScope;
  format: SabwaExportFormat;
  includeMedia?: boolean;
}

interface SabwaExportRow {
  id: string;
  format: SabwaExportFormat;
  status: SabwaExportStatus;
  sizeBytes?: number;
  downloadUrl?: string;
  expiresAt?: Date | string;
  scope: SabwaExportScope;
  includeMedia: boolean;
  createdAt: Date | string;
}

/** List past exports for a session. */
export async function listExports(
  sessionId: IdLike,
): Promise<SabwaActionResult<{ exports: SabwaExportRow[] }>> {
  const sid = idStr(sessionId);
  if (!sid) return { ok: false, error: 'sessionId is required.' };
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    const res = await engineGet<{ exports: SabwaExportRow[] }>(
      `/v1/exports${buildQs({ sessionId: sid })}`,
    );
    return { ok: true, exports: res.exports ?? [] };
  } catch (err) {
    return engineFailure('listExports', err);
  }
}

/** Create a new export job. */
export async function createExport(
  input: SabwaExportCreateInput,
): Promise<SabwaActionResult<{ exportId: string }>> {
  const sid = idStr(input?.sessionId);
  if (!sid || !input?.scope || !input?.format) {
    return { ok: false, error: 'sessionId, scope, and format are required.' };
  }
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    const res = await engineSend<{ exportId: string }>('/v1/exports', 'POST', {
      ...input,
      sessionId: sid,
    });
    revalidatePath('/sabwa/export');
    return { ok: true, exportId: res.exportId };
  } catch (err) {
    return engineFailure('createExport', err);
  }
}

/** Fetch a single export by id (used for polling status). */
export async function getExport(
  id: string,
): Promise<SabwaActionResult<{ export: SabwaExportRow }>> {
  if (!id) return { ok: false, error: 'id is required.' };
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    const res = await engineGet<{ export: SabwaExportRow }>(
      `/v1/exports/${encodeURIComponent(id)}`,
    );
    return { ok: true, export: res.export };
  } catch (err) {
    return engineFailure('getExport', err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// === Audit ===
// ═══════════════════════════════════════════════════════════════════════════

interface SabwaAuditEntryRow {
  id: string;
  ts: Date | string;
  actorEmail?: string;
  actorId?: string;
  action: string;
  target?: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

interface SabwaAuditQueryInput {
  sessionId?: IdLike;
  from?: Date | string;
  to?: Date | string;
  actionPrefix?: string;
  search?: string;
  limit?: number;
  cursor?: string;
}

/**
 * List audit-log entries with rich filters (session, date range, action
 * prefix, text search). Used by `/sabwa/audit`.
 */
export async function listAuditEntries(
  input: SabwaAuditQueryInput = {},
): Promise<
  SabwaActionResult<{ entries: SabwaAuditEntryRow[]; nextCursor?: string }>
> {
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    const res = await engineGet<{
      entries: SabwaAuditEntryRow[];
      nextCursor?: string;
    }>(
      `/v1/audit${buildQs({
        sessionId: input.sessionId ? idStr(input.sessionId) : undefined,
        from: input.from,
        to: input.to,
        actionPrefix: input.actionPrefix,
        search: input.search,
        limit: input.limit,
        cursor: input.cursor,
      })}`,
    );
    return { ok: true, entries: res.entries ?? [], nextCursor: res.nextCursor };
  } catch (err) {
    return engineFailure('listAuditEntries', err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// === Webhooks ===
// ═══════════════════════════════════════════════════════════════════════════

interface SabwaWebhookRow {
  id: string;
  projectId: string;
  sessionId?: string;
  url: string;
  events: SabwaWebhookEvent[];
  enabled: boolean;
  lastDeliveryAt?: Date | string;
  lastDeliveryStatus?: number;
  successRate?: number; // 0..1
  failureCount: number;
  createdAt: Date | string;
}

interface SabwaWebhookUpsertInput {
  projectId: IdLike;
  id?: string;
  url: string;
  events: SabwaWebhookEvent[];
  sessionId?: IdLike;
}

interface SabwaWebhookDelivery {
  id: string;
  webhookId: string;
  event: SabwaWebhookEvent;
  attempt: number;
  statusCode?: number;
  latencyMs?: number;
  responseExcerpt?: string;
  error?: string;
  ts: Date | string;
}

/** List webhooks for a project. */
export async function listWebhooks(
  projectId: IdLike,
): Promise<SabwaActionResult<{ webhooks: SabwaWebhookRow[] }>> {
  const pid = idStr(projectId);
  if (!pid) return { ok: false, error: 'projectId is required.' };
  const auth = await requireProject(pid);
  if (!auth.ok) return auth;
  try {
    const res = await engineGet<{ webhooks: SabwaWebhookRow[] }>(
      `/v1/webhooks${buildQs({ projectId: pid })}`,
      { treatNotFoundAsEmpty: true },
    );
    if (!res) return { ok: true, webhooks: [] };
    return { ok: true, webhooks: res.webhooks ?? [] };
  } catch (err) {
    return engineFailure('listWebhooks', err);
  }
}

/**
 * Create or update a webhook. When creating, a one-time `signingSecret`
 * is returned — callers MUST display it once and warn the user it won't
 * be shown again.
 */
export async function upsertWebhook(
  input: SabwaWebhookUpsertInput,
): Promise<
  SabwaActionResult<{ webhookId: string; signingSecret?: string }>
> {
  const pid = idStr(input?.projectId);
  if (!pid || !input?.url || !input?.events?.length) {
    return { ok: false, error: 'projectId, url, and events are required.' };
  }
  const auth = await requireProject(pid);
  if (!auth.ok) return auth;
  try {
    const { id, ...rest } = input;
    const body = {
      ...rest,
      projectId: pid,
      sessionId: rest.sessionId ? idStr(rest.sessionId) : undefined,
    };
    const res = id
      ? await engineSend<{ webhookId: string; signingSecret?: string }>(
          `/v1/webhooks/${encodeURIComponent(id)}`,
          'PATCH',
          body,
        )
      : await engineSend<{ webhookId: string; signingSecret?: string }>(
          '/v1/webhooks',
          'POST',
          body,
        );
    revalidatePath('/sabwa/webhooks');
    return { ok: true, webhookId: res.webhookId, signingSecret: res.signingSecret };
  } catch (err) {
    return engineFailure('upsertWebhook', err);
  }
}

/** Remove an outbound webhook. */
export async function deleteWebhook(
  webhookId: IdLike,
): Promise<SabwaActionResult> {
  const wid = idStr(webhookId);
  if (!wid) return { ok: false, error: 'webhookId is required.' };
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    await engineSend(`/v1/webhooks/${encodeURIComponent(wid)}`, 'DELETE');
    revalidatePath('/sabwa/webhooks');
    return { ok: true };
  } catch (err) {
    return engineFailure('deleteWebhook', err);
  }
}

/** Fire a synthetic event at the webhook to verify reachability. */
export async function testWebhook(
  webhookId: IdLike,
): Promise<SabwaActionResult<{ statusCode: number; latencyMs: number }>> {
  const wid = idStr(webhookId);
  if (!wid) return { ok: false, error: 'webhookId is required.' };
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    const res = await engineSend<{ statusCode: number; latencyMs: number }>(
      `/v1/webhooks/${encodeURIComponent(wid)}/test`,
      'POST',
    );
    return { ok: true, statusCode: res.statusCode, latencyMs: res.latencyMs };
  } catch (err) {
    return engineFailure('testWebhook', err);
  }
}

/** List recent deliveries for a webhook. */
export async function listWebhookDeliveries(
  input: { webhookId: IdLike; limit?: number },
): Promise<SabwaActionResult<{ deliveries: SabwaWebhookDelivery[] }>> {
  const wid = idStr(input?.webhookId);
  if (!wid) return { ok: false, error: 'webhookId is required.' };
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    const res = await engineGet<{ deliveries: SabwaWebhookDelivery[] }>(
      `/v1/webhooks/${encodeURIComponent(wid)}/deliveries${buildQs({ limit: input.limit })}`,
    );
    return { ok: true, deliveries: res.deliveries ?? [] };
  } catch (err) {
    return engineFailure('listWebhookDeliveries', err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// === API keys ===
// ═══════════════════════════════════════════════════════════════════════════

type SabwaApiKeyStatus = 'active' | 'revoked' | 'expired';

interface SabwaApiKeyRow {
  id: string;
  projectId: string;
  prefix: string; // e.g. "sk_live_AB12…"
  scopes: string[];
  status: SabwaApiKeyStatus;
  lastUsedAt?: Date | string;
  expiresAt?: Date | string;
  createdAt: Date | string;
}

interface SabwaApiKeyCreateInput {
  projectId: IdLike;
  scopes: string[];
  expiresAt?: Date | string;
}

/** List API keys for a project. */
export async function listApiKeys(
  projectId: IdLike,
): Promise<SabwaActionResult<{ apiKeys: SabwaApiKeyRow[] }>> {
  const pid = idStr(projectId);
  if (!pid) return { ok: false, error: 'projectId is required.' };
  const auth = await requireProject(pid);
  if (!auth.ok) return auth;
  try {
    const res = await engineGet<{ apiKeys: SabwaApiKeyRow[] }>(
      `/v1/api-keys${buildQs({ projectId: pid })}`,
      { treatNotFoundAsEmpty: true },
    );
    if (!res) return { ok: true, apiKeys: [] };
    return { ok: true, apiKeys: res.apiKeys ?? [] };
  } catch (err) {
    return engineFailure('listApiKeys', err);
  }
}

/**
 * Create a new SabWa REST API key — plaintext is returned ONCE.
 * Callers MUST display the full key once and warn the user.
 */
export async function createApiKey(
  input: SabwaApiKeyCreateInput,
): Promise<SabwaActionResult<{ apiKeyId: string; apiKey: string }>> {
  const pid = idStr(input?.projectId);
  if (!pid || !Array.isArray(input?.scopes)) {
    return { ok: false, error: 'projectId and scopes are required.' };
  }
  const auth = await requireProject(pid);
  if (!auth.ok) return auth;
  try {
    const res = await engineSend<{ apiKeyId: string; apiKey: string }>(
      '/v1/api-keys',
      'POST',
      { ...input, projectId: pid },
    );
    revalidatePath('/sabwa/api-keys');
    return { ok: true, apiKeyId: res.apiKeyId, apiKey: res.apiKey };
  } catch (err) {
    return engineFailure('createApiKey', err);
  }
}

/** Revoke an existing SabWa API key. */
export async function revokeApiKey(
  apiKeyId: IdLike,
): Promise<SabwaActionResult> {
  const id = idStr(apiKeyId);
  if (!id) return { ok: false, error: 'apiKeyId is required.' };
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    await engineSend(`/v1/api-keys/${encodeURIComponent(id)}/revoke`, 'POST');
    revalidatePath('/sabwa/api-keys');
    return { ok: true };
  } catch (err) {
    return engineFailure('revokeApiKey', err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// === Settings ===
// ═══════════════════════════════════════════════════════════════════════════

interface SabwaProfile {
  pushName?: string;
  about?: string;
  profilePicSabFileId?: string;
  profilePicUrl?: string;
  phoneE164?: string;
  status?: SabwaSessionStatus;
  lastConnectedAt?: string;
  deviceMeta?: SabwaDeviceMeta;
}

/** Fetch the WhatsApp profile (push name / about / picture) for a session. */
export async function getProfile(
  sessionId: IdLike,
): Promise<SabwaActionResult<{ profile: SabwaProfile }>> {
  const sid = idStr(sessionId);
  if (!sid) return { ok: false, error: 'sessionId is required.' };
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    const res = await engineGet<{ profile: SabwaProfile }>(
      `/v1/sessions/${encodeURIComponent(sid)}/profile`,
    );
    return { ok: true, profile: res.profile };
  } catch (err) {
    return engineFailure('getProfile', err);
  }
}

/** Update the WhatsApp profile (push name / about / picture) of a session. */
export async function updateProfile(
  input: {
    sessionId: IdLike;
    patch: { pushName?: string; about?: string; profilePicSabFileId?: string };
  },
): Promise<SabwaActionResult> {
  const sid = idStr(input?.sessionId);
  if (!sid || !input?.patch) {
    return { ok: false, error: 'sessionId and patch are required.' };
  }
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    await engineSend(
      `/v1/sessions/${encodeURIComponent(sid)}/profile`,
      'PATCH',
      input.patch,
    );
    revalidatePath('/sabwa/settings');
    return { ok: true };
  } catch (err) {
    return engineFailure('updateProfile', err);
  }
}

/** Force a refetch of the WhatsApp profile from the device into SabNode. */
export async function syncProfileFromDevice(
  sessionId: IdLike,
): Promise<SabwaActionResult<{ profile: SabwaProfile }>> {
  const sid = idStr(sessionId);
  if (!sid) return { ok: false, error: 'sessionId is required.' };
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    const res = await engineSend<{ profile: SabwaProfile }>(
      `/v1/sessions/${encodeURIComponent(sid)}/profile/sync`,
      'POST',
    );
    revalidatePath('/sabwa/settings');
    return { ok: true, profile: res.profile };
  } catch (err) {
    return engineFailure('syncProfileFromDevice', err);
  }
}

/** Change the anti-ban rate-limit profile for a session. */
export async function setRateLimitProfile(
  input: {
    sessionId: IdLike;
    profile: SabwaRateLimitProfile;
    warmupEnabled?: boolean;
    dailyResetTimezone?: string;
    overrides?: Record<string, number>;
  },
): Promise<SabwaActionResult> {
  const sid = idStr(input?.sessionId);
  if (!sid || !input?.profile) {
    return { ok: false, error: 'sessionId and profile are required.' };
  }
  if (!['safe', 'normal', 'aggressive'].includes(input.profile)) {
    return { ok: false, error: 'profile must be safe | normal | aggressive.' };
  }
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    await engineSend(`/v1/sessions/${encodeURIComponent(sid)}`, 'PATCH', {
      rateLimitProfile: input.profile,
      warmupEnabled: input.warmupEnabled,
      dailyResetTimezone: input.dailyResetTimezone,
      overrides: input.overrides,
    });
    revalidatePath('/sabwa/settings/rate-limits');
    return { ok: true };
  } catch (err) {
    return engineFailure('setRateLimitProfile', err);
  }
}

/** Enable or disable the 7-day warmup ramp for a session. */
export async function setWarmupEnabled(
  sessionId: IdLike,
  enabled: boolean,
): Promise<SabwaActionResult> {
  const sid = idStr(sessionId);
  if (!sid) return { ok: false, error: 'sessionId is required.' };
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    await engineSend(`/v1/sessions/${encodeURIComponent(sid)}`, 'PATCH', {
      warmupEnabled: enabled,
    });
    revalidatePath('/sabwa/settings/rate-limits');
    return { ok: true };
  } catch (err) {
    return engineFailure('setWarmupEnabled', err);
  }
}

interface SabwaRateLimitSettings {
  profile: SabwaRateLimitProfile;
  warmupEnabled: boolean;
  dailyResetTimezone: string;
  overrides: Record<string, number>;
  sessionAgeDays?: number;
}

export async function getRateLimitProfile(
  sessionId: IdLike,
): Promise<SabwaActionResult<{ settings: SabwaRateLimitSettings }>> {
  const sid = idStr(sessionId);
  if (!sid) return { ok: false, error: 'sessionId is required.' };
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    const res = await engineGet<{ settings: SabwaRateLimitSettings }>(
      `/v1/sessions/${encodeURIComponent(sid)}/rate-limits`,
    );
    return { ok: true, settings: res.settings };
  } catch (err) {
    return engineFailure('getRateLimitProfile', err);
  }
}

// ─── Privacy & security ────────────────────────────────────────────────────

type SabwaVisibility = 'everyone' | 'contacts' | 'nobody';

interface SabwaPrivacySettings {
  twoFactorEnabled: boolean;
  readReceipts: boolean;
  lastSeen: SabwaVisibility;
  groupAddPolicy: SabwaVisibility;
  profilePicVisibility: SabwaVisibility;
  statusVisibility: SabwaVisibility;
  blocked: Array<{ jid: string; name?: string; blockedAt?: string }>;
  disappearingTimer?: number;
}

/** Fetch privacy & security settings for a session. */
export async function getPrivacySettings(
  sessionId: IdLike,
): Promise<SabwaActionResult<{ settings: SabwaPrivacySettings }>> {
  const sid = idStr(sessionId);
  if (!sid) return { ok: false, error: 'sessionId is required.' };
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    const res = await engineGet<{ settings: SabwaPrivacySettings }>(
      `/v1/sessions/${encodeURIComponent(sid)}/privacy`,
    );
    return { ok: true, settings: res.settings };
  } catch (err) {
    return engineFailure('getPrivacySettings', err);
  }
}

/** Patch privacy & security settings for a session. Proxies `/v1/sessions/:id/privacy`. */
export async function updatePrivacySettings(
  input: {
    sessionId: IdLike;
    patch: Partial<Omit<SabwaPrivacySettings, 'blocked'>> & {
      twoFactorPin?: string;
    };
  },
): Promise<SabwaActionResult> {
  const sid = idStr(input?.sessionId);
  if (!sid || !input?.patch) {
    return { ok: false, error: 'sessionId and patch are required.' };
  }
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    await engineSend(
      `/v1/sessions/${encodeURIComponent(sid)}/privacy`,
      'PATCH',
      input.patch,
    );
    revalidatePath('/sabwa/settings/privacy');
    return { ok: true };
  } catch (err) {
    return engineFailure('updatePrivacySettings', err);
  }
}

/** Rotate the SabNode-side encryption key wrapping the session auth state. */
export async function rotateSessionKey(
  sessionId: IdLike,
): Promise<SabwaActionResult<{ rotatedAt: string }>> {
  const sid = idStr(sessionId);
  if (!sid) return { ok: false, error: 'sessionId is required.' };
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    const res = await engineSend<{ rotatedAt: string }>(
      `/v1/sessions/${encodeURIComponent(sid)}/key/rotate`,
      'POST',
    );
    return { ok: true, rotatedAt: res.rotatedAt };
  } catch (err) {
    return engineFailure('rotateSessionKey', err);
  }
}

// ─── Notifications ─────────────────────────────────────────────────────────

type SabwaDigestFrequency = 'daily' | 'weekly';

interface SabwaMuteWindow {
  id: string;
  label?: string;
  start: string; // "HH:mm"
  end: string;   // "HH:mm"
  days: number[]; // 0..6 (Sun..Sat)
}

interface SabwaNotificationPrefs {
  desktop: { enabled: boolean; sound: string };
  email: { enabled: boolean; frequency: SabwaDigestFrequency; recipients: string[] };
  push: { enabled: boolean };
  incomingSound: string;
  muteSchedules: SabwaMuteWindow[];
  events?: {
    groupMentions: boolean;
    directMessages: boolean;
    systemAlerts: boolean;
  };
}

/** Fetch notification preferences for a SabWa project. */
export async function getNotificationPrefs(
  projectId: IdLike,
): Promise<SabwaActionResult<{ prefs: SabwaNotificationPrefs }>> {
  const pid = idStr(projectId);
  if (!pid) return { ok: false, error: 'projectId is required.' };
  const auth = await requireProject(pid);
  if (!auth.ok) return auth;
  try {
    const res = await engineGet<{ prefs: SabwaNotificationPrefs }>(
      `/v1/projects/${encodeURIComponent(pid)}/notifications`,
    );
    return { ok: true, prefs: res.prefs };
  } catch (err) {
    return engineFailure('getNotificationPrefs', err);
  }
}

/** Patch notification preferences for a SabWa project. */
export async function updateNotificationPrefs(
  input: {
    projectId: IdLike;
    patch: Partial<SabwaNotificationPrefs>;
  },
): Promise<SabwaActionResult> {
  const pid = idStr(input?.projectId);
  if (!pid || !input?.patch) {
    return { ok: false, error: 'projectId and patch are required.' };
  }
  const auth = await requireProject(pid);
  if (!auth.ok) return auth;
  try {
    await engineSend(
      `/v1/projects/${encodeURIComponent(pid)}/notifications`,
      'PATCH',
      input.patch,
    );
    revalidatePath('/sabwa/settings/notifications');
    return { ok: true };
  } catch (err) {
    return engineFailure('updateNotificationPrefs', err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// === Canonical contract aliases (SABWA_PLAN.md §13) =========================
// ═══════════════════════════════════════════════════════════════════════════
//
// SABWA_PLAN.md §13 names some actions differently from the page-level
// shims declared above. The canonical names are exposed here so the plan's
// contract is honoured one-to-one; each wraps the implementation already
// wired against the Rust engine.

/** Fetch a single chat by jid. */
export async function getChat(input: {
  sessionId: IdLike;
  chatJid: string;
}): Promise<SabwaActionResult<{ chat: unknown }>> {
  const sid = idStr(input?.sessionId);
  if (!sid || !input?.chatJid) {
    return { ok: false, error: 'sessionId and chatJid are required.' };
  }
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    const res = await engineGet<{ chat: unknown }>(
      `/v1/chats/${encodeURIComponent(input.chatJid)}${buildQs({ sessionId: sid })}`,
    );
    return { ok: true, chat: res.chat };
  } catch (err) {
    return engineFailure('getChat', err);
  }
}

/** Canonical alias for `updateScheduledMessage`. */
export async function updateScheduled(input: {
  scheduledId: IdLike;
  patch: Partial<SabwaScheduledDraft>;
}): Promise<SabwaActionResult> {
  return updateScheduledMessage(input.scheduledId, input.patch);
}

/** Canonical alias for `cancelScheduledMessage`. */
export async function cancelScheduled(
  scheduledId: IdLike,
): Promise<SabwaActionResult> {
  return cancelScheduledMessage(scheduledId);
}

/** List bulk campaigns for a session. */
export async function listBulkCampaigns(
  sessionId: IdLike,
): Promise<SabwaActionResult<{ campaigns: SabwaBroadcast[] }>> {
  const sid = idStr(sessionId);
  if (!sid) return { ok: false, error: 'sessionId is required.' };
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    const res = await engineGet<{ campaigns: SabwaBroadcast[] }>(
      `/v1/bulk${buildQs({ sessionId: sid })}`,
    );
    return { ok: true, campaigns: res.campaigns ?? [] };
  } catch (err) {
    return engineFailure('listBulkCampaigns', err);
  }
}

/** Pause / resume / abort a running bulk campaign. */
export async function controlBulkCampaign(input: {
  campaignId: IdLike;
  op: 'pause' | 'resume' | 'abort';
}): Promise<SabwaActionResult> {
  return bulkCampaignOp(input.campaignId, input.op, 'controlBulkCampaign');
}

/** Fetch a single bulk campaign's status + per-recipient progress. */
export async function getBulkCampaign(
  campaignId: IdLike,
): Promise<SabwaActionResult<{ campaign: SabwaBroadcast }>> {
  const id = idStr(campaignId);
  if (!id) return { ok: false, error: 'campaignId is required.' };
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    const res = await engineGet<{ campaign: SabwaBroadcast }>(
      `/v1/bulk/${encodeURIComponent(id)}`,
    );
    return { ok: true, campaign: res.campaign };
  } catch (err) {
    return engineFailure('getBulkCampaign', err);
  }
}

/** List broadcast lists for a session. */
export async function listBroadcasts(
  sessionId: IdLike,
): Promise<SabwaActionResult<{ broadcasts: SabwaBroadcast[] }>> {
  const sid = idStr(sessionId);
  if (!sid) return { ok: false, error: 'sessionId is required.' };
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    const res = await engineGet<{ broadcasts: SabwaBroadcast[] }>(
      `/v1/broadcasts${buildQs({ sessionId: sid })}`,
    );
    return { ok: true, broadcasts: res.broadcasts ?? [] };
  } catch (err) {
    return engineFailure('listBroadcasts', err);
  }
}

/** Create or update a broadcast list. POST if `id` is absent, PATCH otherwise. */
export async function upsertBroadcast(input: {
  sessionId: IdLike;
  id?: string;
  name: string;
  recipients: string[];
}): Promise<SabwaActionResult<{ broadcastId: string }>> {
  const sid = idStr(input?.sessionId);
  if (!sid || !input?.name || !Array.isArray(input?.recipients)) {
    return { ok: false, error: 'sessionId, name, and recipients are required.' };
  }
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    const body = { sessionId: sid, name: input.name, recipients: input.recipients };
    const res = input.id
      ? await engineSend<{ broadcastId: string }>(
          `/v1/broadcasts/${encodeURIComponent(input.id)}`,
          'PATCH',
          body,
        )
      : await engineSend<{ broadcastId: string }>('/v1/broadcasts', 'POST', body);
    revalidatePath('/sabwa/broadcasts');
    return { ok: true, broadcastId: res.broadcastId };
  } catch (err) {
    return engineFailure('upsertBroadcast', err);
  }
}

/** Delete a broadcast list. */
export async function deleteBroadcast(id: IdLike): Promise<SabwaActionResult> {
  const bid = idStr(id);
  if (!bid) return { ok: false, error: 'broadcast id is required.' };
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    await engineSend(`/v1/broadcasts/${encodeURIComponent(bid)}`, 'DELETE');
    revalidatePath('/sabwa/broadcasts');
    return { ok: true };
  } catch (err) {
    return engineFailure('deleteBroadcast', err);
  }
}

// ─── SabWa-only projects ────────────────────────────────────────────────────
//
// Every SabWa-linked WhatsApp number is bound to a SabNode project, but
// SabWa workspaces are kept **distinct** from WaChat / Meta / CRM /
// Telegram projects (no cross-module spillover in the picker). A project
// created from /sabwa carries `kind: 'sabwa'` so:
//   - the SabWa picker (/sabwa) only shows projects with `kind === 'sabwa'`
//     OR already linked SabWa sessions (legacy migration safety),
//   - other modules' pickers exclude it (mirrors the Telegram pattern).
//
// See `addTelegramProject` for the analogous flow.

interface AddSabwaProjectResult {
  projectId: string;
  name: string;
}

export async function addSabwaProject(input: {
  name: string;
}): Promise<SabwaActionResult<AddSabwaProjectResult>> {
  try {
    const name = input.name?.trim();
    if (!name) return { ok: false, error: 'Project name is required.' };
    if (name.length > 120) {
      return {
        ok: false,
        error: 'Project name is too long (max 120 chars).',
      };
    }

    const session = await getSession();
    if (!session?.user) {
      return { ok: false, error: 'Not authenticated.' };
    }

    const { db } = await connectToDatabase();
    const userId = new MongoObjectId(session.user._id as string);
    const now = new Date();

    // Soft duplicate guard — same owner + same name.
    const existing = await db
      .collection('projects')
      .findOne({ userId, name }, { projection: { _id: 1 } });
    if (existing) {
      return {
        ok: false,
        error: 'You already have a project with that name.',
      };
    }

    const ins = await db.collection('projects').insertOne({
      userId,
      name,
      accessToken: '',
      phoneNumbers: [],
      // Discriminator — other modules' pickers (Wachat, Facebook, CRM,
      // Telegram) skip this workspace, and the SabWa picker shows it
      // even before any session is paired.
      kind: 'sabwa',
      createdAt: now,
    } as never);

    revalidatePath('/sabwa');
    return {
      ok: true,
      projectId: ins.insertedId.toString(),
      name,
    };
  } catch (err) {
    return { ok: false, error: getErrorMessage(err) };
  }
}

/** Issue a short-lived token the browser uses for the SSE realtime stream. */
export async function getStreamToken(
  sessionId: IdLike,
): Promise<SabwaActionResult<{ token: string; expiresAt: string }>> {
  const sid = idStr(sessionId);
  if (!sid) return { ok: false, error: 'sessionId is required.' };
  const auth = await requireAuth();
  if (!auth.ok) return auth;
  try {
    const res = await engineSend<{ token: string; expiresAt: string }>(
      '/v1/realtime/token',
      'POST',
      { sessionId: sid },
    );
    return { ok: true, token: res.token, expiresAt: res.expiresAt };
  } catch (err) {
    return engineFailure('getStreamToken', err);
  }
}


// ─── STATUSES ───────────────────────────────────────────────────────────────

export async function listMyStatuses(sessionId: IdLike): Promise<SabwaActionResult<any[]>> {
  try {
    const { auth } = await import('@/lib/crm-auth');
    const user = await auth();
    if (!user) throw new Error('Unauthorized');

    const { connectToDatabase } = await import('@/lib/mongodb');
    const { db } = await connectToDatabase();
    
    const sid = typeof sessionId === 'string' ? new (require('mongodb').ObjectId)(sessionId) : sessionId;
    
    const statuses = await db.collection('sabwa_statuses').find({
      projectId: user.projectId,
      sessionId: sid,
    }).sort({ ts: -1 }).toArray();

    return { ok: true, data: JSON.parse(JSON.stringify(statuses)) };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

export async function postMyStatus(sessionId: IdLike, data: any): Promise<SabwaActionResult<any>> {
  try {
    const { auth } = await import('@/lib/crm-auth');
    const user = await auth();
    if (!user) throw new Error('Unauthorized');

    const { connectToDatabase } = await import('@/lib/mongodb');
    const { db } = await connectToDatabase();
    
    const sid = typeof sessionId === 'string' ? new (require('mongodb').ObjectId)(sessionId) : sessionId;

    const doc = {
      projectId: user.projectId,
      sessionId: sid,
      kind: data.kind,
      body: data.body,
      bgColour: data.bgColour,
      mediaUrl: data.mediaUrl,
      mediaName: data.mediaName,
      audience: data.audience,
      viewers: [],
      reposters: [],
      ts: new Date(),
    };

    const res = await db.collection('sabwa_statuses').insertOne(doc);
    const newDoc = { ...doc, _id: res.insertedId };
    
    return { ok: true, data: JSON.parse(JSON.stringify(newDoc)) };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}
