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
import type {
  SabwaAutoReply,
  SabwaBroadcast,
  SabwaChatType,
  SabwaContact,
  SabwaMessage,
  SabwaPairMethod,
  SabwaRateLimitProfile,
  SabwaScheduled,
  SabwaScheduledPayload,
  SabwaSession,
  SabwaSessionStatus,
  SabwaTemplate,
  SabwaWebhookEvent,
} from '@/lib/sabwa/types';

// ─── Common result shape ────────────────────────────────────────────────────

export type SabwaActionResult<T extends object = Record<string, never>> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

const NOT_IMPLEMENTED = 'SabWa Phase 1 — not implemented yet';

// IdLike — server actions are called from client code where ObjectId is a
// string, but internally we treat both interchangeably.
type IdLike = string | ObjectId;

// ─── Shared payload shapes ──────────────────────────────────────────────────

export interface SabwaSendMessagePayload {
  type: SabwaScheduledPayload['type'];
  body?: string;
  mediaSabFileId?: string;
  caption?: string;
  quotedMessageId?: string;
  mentionJids?: string[];
}

export interface SabwaChatListFilter {
  type?: SabwaChatType;
  query?: string;
  unreadOnly?: boolean;
  archivedOnly?: boolean;
  labelId?: IdLike;
  limit?: number;
  cursor?: string;
}

export interface SabwaScheduledListFilter {
  status?: SabwaScheduled['status'];
  jid?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  cursor?: string;
}

export interface SabwaScheduledDraft {
  kind: SabwaScheduled['kind'];
  scheduledFor: Date | string;
  cron?: string;
  timezone: string;
  targets: SabwaScheduled['targets'];
  payload: SabwaScheduledPayload;
}

export interface SabwaBulkCampaignDraft {
  name: string;
  payload: SabwaScheduledPayload;
  recipients: string[]; // jids
  perMinute?: number;
  jitterSec?: number;
  variants?: SabwaScheduledPayload[];
}

export interface SabwaContactListFilter {
  query?: string;
  tag?: string;
  blocked?: boolean;
  limit?: number;
  cursor?: string;
}

export interface SabwaAuditListFilter {
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

/** Start a pairing flow for a new WhatsApp linked-device session. */
export async function pairSession(
  _projectId: IdLike,
  _method: SabwaPairMethod,
  _phone?: string,
): Promise<
  SabwaActionResult<{ sessionId: string; qr?: string; pairCode?: string }>
> {
  throw new Error(NOT_IMPLEMENTED);
}

/** Log out an active SabWa session and wipe its auth state. */
export async function logoutSession(
  _sessionId: IdLike,
): Promise<SabwaActionResult> {
  throw new Error(NOT_IMPLEMENTED);
}

/** Rename a session's user-facing label. */
export async function renameSession(
  _sessionId: IdLike,
  _label: string,
): Promise<SabwaActionResult> {
  throw new Error(NOT_IMPLEMENTED);
}

/** List all SabWa sessions belonging to a project. */
export async function listSessions(
  _projectId: IdLike,
): Promise<SabwaActionResult<{ sessions: SabwaSession[] }>> {
  throw new Error(NOT_IMPLEMENTED);
}

// ═══════════════════════════════════════════════════════════════════════════
// === Chats ===
// ═══════════════════════════════════════════════════════════════════════════

/** List chats for a session with optional filters and pagination. */
export async function listChats(
  _sessionId: IdLike,
  _filter: SabwaChatListFilter = {},
): Promise<SabwaActionResult<{ chats: unknown[]; nextCursor?: string }>> {
  throw new Error(NOT_IMPLEMENTED);
}

/** Fetch a window of messages for a chat using a cursor for pagination. */
export async function getChatMessages(
  _sessionId: IdLike,
  _jid: string,
  _cursor?: string,
): Promise<
  SabwaActionResult<{ messages: SabwaMessage[]; nextCursor?: string }>
> {
  throw new Error(NOT_IMPLEMENTED);
}

/** Send a message to a chat (text or media). */
export async function sendMessage(
  _sessionId: IdLike,
  _jid: string,
  _payload: SabwaSendMessagePayload,
): Promise<SabwaActionResult<{ messageId: string }>> {
  throw new Error(NOT_IMPLEMENTED);
}

/** Mark a chat as fully read (clear unread counter, send read receipts). */
export async function markRead(
  _sessionId: IdLike,
  _jid: string,
): Promise<SabwaActionResult> {
  throw new Error(NOT_IMPLEMENTED);
}

/** Pin or unpin a chat in the inbox. */
export async function pinChat(
  _sessionId: IdLike,
  _jid: string,
  _pinned: boolean,
): Promise<SabwaActionResult> {
  throw new Error(NOT_IMPLEMENTED);
}

/** Mute a chat for a given duration (in seconds) or unmute it. */
export async function muteChat(
  _sessionId: IdLike,
  _jid: string,
  _muteForSec: number | null,
): Promise<SabwaActionResult> {
  throw new Error(NOT_IMPLEMENTED);
}

/** Archive or unarchive a chat. */
export async function archiveChat(
  _sessionId: IdLike,
  _jid: string,
  _archived: boolean,
): Promise<SabwaActionResult> {
  throw new Error(NOT_IMPLEMENTED);
}

/** Delete a chat (optionally also clearing its messages). */
export async function deleteChat(
  _sessionId: IdLike,
  _jid: string,
  _opts: { clearMessages?: boolean } = {},
): Promise<SabwaActionResult> {
  throw new Error(NOT_IMPLEMENTED);
}

// ═══════════════════════════════════════════════════════════════════════════
// === Groups ===
// ═══════════════════════════════════════════════════════════════════════════

/** Create a new WhatsApp group with the given subject and initial members. */
export async function createGroup(
  _sessionId: IdLike,
  _subject: string,
  _participants: string[],
): Promise<SabwaActionResult<{ jid: string }>> {
  throw new Error(NOT_IMPLEMENTED);
}

/** Add participants to a group (only admins). */
export async function addParticipants(
  _sessionId: IdLike,
  _jid: string,
  _participants: string[],
): Promise<SabwaActionResult> {
  throw new Error(NOT_IMPLEMENTED);
}

/** Remove participants from a group (only admins). */
export async function removeParticipants(
  _sessionId: IdLike,
  _jid: string,
  _participants: string[],
): Promise<SabwaActionResult> {
  throw new Error(NOT_IMPLEMENTED);
}

/** Promote a participant to group admin. */
export async function promoteAdmin(
  _sessionId: IdLike,
  _jid: string,
  _participant: string,
): Promise<SabwaActionResult> {
  throw new Error(NOT_IMPLEMENTED);
}

/** Demote a group admin back to a regular participant. */
export async function demoteAdmin(
  _sessionId: IdLike,
  _jid: string,
  _participant: string,
): Promise<SabwaActionResult> {
  throw new Error(NOT_IMPLEMENTED);
}

/** Update a group's subject (name). */
export async function updateGroupSubject(
  _sessionId: IdLike,
  _jid: string,
  _subject: string,
): Promise<SabwaActionResult> {
  throw new Error(NOT_IMPLEMENTED);
}

/** Update a group's description. */
export async function updateGroupDescription(
  _sessionId: IdLike,
  _jid: string,
  _description: string,
): Promise<SabwaActionResult> {
  throw new Error(NOT_IMPLEMENTED);
}

/** Fetch (or generate, if missing) the current group invite code. */
export async function getInviteCode(
  _sessionId: IdLike,
  _jid: string,
): Promise<SabwaActionResult<{ code: string; url: string }>> {
  throw new Error(NOT_IMPLEMENTED);
}

/** Revoke the current group invite code and rotate to a fresh one. */
export async function revokeInviteCode(
  _sessionId: IdLike,
  _jid: string,
): Promise<SabwaActionResult<{ code: string; url: string }>> {
  throw new Error(NOT_IMPLEMENTED);
}

/** Tag a group with a user-defined category (Family / Work / etc.). */
export async function setGroupCategory(
  _jid: string,
  _categoryId: IdLike,
): Promise<SabwaActionResult> {
  throw new Error(NOT_IMPLEMENTED);
}

// ═══════════════════════════════════════════════════════════════════════════
// === Broadcasts & bulk ===
// ═══════════════════════════════════════════════════════════════════════════

/** Create a WhatsApp broadcast list (1:1 fan-out, no cross-visibility). */
export async function createBroadcastList(
  _sessionId: IdLike,
  _name: string,
  _recipients: string[],
): Promise<SabwaActionResult<{ broadcastId: string }>> {
  throw new Error(NOT_IMPLEMENTED);
}

/** Send a payload through an existing broadcast list. */
export async function sendBroadcast(
  _sessionId: IdLike,
  _broadcastId: IdLike,
  _payload: SabwaScheduledPayload,
): Promise<SabwaActionResult<{ jobId: string }>> {
  throw new Error(NOT_IMPLEMENTED);
}

/** Start a bulk-sender campaign with rate-limit + anti-ban controls. */
export async function startBulkCampaign(
  _sessionId: IdLike,
  _campaign: SabwaBulkCampaignDraft,
): Promise<SabwaActionResult<{ campaignId: string }>> {
  throw new Error(NOT_IMPLEMENTED);
}

/** Pause a running bulk campaign (resumable). */
export async function pauseBulkCampaign(
  _campaignId: IdLike,
): Promise<SabwaActionResult> {
  throw new Error(NOT_IMPLEMENTED);
}

/** Permanently abort a bulk campaign — pending recipients are skipped. */
export async function abortBulkCampaign(
  _campaignId: IdLike,
): Promise<SabwaActionResult> {
  throw new Error(NOT_IMPLEMENTED);
}

// ═══════════════════════════════════════════════════════════════════════════
// === Scheduler ===
// ═══════════════════════════════════════════════════════════════════════════

/** Schedule a one-off or recurring message for later delivery. */
export async function scheduleMessage(
  _sessionId: IdLike,
  _draft: SabwaScheduledDraft,
): Promise<SabwaActionResult<{ scheduledId: string }>> {
  throw new Error(NOT_IMPLEMENTED);
}

/** Update fields on an existing scheduled message (target, payload, time). */
export async function updateScheduledMessage(
  _scheduledId: IdLike,
  _patch: Partial<SabwaScheduledDraft>,
): Promise<SabwaActionResult> {
  throw new Error(NOT_IMPLEMENTED);
}

/** Cancel a scheduled message before it fires. */
export async function cancelScheduledMessage(
  _scheduledId: IdLike,
): Promise<SabwaActionResult> {
  throw new Error(NOT_IMPLEMENTED);
}

/** List scheduled messages for a session, filtered by status / target. */
export async function listScheduledMessages(
  _sessionId: IdLike,
  _filter: SabwaScheduledListFilter = {},
): Promise<
  SabwaActionResult<{ items: SabwaScheduled[]; nextCursor?: string }>
> {
  throw new Error(NOT_IMPLEMENTED);
}

// ═══════════════════════════════════════════════════════════════════════════
// === Contacts ===
// ═══════════════════════════════════════════════════════════════════════════

/** List contacts cached for a session. */
export async function listContacts(
  _sessionId: IdLike,
  _filter: SabwaContactListFilter = {},
): Promise<SabwaActionResult<{ contacts: SabwaContact[]; nextCursor?: string }>> {
  throw new Error(NOT_IMPLEMENTED);
}

/** Replace or append the tags attached to a contact. */
export async function upsertContactTags(
  _sessionId: IdLike,
  _jid: string,
  _tags: string[],
  _opts: { replace?: boolean } = {},
): Promise<SabwaActionResult> {
  throw new Error(NOT_IMPLEMENTED);
}

/** Block a contact on WhatsApp from this session. */
export async function blockContact(
  _sessionId: IdLike,
  _jid: string,
): Promise<SabwaActionResult> {
  throw new Error(NOT_IMPLEMENTED);
}

/** Unblock a previously blocked contact. */
export async function unblockContact(
  _sessionId: IdLike,
  _jid: string,
): Promise<SabwaActionResult> {
  throw new Error(NOT_IMPLEMENTED);
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
  throw new Error(NOT_IMPLEMENTED);
}

/** Summarise the last `window` of messages in a chat. */
export async function summariseChat(
  _sessionId: IdLike,
  _chatJid: string,
  _window: '24h' | '7d' | 'all',
): Promise<SabwaActionResult<{ summary: string }>> {
  throw new Error(NOT_IMPLEMENTED);
}

/** Translate a single message into the target language. */
export async function translateMessage(
  _messageId: IdLike,
  _targetLang: string,
): Promise<SabwaActionResult<{ translation: string; detectedLang?: string }>> {
  throw new Error(NOT_IMPLEMENTED);
}

// ═══════════════════════════════════════════════════════════════════════════
// === Audit ===
// ═══════════════════════════════════════════════════════════════════════════

/** List audit-log entries for a project / session with filters. */
export async function listAuditEntries(
  _projectId: IdLike,
  _filter: SabwaAuditListFilter = {},
): Promise<SabwaActionResult<{ entries: unknown[]; nextCursor?: string }>> {
  throw new Error(NOT_IMPLEMENTED);
}

// ═══════════════════════════════════════════════════════════════════════════
// === Webhooks ===
// ═══════════════════════════════════════════════════════════════════════════

/** Register a new outbound webhook for SabWa events. */
export async function createWebhook(
  _projectId: IdLike,
  _input: {
    url: string;
    events: SabwaWebhookEvent[];
    sessionId?: IdLike;
  },
): Promise<SabwaActionResult<{ webhookId: string; signingSecret: string }>> {
  throw new Error(NOT_IMPLEMENTED);
}

/** Remove an outbound webhook. */
export async function deleteWebhook(
  _webhookId: IdLike,
): Promise<SabwaActionResult> {
  throw new Error(NOT_IMPLEMENTED);
}

// ═══════════════════════════════════════════════════════════════════════════
// === API keys ===
// ═══════════════════════════════════════════════════════════════════════════

/** Create a new SabWa REST API key — plaintext is returned ONCE. */
export async function createApiKey(
  _projectId: IdLike,
  _input: { name: string; scopes?: string[] },
): Promise<SabwaActionResult<{ apiKeyId: string; apiKey: string }>> {
  throw new Error(NOT_IMPLEMENTED);
}

/** Revoke an existing SabWa API key. */
export async function revokeApiKey(
  _apiKeyId: IdLike,
): Promise<SabwaActionResult> {
  throw new Error(NOT_IMPLEMENTED);
}

// ═══════════════════════════════════════════════════════════════════════════
// === Settings ===
// ═══════════════════════════════════════════════════════════════════════════

/** Update the WhatsApp profile (push name / about / picture) of a session. */
export async function updateProfile(
  _sessionId: IdLike,
  _patch: { pushName?: string; about?: string; profilePicSabFileId?: string },
): Promise<SabwaActionResult> {
  throw new Error(NOT_IMPLEMENTED);
}

/** Change the anti-ban rate-limit profile for a session. */
export async function setRateLimitProfile(
  _sessionId: IdLike,
  _profile: SabwaRateLimitProfile,
): Promise<SabwaActionResult> {
  throw new Error(NOT_IMPLEMENTED);
}

/** Enable or disable the 7-day warmup ramp for a session. */
export async function setWarmupEnabled(
  _sessionId: IdLike,
  _enabled: boolean,
): Promise<SabwaActionResult> {
  throw new Error(NOT_IMPLEMENTED);
}

// ─── Re-exports kept so tooling can detect unused-but-typed entities ────────
//
// These types are imported above purely so callers using `typeof import(...)`
// have a single entry point; eslint/tsc will flag any genuine misuse.
export type {
  SabwaAutoReply,
  SabwaBroadcast,
  SabwaSessionStatus,
  SabwaTemplate,
};
