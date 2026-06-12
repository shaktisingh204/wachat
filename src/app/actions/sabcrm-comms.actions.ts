'use server';

/**
 * SabCRM — communications server actions (WhatsApp-in-CRM via WaChat).
 *
 * Bridges a SabCRM record (NEW engine, `/sabcrm/[objectSlug]/[recordId]`) to
 * its WhatsApp conversation in WaChat:
 *
 *   1. read the record through the Rust engine and pull its first
 *      PHONE / PHONES value (object metadata drives which `data.*` keys are
 *      phone fields), normalised to a digits-only `waId`;
 *   2. pick the tenant's WhatsApp-connected project — the ACTIVE SabCRM
 *      project when it has connected phone numbers, else the user's first
 *      WhatsApp project that does (the same selection WaChat's inbox makes);
 *   3. resolve / create the WaChat contact for that `waId` on the project's
 *      first connected number and read its conversation — all through
 *      WaChat's OWN actions (`whatsapp.actions.ts`), never a parallel path;
 *   4. sends go through WaChat's free-text send (`handleSendMessage`) and
 *      are ALSO logged as a `WHATSAPP` activity on the record so they show
 *      up in the existing Timeline tab.
 *
 * Every action follows the SAME gate pipeline as the sibling
 * `sabcrm-stage-gates.actions.ts`:
 *
 *   1. resolve the cached session (fail closed if unauthenticated)
 *   2. resolve the active project id (explicit param or the user's first),
 *      rejecting a client-supplied projectId the caller is not a member of
 *   3. RBAC check via `canServer('sabcrm', action, projectId)`
 *   4. plan check via {@link sabcrmPlanFeature}
 *   5. call the engines and return a typed result
 */

import { revalidatePath } from 'next/cache';

import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import { sabcrmRecordsApi } from '@/lib/rust-client/sabcrm-records';
import { sabcrmObjectsApi } from '@/lib/rust-client/sabcrm-objects';
import { sabcrmActivitiesApi } from '@/lib/rust-client/sabcrm-activities';
import { getProjects } from '@/app/actions/project.actions';
import {
  findOrCreateContact,
  getConversation,
  handleSendMessage,
} from '@/app/actions/whatsapp.actions';
import type { ActionResult, ObjectMetadata } from '@/lib/sabcrm/types';
import type { SabcrmRustActivity } from './sabcrm-twenty.actions.types';
import type {
  SabcrmWhatsappMessage,
  SabcrmWhatsappSendResult,
  SabcrmWhatsappThread,
  SabcrmWhatsappThreadRef,
} from './sabcrm-comms.actions.types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** RBAC module key for SabCRM (see `src/lib/sabcrm/rbac-keys.ts`). */
const MODULE_KEY = 'sabcrm';

/** Base path revalidated after mutations so the SabCRM UI re-fetches. */
const TW_BASE_PATH = '/sabcrm';

/** How many trailing messages a thread read returns. */
const THREAD_LIMIT = 50;

/** Minimal shape of the session user we narrow to (mirrors sibling actions). */
interface SessionUser {
  _id: string;
}

// ---------------------------------------------------------------------------
// Gate (session → project → RBAC → plan) — mirrors sabcrm-stage-gates.actions
// ---------------------------------------------------------------------------

interface GateContext {
  userId: string;
  projectId: string;
}

type GateResult =
  | { ok: true; ctx: GateContext }
  | { ok: false; error: string };

/**
 * Runs the full session → project → RBAC → plan pipeline. Mirrors the `gate`
 * helper in `sabcrm-stage-gates.actions.ts` verbatim, including the
 * cross-tenant defense against a client-supplied `explicitProjectId`.
 */
async function gate(
  action: PermissionAction,
  explicitProjectId?: string,
): Promise<GateResult> {
  // 1. session
  const session = await getCachedSession();
  if (!session?.user) return { ok: false, error: 'Not authenticated.' };
  const userId = (session.user as SessionUser)._id;
  if (!userId) return { ok: false, error: 'Not authenticated.' };

  // 2. active project — only accept a projectId that belongs to THIS user.
  const myProjects = await getCachedProjects();
  const myProjectIds = new Set(myProjects.map((p) => String(p._id)));
  const firstProjectId = myProjects[0]?._id;
  const requested =
    explicitProjectId ?? (firstProjectId ? String(firstProjectId) : undefined);
  if (!requested) return { ok: false, error: 'No active project.' };
  if (!myProjectIds.has(requested)) {
    return { ok: false, error: 'Permission denied.' };
  }
  const projectId = requested;

  // 3. RBAC
  const allowed = await canServer(MODULE_KEY, action, projectId);
  if (!allowed) return { ok: false, error: 'Permission denied.' };

  // 4. plan
  if (!sabcrmPlanFeature.defaultEnabled) {
    return { ok: false, error: 'Your plan does not include SabCRM.' };
  }

  return { ok: true, ctx: { userId, projectId } };
}

/** Normalises a thrown value (incl. {@link RustApiError}) into a message. */
function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof RustApiError) return e.message || fallback;
  return e instanceof Error ? e.message : fallback;
}

// ---------------------------------------------------------------------------
// Phone resolution — first PHONE / PHONES value on the record
// ---------------------------------------------------------------------------

/** Narrow an unknown to a plain object record. */
function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

/** First non-empty string among the candidates. */
function firstString(...candidates: unknown[]): string {
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return '';
}

/**
 * Pull ONE dialable phone string out of a PHONE / PHONES field value.
 * Tolerates plain strings, arrays of strings / objects and Twenty's
 * `{ primaryPhoneNumber, primaryPhoneCallingCode, additionalPhones[] }`
 * composite (the same shapes `parsePhones` in the 20ui field renderers
 * accepts).
 */
function phoneFromValue(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    for (const item of value) {
      const p = phoneFromValue(item);
      if (p) return p;
    }
    return '';
  }
  const rec = asRecord(value);
  if (!rec) return '';
  const number = firstString(
    rec.number,
    rec.primaryPhoneNumber,
    rec.phoneNumber,
    rec.value,
  );
  if (!number) {
    const extra = rec.additionalPhones ?? rec.additionalPhoneNumbers;
    return Array.isArray(extra) ? phoneFromValue(extra) : '';
  }
  const calling = firstString(
    rec.callingCode,
    rec.primaryPhoneCallingCode,
    rec.countryCode,
    rec.primaryPhoneCountryCode,
  );
  if (!calling) return number;
  const prefix = calling.startsWith('+')
    ? calling
    : `+${calling.replace(/[^\d]/g, '')}`;
  return `${prefix} ${number}`;
}

/**
 * The record's first phone: object metadata decides which `data.*` keys are
 * PHONE / PHONES fields (in field order); the common bare keys `phone` /
 * `phones` are the fallback for objects without typed phone fields.
 */
function firstRecordPhone(
  object: ObjectMetadata | null,
  data: Record<string, unknown>,
): string {
  const keys: string[] = [];
  for (const f of object?.fields ?? []) {
    if (f.type === 'PHONE' || f.type === 'PHONES') keys.push(f.key);
  }
  for (const k of ['phone', 'phones']) {
    if (!keys.includes(k)) keys.push(k);
  }
  for (const key of keys) {
    const p = phoneFromValue(data[key]);
    if (p) return p;
  }
  return '';
}

/** Digits-only WhatsApp id from a display phone. */
function toWaId(phone: string): string {
  return (phone || '').replace(/[^\d]/g, '');
}

// ---------------------------------------------------------------------------
// WaChat message mapping
// ---------------------------------------------------------------------------

/** Pull the text out of a Meta message payload, best-effort. */
function extractText(content: unknown, type: string): string {
  const rec = asRecord(content);
  if (!rec) return type === 'text' ? '' : `[${type}]`;
  const textBody = asRecord(rec.text)?.body;
  if (typeof textBody === 'string' && textBody) return textBody;
  if (typeof rec.caption === 'string' && rec.caption) return rec.caption;
  if (typeof rec.body === 'string' && rec.body) return rec.body;
  return type === 'text' ? '' : `[${type}]`;
}

/** Loose shape of a stored WaChat message (Meta payload + metadata). */
interface WachatMessageLike {
  _id?: unknown;
  wamid?: unknown;
  direction?: unknown;
  type?: unknown;
  content?: unknown;
  messageTimestamp?: unknown;
  status?: unknown;
}

/** Map one stored WaChat message onto the flat wire shape. */
function toThreadMessage(m: WachatMessageLike, i: number): SabcrmWhatsappMessage {
  const type = typeof m.type === 'string' && m.type ? m.type : 'text';
  let at: string | null = null;
  if (m.messageTimestamp !== undefined && m.messageTimestamp !== null) {
    const d = new Date(m.messageTimestamp as string | number | Date);
    if (!Number.isNaN(d.getTime())) at = d.toISOString();
  }
  return {
    id: String(m.wamid ?? m._id ?? i),
    direction: m.direction === 'out' ? 'out' : 'in',
    text: extractText(m.content, type),
    type,
    at,
    status: typeof m.status === 'string' ? m.status : null,
  };
}

// ---------------------------------------------------------------------------
// Thread resolution (shared by read + send)
// ---------------------------------------------------------------------------

/** Loose project shape — only what number selection needs. */
interface WhatsappProjectLike {
  _id: unknown;
  phoneNumbers?: Array<{ id?: string }>;
}

type ResolvedThread =
  | {
      connected: true;
      phone: string;
      ref: SabcrmWhatsappThreadRef;
    }
  | { connected: false; reason: string; phone?: string };

/**
 * Record → phone → WaChat (project, number, contact). Number selection
 * mirrors WaChat's inbox: the project's FIRST connected phone number. The
 * active SabCRM project wins when it is itself WhatsApp-connected; otherwise
 * the user's first WhatsApp project with a connected number is used (CRM and
 * WaChat may live in different projects of the same tenant).
 */
async function resolveThread(
  ctx: GateContext,
  objectSlug: string,
  recordId: string,
): Promise<ResolvedThread> {
  // 1. the record's phone
  let object: ObjectMetadata | null = null;
  try {
    object = await sabcrmObjectsApi.get(objectSlug, ctx.projectId);
  } catch {
    object = null; // metadata is only a hint; bare phone/phones keys still work
  }
  const record = await sabcrmRecordsApi.get(objectSlug, recordId, ctx.projectId);
  const phone = firstRecordPhone(object, record.data ?? {});
  const waId = toWaId(phone);
  if (!waId || waId.length < 8) {
    return {
      connected: false,
      reason: 'This record has no usable phone number.',
    };
  }

  // 2. the tenant's WhatsApp-connected project + number
  const projects = (await getProjects(
    undefined,
    'whatsapp',
  )) as unknown as WhatsappProjectLike[];
  const withNumbers = projects.filter((p) => p.phoneNumbers?.length);
  const project =
    withNumbers.find((p) => String(p._id) === ctx.projectId) ?? withNumbers[0];
  const phoneNumberId = project?.phoneNumbers?.[0]?.id;
  if (!project || !phoneNumberId) {
    return {
      connected: false,
      reason: 'WhatsApp is not connected yet. Connect a number in WaChat first.',
      phone,
    };
  }
  const wachatProjectId = String(project._id);

  // 3. the WaChat contact for this waId on that number
  const found = await findOrCreateContact(wachatProjectId, phoneNumberId, waId);
  if (!found.contact) {
    return {
      connected: false,
      reason: found.error ?? 'Could not open the WhatsApp conversation.',
      phone,
    };
  }

  return {
    connected: true,
    phone,
    ref: {
      wachatProjectId,
      phoneNumberId,
      waId,
      wachatContactId: String(found.contact._id),
    },
  };
}

// ---------------------------------------------------------------------------
// getSabcrmWhatsappThread
// ---------------------------------------------------------------------------

/**
 * Resolves the record's WhatsApp thread and returns its last
 * {@link THREAD_LIMIT} messages, oldest first.
 *
 * `connected: false` is a STATE, not an error — the UI shows a connect CTA
 * (no phone on the record / WaChat not connected). Hard failures (auth,
 * engine down) also degrade to `connected: false` with a reason so the tab
 * never crashes.
 */
export async function getSabcrmWhatsappThread(
  projectId: string | undefined,
  objectSlug: string,
  recordId: string,
): Promise<SabcrmWhatsappThread> {
  const empty = (reason: string, phone?: string): SabcrmWhatsappThread => ({
    connected: false,
    reason,
    phone,
    messages: [],
  });

  if (!objectSlug || !recordId) {
    return empty('objectSlug and recordId are required.');
  }

  const g = await gate('view', projectId);
  if (!g.ok) return empty(g.error);

  try {
    const resolved = await resolveThread(g.ctx, objectSlug, recordId);
    if (!resolved.connected) return empty(resolved.reason, resolved.phone);

    const raw = (await getConversation(
      resolved.ref.wachatContactId,
    )) as unknown as WachatMessageLike[];
    const messages = (raw ?? [])
      .map(toThreadMessage)
      .sort((a, b) => (a.at ?? '').localeCompare(b.at ?? ''))
      .slice(-THREAD_LIMIT);

    return {
      connected: true,
      phone: resolved.phone,
      messages,
      threadRef: resolved.ref,
    };
  } catch (e) {
    return empty(errorMessage(e, 'Failed to load the WhatsApp conversation.'));
  }
}

// ---------------------------------------------------------------------------
// sendSabcrmWhatsappMessage
// ---------------------------------------------------------------------------

/**
 * Sends a free-text WhatsApp session message to the record's phone through
 * WaChat's own send path (`handleSendMessage` → Rust `whatsappSend.send`),
 * then logs a `WHATSAPP` activity on the record so the send shows up in the
 * Timeline tab. The thread is re-resolved server-side — client-supplied
 * thread refs are never trusted.
 *
 * Activity logging is non-fatal: a sent message with a failed log returns
 * `ok: true` with `activity: null`.
 */
export async function sendSabcrmWhatsappMessage(
  projectId: string | undefined,
  objectSlug: string,
  recordId: string,
  text: string,
): Promise<ActionResult<SabcrmWhatsappSendResult>> {
  if (!objectSlug || !recordId) {
    return { ok: false, error: 'objectSlug and recordId are required.' };
  }
  const body = (text ?? '').trim();
  if (!body) return { ok: false, error: 'Message is empty.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const resolved = await resolveThread(g.ctx, objectSlug, recordId);
    if (!resolved.connected) return { ok: false, error: resolved.reason };

    const sent = await handleSendMessage(null, {
      contactId: resolved.ref.wachatContactId,
      projectId: resolved.ref.wachatProjectId,
      phoneNumberId: resolved.ref.phoneNumberId,
      waId: resolved.ref.waId,
      messageText: body,
    });
    if (sent?.error) return { ok: false, error: sent.error };

    // Log the touchpoint on the record's timeline (non-fatal on failure).
    let activity: SabcrmRustActivity | null = null;
    try {
      const firstLine = body.split('\n', 1)[0].slice(0, 80) || 'WhatsApp message';
      activity = await sabcrmActivitiesApi.create({
        projectId: g.ctx.projectId,
        type: 'WHATSAPP',
        title: `WhatsApp to ${resolved.phone}: ${firstLine}`,
        body,
        targetObject: objectSlug,
        targetRecordId: recordId,
        authorId: g.ctx.userId,
      });
    } catch {
      activity = null;
    }

    revalidatePath(`${TW_BASE_PATH}/${objectSlug}/${recordId}`);
    return { ok: true, data: { activity } };
  } catch (e) {
    return {
      ok: false,
      error: errorMessage(e, 'Failed to send the WhatsApp message.'),
    };
  }
}
