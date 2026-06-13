import 'server-only';

/**
 * SabCRM — multichannel cadence dispatch runtime (server-only).
 *
 * This is the **channel-dispatch layer that sits BESIDE the sequence engine**.
 * The existing cadence runtime (the Rust `sabcrm-sequences` crate + the
 * auto-unenroll hooks in `./sequences.server.ts`) walks an enrollment through
 * ordered steps and owns `nextRunAt` / `history`. We do NOT touch it. When the
 * scheduler's advance path reaches a step, it calls {@link dispatchCadenceStep}
 * here, which routes the step to the right SabNode engine:
 *
 *   - `email`    → `sendSabcrmEmailCore` (`./email-core`) — SabMail transport,
 *                  open/click tracking, EMAIL activity. A/B subject split via
 *                  the pure `resolveEmailSubject`.
 *   - `sms`      → `sabsmsEngine.enqueueSend` (`@/lib/sabsms/engine-client`) —
 *                  metered (`sms_segments`) + a CALL/NOTE activity on the record.
 *   - `whatsapp` → the existing CRM comms action `sendSabcrmWhatsappMessage`
 *                  (`@/app/actions/sabcrm-comms.actions`) — rides WaChat's own
 *                  send + WHATSAPP activity. Metered (`messages_sent`).
 *   - `task`     → `createActivity({ type: 'TASK' })` (`./activities.server`).
 *   - `wait`     → no-op (the engine just waited).
 *
 * ## Idempotency + recording
 *
 * Every dispatch is recorded once per `(enrollmentId, stepIndex)` in
 * `sabcrm_cadence_sends` via an upsert keyed on `{ projectId, enrollmentId,
 * stepIndex }`. A second call for the same pair short-circuits to the recorded
 * outcome (best-effort, never re-sends). The dispatcher NEVER throws — a downed
 * engine returns `{ ok: false, outcome: 'failed:…' }` so the scheduler can still
 * advance the enrollment (or retry) without the whole tick crashing.
 *
 * ## Identity (sessionless-friendly)
 *
 * The caller passes `userId` + `projectId` (the scheduler owns its own identity
 * plumbing — same contract as `sendSabcrmEmailCore`). The record's `data` is
 * read DIRECT from Mongo `sabcrm_records` (scalar reads are allowed under the
 * two-store gotcha; only object/field METADATA needs the Rust path, which the
 * email/phone resolvers don't require — they fall back to the bare `email` /
 * `phone` keys). Per-tenant metering is keyed on `userId`.
 */

import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { canUse } from '@/lib/billing/entitlements';
import { recordUsage } from '@/lib/billing/usage-meter';
import { sabsmsEngine } from '@/lib/sabsms/engine-client';
import { sendSabcrmEmailCore, firstRecordEmail } from './email-core';
import { firstRecordPhone, toWaId, digitsOnly } from './phone';
import { createActivity } from './activities.server';
import {
  resolveEmailSubject,
  renderTokens,
  channelOutcomeVerb,
  type CadenceStep,
} from './cadence-channels';

const RECORDS_COLL = 'sabcrm_records';
const SENDS_COLL = 'sabcrm_cadence_sends';
const PROJECTS_COLL = 'projects';

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The minimal enrollment shape the dispatcher needs. A superset of the Rust
 * `SabcrmRustEnrollment` and the native enrollment doc, so callers can pass
 * either without a mapping step.
 */
export interface CadenceEnrollmentRef {
  /** Enrollment id (idempotency + A/B seed). */
  id: string;
  projectId: string;
  /** The object slug the enrolled record belongs to (e.g. `leads`). */
  objectSlug: string;
  /** The enrolled record's id. */
  recordId: string;
}

/** Outcome of dispatching one cadence step. */
export interface DispatchResult {
  ok: boolean;
  /** History-friendly outcome slug (`email_sent` / `failed:no_phone` / …). */
  outcome: string;
  /** True when a prior identical dispatch was found (no re-send happened). */
  deduped?: boolean;
  /** Channel-specific id (messageId / activity id), when available. */
  externalId?: string;
}

/** Loose `sabcrm_records` doc shape (read direct from Mongo). */
interface RecordDoc {
  _id: ObjectId | string;
  projectId?: string;
  object?: string;
  data?: Record<string, unknown>;
  deletedAt?: unknown;
}

/* -------------------------------------------------------------------------- */
/* Idempotency ledger (sabcrm_cadence_sends)                                   */
/* -------------------------------------------------------------------------- */

/**
 * Reserve a `(enrollmentId, stepIndex)` slot. Returns the already-recorded
 * outcome when one exists (so the caller short-circuits), else `null` after
 * inserting a `pending` row. Best-effort — a DB hiccup returns `null` so the
 * dispatch still proceeds (at-least-once is acceptable; we prefer a send over a
 * silent drop, and the inner sends are themselves cheap-to-retry).
 */
async function reserveSlot(
  projectId: string,
  enrollmentId: string,
  stepIndex: number,
  channel: string,
): Promise<DispatchResult | null> {
  try {
    const { db } = await connectToDatabase();
    const now = new Date().toISOString();
    const existing = (await db.collection(SENDS_COLL).findOne({
      projectId,
      enrollmentId,
      stepIndex,
    })) as { outcome?: string; ok?: boolean; externalId?: string } | null;
    if (existing && existing.outcome && existing.outcome !== 'pending') {
      return {
        ok: existing.ok === true,
        outcome: existing.outcome,
        deduped: true,
        externalId: existing.externalId,
      };
    }
    if (!existing) {
      await db.collection(SENDS_COLL).insertOne({
        projectId,
        enrollmentId,
        stepIndex,
        channel,
        outcome: 'pending',
        ok: false,
        createdAt: now,
        updatedAt: now,
      });
    }
    return null;
  } catch {
    return null;
  }
}

/** Stamp the final outcome on the ledger row. Best-effort. */
async function finalizeSlot(
  projectId: string,
  enrollmentId: string,
  stepIndex: number,
  result: DispatchResult,
): Promise<void> {
  try {
    const { db } = await connectToDatabase();
    await db.collection(SENDS_COLL).updateOne(
      { projectId, enrollmentId, stepIndex },
      {
        $set: {
          ok: result.ok,
          outcome: result.outcome,
          externalId: result.externalId ?? null,
          updatedAt: new Date().toISOString(),
        },
        $setOnInsert: { projectId, enrollmentId, stepIndex, createdAt: new Date().toISOString() },
      },
      { upsert: true },
    );
  } catch {
    /* best-effort */
  }
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

/** Read one record's `data` direct from Mongo (scalar read; no metadata). */
async function loadRecordData(
  projectId: string,
  recordId: string,
): Promise<Record<string, unknown> | null> {
  if (!projectId || !recordId || !ObjectId.isValid(recordId)) return null;
  try {
    const { db } = await connectToDatabase();
    const doc = (await db
      .collection(RECORDS_COLL)
      .findOne({ _id: new ObjectId(recordId), projectId })) as RecordDoc | null;
    if (!doc || doc.deletedAt) return null;
    return doc.data ?? {};
  } catch {
    return null;
  }
}

/**
 * Resolve the user's first SabSMS workspace id (= the `_id` of a `kind:'sms'`
 * project they own or are an agent of) DIRECT from Mongo — the sessionless twin
 * of `getSabsmsWorkspaceId`. Returns `null` when the user has no SMS project.
 */
async function resolveSmsWorkspaceId(userId: string): Promise<string | null> {
  if (!userId || !ObjectId.isValid(userId)) return null;
  try {
    const { db } = await connectToDatabase();
    const uid = new ObjectId(userId);
    const project = await db.collection(PROJECTS_COLL).findOne({
      kind: 'sms',
      $or: [{ userId: uid }, { 'agents.userId': uid }],
    });
    return project ? String(project._id) : null;
  } catch {
    return null;
  }
}

/** Best-effort timeline activity; never throws. Returns the activity id or null. */
async function logCadenceActivity(
  projectId: string,
  userId: string,
  objectSlug: string,
  recordId: string,
  type: 'NOTE' | 'TASK' | 'CALL',
  title: string,
  body: string,
): Promise<string | null> {
  try {
    const a = await createActivity({
      projectId,
      type,
      title: title.slice(0, 180),
      body,
      targetObject: objectSlug,
      targetRecordId: recordId,
      authorId: userId,
    });
    return a._id;
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Per-channel dispatchers                                                     */
/* -------------------------------------------------------------------------- */

async function dispatchEmail(
  userId: string,
  enrollment: CadenceEnrollmentRef,
  step: CadenceStep,
  data: Record<string, unknown>,
): Promise<DispatchResult> {
  const to = firstRecordEmail(null, data);
  if (!to) return { ok: false, outcome: 'failed:no_email' };

  const { subject, variantId } = resolveEmailSubject(step, enrollment.id);
  const renderedSubject = renderTokens(subject, data);
  const renderedBody = renderTokens(step.body ?? '', data);
  if (!renderedSubject) return { ok: false, outcome: 'failed:no_subject' };
  if (!renderedBody) return { ok: false, outcome: 'failed:empty_body' };

  const res = await sendSabcrmEmailCore({
    userId,
    projectId: enrollment.projectId,
    objectSlug: enrollment.objectSlug,
    recordId: enrollment.recordId,
    to,
    subject: renderedSubject,
    body: renderedBody,
  });
  if (!res.ok) return { ok: false, outcome: `failed:${res.error ?? 'email'}` };
  // The A/B arm that fired is recorded in the outcome for variant reporting.
  const outcome = variantId
    ? `email_sent:variant=${variantId}`
    : channelOutcomeVerb('email');
  return { ok: true, outcome, externalId: res.messageId };
}

async function dispatchSms(
  userId: string,
  enrollment: CadenceEnrollmentRef,
  step: CadenceStep,
  data: Record<string, unknown>,
): Promise<DispatchResult> {
  const phone = firstRecordPhone(null, data);
  // Use full E.164 (with +) for the SMS engine; fall back to digits.
  const to = toWaId(phone) ? `+${toWaId(phone)}` : '';
  const digits = digitsOnly(phone);
  if (!to && (!digits || digits.length < 8)) {
    return { ok: false, outcome: 'failed:no_phone' };
  }
  const dest = to || `+${digits}`;

  const body = renderTokens(step.body ?? '', data);
  if (!body) return { ok: false, outcome: 'failed:empty_body' };

  // Metering: SMS counts against `sms_segments`. canUse fails closed on cap.
  if (!(await canUse(userId, 'sms_segments'))) {
    return { ok: false, outcome: 'failed:sms_cap_reached' };
  }

  const workspaceId = await resolveSmsWorkspaceId(userId);
  if (!workspaceId) return { ok: false, outcome: 'failed:no_sms_workspace' };

  try {
    const sent = await sabsmsEngine.enqueueSend({
      workspaceId,
      to: dest,
      body,
      category: 'transactional',
      // Idempotency at the engine layer too (in addition to our ledger).
      idempotencyKey: `cadence:${enrollment.id}:${step.id}`,
      tags: ['sabcrm-cadence'],
    });
    if (sent.status === 'suppressed') {
      return { ok: false, outcome: 'failed:sms_engine_disabled' };
    }
    // Record consumed segments (best-effort; default 1 when the engine omits).
    await recordUsage({
      tenantId: userId,
      feature: 'sms_segments',
      units: Number.isFinite(sent.segments) && sent.segments! > 0 ? sent.segments! : 1,
      idempotencyKey: `cadence-sms:${enrollment.id}:${step.id}`,
      meta: { source: 'sabcrm-cadence', enrollmentId: enrollment.id },
    }).catch(() => undefined);

    await logCadenceActivity(
      enrollment.projectId,
      userId,
      enrollment.objectSlug,
      enrollment.recordId,
      'CALL',
      `SMS to ${dest}`,
      body,
    );
    return { ok: true, outcome: channelOutcomeVerb('sms'), externalId: sent.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'sms';
    return { ok: false, outcome: `failed:${msg}`.slice(0, 120) };
  }
}

async function dispatchWhatsapp(
  userId: string,
  enrollment: CadenceEnrollmentRef,
  step: CadenceStep,
  data: Record<string, unknown>,
): Promise<DispatchResult> {
  const phone = firstRecordPhone(null, data);
  const digits = digitsOnly(phone);
  if (!digits || digits.length < 8) {
    return { ok: false, outcome: 'failed:no_phone' };
  }
  const body = renderTokens(step.body ?? '', data);
  if (!body) return { ok: false, outcome: 'failed:empty_body' };

  // Metering: WhatsApp counts against `messages_sent`. Fail closed on cap.
  if (!(await canUse(userId, 'messages_sent'))) {
    return { ok: false, outcome: 'failed:wa_cap_reached' };
  }

  try {
    // Reuse the existing CRM→WaChat send path verbatim (it re-resolves the
    // thread server-side, sends, and logs a WHATSAPP activity on the record).
    // It is gated on a session; in a sessionless scheduler context the gate
    // returns an error string, which we record as a soft failure (no crash).
    const { sendSabcrmWhatsappMessage } = await import(
      '@/app/actions/sabcrm-comms.actions'
    );
    const res = await sendSabcrmWhatsappMessage(
      enrollment.projectId,
      enrollment.objectSlug,
      enrollment.recordId,
      body,
    );
    if (!res.ok) return { ok: false, outcome: `failed:${res.error}`.slice(0, 120) };

    await recordUsage({
      tenantId: userId,
      feature: 'messages_sent',
      units: 1,
      idempotencyKey: `cadence-wa:${enrollment.id}:${step.id}`,
      meta: { source: 'sabcrm-cadence', enrollmentId: enrollment.id },
    }).catch(() => undefined);

    return { ok: true, outcome: channelOutcomeVerb('whatsapp') };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'whatsapp';
    return { ok: false, outcome: `failed:${msg}`.slice(0, 120) };
  }
}

async function dispatchTask(
  userId: string,
  enrollment: CadenceEnrollmentRef,
  step: CadenceStep,
  data: Record<string, unknown>,
): Promise<DispatchResult> {
  const title = renderTokens(step.title || step.subject || 'Cadence task', data);
  const body = renderTokens(step.body ?? '', data);
  const id = await logCadenceActivity(
    enrollment.projectId,
    userId,
    enrollment.objectSlug,
    enrollment.recordId,
    'TASK',
    title || 'Cadence task',
    body,
  );
  if (!id) return { ok: false, outcome: 'failed:task_create' };
  return { ok: true, outcome: channelOutcomeVerb('task'), externalId: id };
}

/* -------------------------------------------------------------------------- */
/* Public entry point                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Dispatch ONE multichannel cadence step for an enrollment. Routes to the
 * matching SabNode engine, records the send (idempotent per
 * `(enrollmentId, stepIndex)`), logs a timeline activity and honours per-send
 * metering for SMS / WhatsApp. Best-effort: it NEVER throws — failures come
 * back as `{ ok: false, outcome: 'failed:…' }` so the scheduler can advance or
 * retry without crashing the tick.
 *
 * `stepIndex` defaults to a value derived from the step id when the caller does
 * not supply it; pass the enrollment's `currentStepIndex` for accurate dedupe.
 */
export async function dispatchCadenceStep(
  projectId: string,
  enrollment: CadenceEnrollmentRef & { userId: string; stepIndex?: number },
  step: CadenceStep,
): Promise<DispatchResult> {
  const userId = enrollment.userId;
  const ref: CadenceEnrollmentRef = {
    id: enrollment.id,
    projectId,
    objectSlug: enrollment.objectSlug,
    recordId: enrollment.recordId,
  };

  if (!step || !step.channel) return { ok: false, outcome: 'failed:no_step' };

  // WAIT is a pure no-op; nothing to record beyond the verb.
  if (step.channel === 'wait') {
    return { ok: true, outcome: channelOutcomeVerb('wait') };
  }
  if (!userId) return { ok: false, outcome: 'failed:no_user' };

  // Idempotency key: the enrollment's current step index. When the caller does
  // not supply one (e.g. a test send), `dedupeIndex` stays -1 and the ledger is
  // skipped entirely, so the dispatch always fires fresh.
  const dedupeIndex =
    typeof enrollment.stepIndex === 'number' && enrollment.stepIndex >= 0
      ? enrollment.stepIndex
      : -1;

  // Short-circuit a prior dispatch of the same (enrollment, stepIndex).
  if (dedupeIndex >= 0) {
    const prior = await reserveSlot(projectId, ref.id, dedupeIndex, step.channel);
    if (prior) return prior;
  }

  const data = await loadRecordData(projectId, ref.recordId);
  if (!data) {
    const miss: DispatchResult = { ok: false, outcome: 'failed:record_gone' };
    if (dedupeIndex >= 0) await finalizeSlot(projectId, ref.id, dedupeIndex, miss);
    return miss;
  }

  let result: DispatchResult;
  switch (step.channel) {
    case 'email':
      result = await dispatchEmail(userId, ref, step, data);
      break;
    case 'sms':
      result = await dispatchSms(userId, ref, step, data);
      break;
    case 'whatsapp':
      result = await dispatchWhatsapp(userId, ref, step, data);
      break;
    case 'task':
      result = await dispatchTask(userId, ref, step, data);
      break;
    default:
      result = { ok: false, outcome: `failed:unknown_channel:${step.channel}` };
  }

  if (dedupeIndex >= 0) {
    await finalizeSlot(projectId, ref.id, dedupeIndex, result);
  }
  return result;
}
