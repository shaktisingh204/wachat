/**
 * Auto-reply matcher.
 *
 * Called from `src/wa/session.ts`'s `messages.upsert` handler with every
 * inbound message (`fromMe === false`). It:
 *
 *   1. Loads enabled auto-reply rules for the session in priority order
 *      (`order` ascending — see `db/auto-replies.ts`).
 *   2. Evaluates each rule's triggers (all triggers must pass — AND).
 *   3. On the FIRST matching rule, executes each of its actions and stops.
 *
 * Action implementations:
 *   - `send_template`       → fetch from `sabwa_templates` and send (text).
 *   - `send_message`        → send the provided `message` string verbatim.
 *   - `forward_to_flow`     → no-op (TODO: SabFlow integration).
 *   - `set_away_message`    → flip session into away-mode in Redis + send.
 *   - `add_label` / `set_label` → tag the chat in `sabwa_chats.labels`.
 *
 * The matcher is intentionally side-effect-tolerant: any failure logs and
 * continues — a broken rule must never crash the message pipeline.
 */

import { ObjectId } from 'mongodb';
import type { AppState, BaileysSession } from '../state.js';
import {
  listEnabledForMatching,
  type AutoReplyAction,
  type AutoReplyDoc,
  type AutoReplyTrigger,
} from '../db/auto-replies.js';

/** Input passed in by `session.ts`. */
export interface InboundMessageContext {
  sessionId: string;
  projectId: string;
  chatJid: string;
  fromJid: string;
  /** Plain-text body of the inbound message (caption for media). Empty string if none. */
  body: string;
  /** Epoch-ms timestamp of the message — used for time-of-day triggers. */
  ts: number;
  /** True if this is the first inbound message we have ever seen from `fromJid` in this session. */
  isFirstMessageFromContact?: boolean;
  /** Optional labels currently on the contact — used by `contact_label`. */
  contactLabels?: string[];
}

const TZ_DEFAULT = process.env.SABWA_DEFAULT_TZ ?? 'UTC';

// ── Trigger evaluation ─────────────────────────────────────────────────────

function isCaseSensitive(t: AutoReplyTrigger): boolean {
  return t.caseSensitive === true;
}

function matchKeyword(body: string, value: string, t: AutoReplyTrigger): boolean {
  if (!value) return false;
  if (isCaseSensitive(t)) {
    const re = new RegExp(`\\b${escapeRegex(value)}\\b`);
    return re.test(body);
  }
  const re = new RegExp(`\\b${escapeRegex(value)}\\b`, 'i');
  return re.test(body);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchContains(body: string, value: string, t: AutoReplyTrigger): boolean {
  if (!value) return false;
  if (isCaseSensitive(t)) return body.includes(value);
  return body.toLowerCase().includes(value.toLowerCase());
}

function matchContainsAll(body: string, value: string, t: AutoReplyTrigger): boolean {
  const tokens = value
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (tokens.length === 0) return false;
  return tokens.every((tok) => matchContains(body, tok, t));
}

function matchContainsAny(body: string, value: string, t: AutoReplyTrigger): boolean {
  const tokens = value
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (tokens.length === 0) return false;
  return tokens.some((tok) => matchContains(body, tok, t));
}

function matchRegex(body: string, value: string, flags?: string): boolean {
  try {
    const re = new RegExp(value, flags ?? 'i');
    return re.test(body);
  } catch {
    return false;
  }
}

/**
 * Parse "HH:MM" → minutes since midnight, returning null on malformed input.
 */
function parseHHMM(s?: string): number | null {
  if (!s) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number.parseInt(m[1] ?? '0', 10);
  const min = Number.parseInt(m[2] ?? '0', 10);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/** Day-of-week + minutes-since-midnight in the configured timezone. */
function nowParts(tsMs: number): { dow: number; minutes: number } {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: TZ_DEFAULT,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      weekday: 'short',
    });
    const parts = fmt.formatToParts(new Date(tsMs));
    let hh = 0;
    let mm = 0;
    let dowStr = '';
    for (const p of parts) {
      if (p.type === 'hour') hh = Number.parseInt(p.value, 10);
      else if (p.type === 'minute') mm = Number.parseInt(p.value, 10);
      else if (p.type === 'weekday') dowStr = p.value;
    }
    const dowMap: Record<string, number> = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    };
    return { dow: dowMap[dowStr] ?? 0, minutes: hh * 60 + mm };
  } catch {
    const d = new Date(tsMs);
    return { dow: d.getUTCDay(), minutes: d.getUTCHours() * 60 + d.getUTCMinutes() };
  }
}

function matchTimeWindow(t: AutoReplyTrigger, tsMs: number, invert: boolean): boolean {
  const start = parseHHMM(t.start);
  const end = parseHHMM(t.end);
  if (start === null || end === null) return false;
  const { dow, minutes } = nowParts(tsMs);
  if (t.daysOfWeek && t.daysOfWeek.length > 0 && !t.daysOfWeek.includes(dow)) {
    return invert; // outside the configured days
  }
  let inside: boolean;
  if (start <= end) {
    inside = minutes >= start && minutes < end;
  } else {
    // window crosses midnight
    inside = minutes >= start || minutes < end;
  }
  return invert ? !inside : inside;
}

function triggerMatches(
  t: AutoReplyTrigger,
  ctx: InboundMessageContext,
): boolean {
  const body = ctx.body ?? '';
  switch (t.kind) {
    case 'keyword':
      return matchKeyword(body, t.value ?? '', t);
    case 'contains':
      return matchContains(body, t.value ?? '', t);
    case 'contains_all':
      return matchContainsAll(body, t.value ?? '', t);
    case 'contains_any':
      return matchContainsAny(body, t.value ?? '', t);
    case 'regex':
      return matchRegex(body, t.value ?? '', t.flags);
    case 'time_window':
    case 'time_of_day':
      return matchTimeWindow(t, ctx.ts, false);
    case 'outside_business_hours':
      return matchTimeWindow(t, ctx.ts, true);
    case 'contact_label': {
      const want = t.value ?? '';
      if (!want) return false;
      return (ctx.contactLabels ?? []).includes(want);
    }
    case 'first_message_from_new_contact':
      return ctx.isFirstMessageFromContact === true;
    default:
      return false;
  }
}

function ruleMatches(rule: AutoReplyDoc, ctx: InboundMessageContext): boolean {
  if (!rule.triggers || rule.triggers.length === 0) return false;
  // AND semantics across triggers within a rule. The OR semantics of
  // `contains_any` are handled inside the matcher for that kind.
  return rule.triggers.every((t) => triggerMatches(t, ctx));
}

// ── Action execution ───────────────────────────────────────────────────────

/**
 * Lazy import: the WA send helper lives in a sibling module owned by the
 * sessions/messages agent. We dynamic-import to avoid a hard build-time
 * dependency before that file lands.
 */
async function sendText(
  state: AppState,
  session: BaileysSession,
  toJid: string,
  text: string,
): Promise<void> {
  // Try the canonical helper path first; fall back to a direct
  // `sock.sendMessage` call if available. The path is constructed at
  // runtime so TS doesn't require `../wa/send.ts` to exist at build time
  // (the sessions agent owns that file).
  const sendModPath = ['..', 'wa', 'send.js'].join('/');
  try {
    const mod = (await import(/* @vite-ignore */ sendModPath)) as {
      sendTextMessage?: (
        state: AppState,
        session: BaileysSession,
        toJid: string,
        text: string,
      ) => Promise<unknown>;
    };
    if (typeof mod.sendTextMessage === 'function') {
      await mod.sendTextMessage(state, session, toJid, text);
      return;
    }
  } catch {
    /* fall through to direct sock call */
  }
  const sock = session.sock as
    | { sendMessage?: (jid: string, content: { text: string }) => Promise<unknown> }
    | undefined;
  if (sock && typeof sock.sendMessage === 'function') {
    await sock.sendMessage(toJid, { text });
    return;
  }
  state.log.warn(
    { sessionId: session.sessionId, toJid },
    'auto-reply: no send helper available; dropping message',
  );
}

async function loadTemplateBody(
  state: AppState,
  templateId: string,
): Promise<string | null> {
  if (!ObjectId.isValid(templateId)) return null;
  const doc = await state.db
    .collection<{ body?: string }>('sabwa_templates')
    .findOne({ _id: new ObjectId(templateId) });
  return doc?.body ?? null;
}

async function addLabelToChat(
  state: AppState,
  sessionId: ObjectId,
  chatJid: string,
  labelId: string,
): Promise<void> {
  if (!ObjectId.isValid(labelId)) return;
  await state.db.collection('sabwa_chats').updateOne(
    { sessionId, jid: chatJid },
    {
      $addToSet: { labels: new ObjectId(labelId) },
      $set: { updatedAt: new Date() },
    },
  );
}

async function setAwayMode(
  state: AppState,
  sessionId: string,
  message: string,
): Promise<void> {
  // Best-effort: store the away message in Redis so the sessions agent can
  // read it back. Failing here is non-fatal.
  try {
    await state.redis.client.set(
      `sabwa:away:${sessionId}`,
      JSON.stringify({ message, at: new Date().toISOString() }),
      { EX: 24 * 60 * 60 },
    );
  } catch (err) {
    state.log.warn({ err, sessionId }, 'auto-reply: failed to persist away message');
  }
}

async function executeAction(
  state: AppState,
  session: BaileysSession,
  rule: AutoReplyDoc,
  ctx: InboundMessageContext,
  action: AutoReplyAction,
): Promise<void> {
  switch (action.kind) {
    case 'send_template': {
      if (!action.templateId) return;
      const body = await loadTemplateBody(state, String(action.templateId));
      if (!body) {
        state.log.warn(
          { ruleId: rule._id.toHexString(), templateId: action.templateId },
          'auto-reply: template not found',
        );
        return;
      }
      await sendText(state, session, ctx.chatJid, body);
      return;
    }
    case 'send_message': {
      const text = action.message?.trim();
      if (!text) return;
      await sendText(state, session, ctx.chatJid, text);
      return;
    }
    case 'forward_to_flow': {
      // SabFlow integration lives in a sibling worker; intentionally no-op.
      state.log.debug(
        { ruleId: rule._id.toHexString(), flowId: action.flowId },
        'auto-reply: forward_to_flow is a no-op for now',
      );
      return;
    }
    case 'set_away_message': {
      const text = action.message?.trim();
      if (!text) return;
      await setAwayMode(state, ctx.sessionId, text);
      await sendText(state, session, ctx.chatJid, text);
      return;
    }
    case 'add_label':
    case 'set_label': {
      if (!action.labelId) return;
      await addLabelToChat(state, rule.sessionId, ctx.chatJid, String(action.labelId));
      return;
    }
    default:
      state.log.warn({ kind: action.kind }, 'auto-reply: unknown action kind');
  }
}

// ── Public entry point ─────────────────────────────────────────────────────

/**
 * Evaluate auto-reply rules for an inbound message and execute the first
 * matching rule's actions. Safe to call from a tight `messages.upsert` loop —
 * all internal failures are caught and logged.
 *
 * Returns `true` iff at least one rule matched (useful for tests/metrics).
 */
export async function runAutoReplyMatcher(
  state: AppState,
  session: BaileysSession,
  ctx: InboundMessageContext,
): Promise<boolean> {
  try {
    const rules = await listEnabledForMatching(state, ctx.sessionId);
    if (rules.length === 0) return false;
    for (const rule of rules) {
      if (!ruleMatches(rule, ctx)) continue;
      state.log.info(
        {
          sessionId: ctx.sessionId,
          ruleId: rule._id.toHexString(),
          name: rule.name,
          chatJid: ctx.chatJid,
        },
        'auto-reply: rule matched',
      );
      for (const action of rule.actions ?? []) {
        try {
          await executeAction(state, session, rule, ctx, action);
        } catch (err) {
          state.log.error(
            { err, ruleId: rule._id.toHexString(), action: action.kind },
            'auto-reply: action failed',
          );
        }
      }
      return true; // First-match wins.
    }
    return false;
  } catch (err) {
    state.log.error({ err, sessionId: ctx.sessionId }, 'auto-reply matcher crashed');
    return false;
  }
}

// ── Sessions-agent integration shim ────────────────────────────────────────

/**
 * Baileys `messages.upsert` shape (the bits we care about). Kept loose so we
 * don't pin the sessions agent to a specific @whiskeysockets/baileys version.
 */
interface BaileysUpsertMessage {
  key?: {
    fromMe?: boolean;
    remoteJid?: string | null;
    participant?: string | null;
  };
  message?: {
    conversation?: string | null;
    extendedTextMessage?: { text?: string | null } | null;
    imageMessage?: { caption?: string | null } | null;
    videoMessage?: { caption?: string | null } | null;
    documentMessage?: { caption?: string | null } | null;
  } | null;
  messageTimestamp?: number | { low?: number } | null;
}

function extractBody(m: BaileysUpsertMessage): string {
  const msg = m.message ?? undefined;
  if (!msg) return '';
  return (
    msg.conversation ??
    msg.extendedTextMessage?.text ??
    msg.imageMessage?.caption ??
    msg.videoMessage?.caption ??
    msg.documentMessage?.caption ??
    ''
  ) || '';
}

function extractTs(m: BaileysUpsertMessage): number {
  const raw = m.messageTimestamp;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw * 1000;
  if (raw && typeof raw === 'object' && typeof raw.low === 'number') {
    return raw.low * 1000;
  }
  return Date.now();
}

/**
 * Convenience entry point for `src/wa/session.ts`'s `messages.upsert`
 * handler. Skips outbound messages and any upsert without a body.
 *
 * Usage (in `session.ts`):
 *
 *     sock.ev.on('messages.upsert', async (upsert) => {
 *       for (const m of upsert.messages) {
 *         await handleInboundForAutoReply(state, session, m);
 *       }
 *     });
 */
export async function handleInboundForAutoReply(
  state: AppState,
  session: BaileysSession,
  message: BaileysUpsertMessage,
): Promise<void> {
  if (!message?.key || message.key.fromMe) return;
  const chatJid = message.key.remoteJid ?? '';
  if (!chatJid) return;
  const fromJid = message.key.participant ?? chatJid;
  const body = extractBody(message);
  if (!body) return;
  await runAutoReplyMatcher(state, session, {
    sessionId: session.sessionId,
    projectId: session.projectId,
    chatJid,
    fromJid,
    body,
    ts: extractTs(message),
  });
}

export const __forTest = { ruleMatches, triggerMatches, parseHHMM, nowParts, extractBody };
