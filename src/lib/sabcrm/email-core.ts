import 'server-only';

/**
 * SabCRM email core — the low-level, session-OPTIONAL send + log path that
 * both the record-detail Email tab (`sabcrm-email.actions.ts`) and future
 * automation passes (e.g. sabcrm-sequences' email steps in the scheduler)
 * share.
 *
 * Delivery rides **SabMail** the same way SabBigin's `sendSabbiginEmail`
 * does (`src/app/actions/sabbigin-email.actions.ts`):
 *
 *   1. real delivery through `dispatchTransactionalEmail` (the platform
 *      nodemailer transport resolved from the tenant's `email_settings`);
 *   2. best-effort recording into SabMail (`sendMailMessage` against the
 *      tenant's first active SabMail account) so the send threads in the
 *      unified inbox — skipped silently when no session/account exists;
 *   3. non-fatal `EMAIL` activity on the SabCRM record, created through the
 *      Rust engine with `rustFetchAs(userId, …)` so it works WITHOUT a
 *      session cookie (scheduler / webhook contexts included).
 *
 * Nothing here reads the session: the caller resolves `userId` + `projectId`
 * first (the server actions run their gate pipeline; the scheduler owns its
 * own identity plumbing).
 */

import { dispatchTransactionalEmail } from '@/lib/email-dispatcher';
import { rustFetchAs } from '@/lib/rust-client/fetcher';
import type { SabcrmRustActivity } from '@/lib/rust-client/sabcrm-activities';
import type { OutboundMailEnvelope } from '@/lib/mailbox/imail-transport';
import type { ObjectMetadata } from '@/lib/sabcrm/types';

/* ------------------------------------------------------------------------ */
/* Email-field resolution (mirrors the phone resolution in                   */
/* sabcrm-comms.actions.ts — object metadata drives which data.* keys hold   */
/* EMAIL / EMAILS values, in field order)                                    */
/* ------------------------------------------------------------------------ */

/** Narrow an unknown to a plain object record. */
function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

/** Loose but practical email shape check. */
function looksLikeEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

/**
 * Pull ONE address out of an EMAIL / EMAILS field value. Tolerates plain
 * strings, arrays of strings / objects and Twenty's
 * `{ primaryEmail, additionalEmails[] }` composite (the same shapes the 20ui
 * field renderers parse — see `composites/record/fields/composite.tsx`).
 */
export function emailFromValue(value: unknown): string {
  if (typeof value === 'string') {
    const v = value.trim();
    return looksLikeEmail(v) ? v : '';
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const e = emailFromValue(item);
      if (e) return e;
    }
    return '';
  }
  const rec = asRecord(value);
  if (!rec) return '';
  for (const key of ['primaryEmail', 'email', 'value', 'address']) {
    const e = emailFromValue(rec[key]);
    if (e) return e;
  }
  const extra = rec.additionalEmails;
  return Array.isArray(extra) ? emailFromValue(extra) : '';
}

/**
 * The `data.*` keys that may hold an email for this object: typed
 * EMAIL / EMAILS fields in field order, then the bare `email` / `emails`
 * fallbacks for objects without typed email fields.
 */
export function emailFieldKeys(object: ObjectMetadata | null): string[] {
  const keys: string[] = [];
  for (const f of object?.fields ?? []) {
    if (f.type === 'EMAIL' || f.type === 'EMAILS') keys.push(f.key);
  }
  for (const k of ['email', 'emails']) {
    if (!keys.includes(k)) keys.push(k);
  }
  return keys;
}

/** The record's first email — field order decides, fallback keys last. */
export function firstRecordEmail(
  object: ObjectMetadata | null,
  data: Record<string, unknown>,
): string {
  for (const key of emailFieldKeys(object)) {
    const e = emailFromValue(data[key]);
    if (e) return e;
  }
  return '';
}

/* ------------------------------------------------------------------------ */
/* Send + log core                                                           */
/* ------------------------------------------------------------------------ */

export interface SendSabcrmEmailCoreInput {
  /** Tenant user the transport credentials + SabMail account belong to. */
  userId: string;
  /** SabCRM project the activity is scoped to. */
  projectId: string;
  /** Record the EMAIL activity attaches to. */
  objectSlug: string;
  recordId: string;
  /** Recipient address (already resolved from the record). */
  to: string;
  subject: string;
  /** Plain text or HTML body. */
  body: string;
}

export interface SendSabcrmEmailCoreResult {
  ok: boolean;
  error?: string;
  messageId?: string;
  /**
   * The `EMAIL` activity logged on the record, or null when the mail went
   * out but logging failed (non-fatal, mirrors the WhatsApp send).
   */
  activity: SabcrmRustActivity | null;
}

/** Raw `{ activity }` envelope from `POST /v1/sabcrm/activities`. */
interface ActivityEnvelope {
  activity: SabcrmRustActivity;
}

/**
 * Deliver one email and log it on the record. Session-optional — see the
 * module doc. Failure to DELIVER is fatal (`ok: false`); failure to record
 * into SabMail or to log the activity is not.
 */
export async function sendSabcrmEmailCore(
  input: SendSabcrmEmailCoreInput,
): Promise<SendSabcrmEmailCoreResult> {
  const to = (input.to ?? '').trim();
  const subject = (input.subject ?? '').trim();
  if (!to) return { ok: false, error: 'A recipient is required.', activity: null };
  if (!subject) return { ok: false, error: 'A subject is required.', activity: null };
  if (!(input.body ?? '').trim()) {
    return { ok: false, error: 'The email body is empty.', activity: null };
  }

  const html = /<[a-z][\s\S]*>/i.test(input.body)
    ? input.body
    : `<div style="font-family:system-ui,sans-serif;white-space:pre-wrap">${input.body}</div>`;

  // 1. real delivery via the platform transport (tenant `email_settings`).
  const delivery = await dispatchTransactionalEmail({
    tenantUserId: input.userId,
    to,
    subject,
    html,
    body: input.body,
  });
  if (!delivery.ok) {
    return {
      ok: false,
      activity: null,
      error:
        delivery.error === 'email_settings_missing'
          ? 'No sender is configured yet. Set one up under Email settings.'
          : delivery.error?.startsWith('send_failed')
            ? 'Email could not be delivered. Check your email settings.'
            : delivery.error ?? 'Send failed.',
    };
  }

  // 2. record into SabMail (best-effort; needs a session — silently skipped
  //    in sessionless contexts like the sequences scheduler).
  try {
    const { listMailAccounts, sendMailMessage } = await import(
      '@/app/actions/mailbox.actions'
    );
    const accounts = await listMailAccounts({ status: 'active', limit: 1 });
    const account = accounts[0];
    const fromAddress = account?.emailAddress ?? account?.localPart;
    if (account?._id && fromAddress) {
      const envelope: OutboundMailEnvelope = {
        accountId: account._id,
        from: { email: fromAddress, name: account.displayName },
        to: [{ email: to }],
        subject,
        html,
        text: input.body,
      };
      await sendMailMessage(envelope);
    }
  } catch {
    /* SabMail recording is best-effort */
  }

  // 3. EMAIL activity on the record (non-fatal). `rustFetchAs` mints the JWT
  //    from the explicit userId so this works without a session cookie.
  let activity: SabcrmRustActivity | null = null;
  try {
    const res = await rustFetchAs<ActivityEnvelope>(
      input.userId,
      '/v1/sabcrm/activities',
      {
        method: 'POST',
        body: JSON.stringify({
          projectId: input.projectId,
          type: 'EMAIL',
          title: `Email to ${to}: ${subject}`,
          body: input.body,
          targetObject: input.objectSlug,
          targetRecordId: input.recordId,
          authorId: input.userId,
        }),
      },
    );
    activity = res.activity;
  } catch {
    activity = null;
  }

  return { ok: true, messageId: delivery.messageId, activity };
}
