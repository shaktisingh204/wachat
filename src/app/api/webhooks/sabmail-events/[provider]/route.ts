/**
 * POST /api/webhooks/sabmail-events/[provider]
 *
 * SabMail deliverability event ingestion. Receives delivery/bounce/open/etc.
 * events from the supported email providers, verifies the signature (best
 * effort), normalises each event, persists it to
 * `SABMAIL_COLLECTIONS.events`, and feeds bounces/complaints/drops into the
 * per-workspace suppression list.
 *
 * Tenancy: this is a webhook — NO session/cookie. The platform configures a
 * distinct URL per workspace, so the workspace key arrives as the REQUIRED
 * `?workspaceId=` query param and is stamped onto every event + suppression
 * doc. `getSabmailWorkspaceId()` is NEVER called here.
 *
 * Signature verification (per the R&D note, verified against primary sources):
 *  - sendgrid → ECDSA P-256 over `timestamp + rawBody`, header
 *    `X-Twilio-Email-Event-Webhook-Signature` (+ `…-Timestamp`).
 *  - mailgun  → HMAC-SHA256 hex over `timestamp + token`, key = signing key.
 *  - resend   → Svix: HMAC-SHA256 over `${svix-id}.${svix-timestamp}.${body}`,
 *    secret base64 after `whsec_`, sig = space-separated `v1,<b64>`.
 *  - ses      → SNS envelope (X.509, SignatureVersion 2/SHA256); the SES event
 *    is stringified JSON in `Message`. SubscriptionConfirmation is auto-acked.
 *
 * Each provider's secret is read from `SABMAIL_<PROVIDER>_WEBHOOK_SECRET`
 * (SendGrid: the signed-event public key). When no secret is configured the
 * request is accepted (dev) and the skip is logged.
 */

import { NextResponse, type NextRequest } from 'next/server';
import crypto from 'node:crypto';

import { connectToDatabase } from '@/lib/mongodb';
import { SABMAIL_COLLECTIONS } from '@/lib/sabmail/db/collections';
import {
  addSabmailSuppression,
  type SabmailSuppressionReason,
} from '@/lib/sabmail/suppressions';
import { getErrorMessage } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/* ──────────────────────────────────────────────────────────────────────
 * Types
 * ──────────────────────────────────────────────────────────────────── */

type SabmailEventProvider = 'sendgrid' | 'mailgun' | 'resend' | 'ses';

type SabmailEventName =
  | 'delivered'
  | 'bounce'
  | 'complaint'
  | 'open'
  | 'click'
  | 'deferred'
  | 'dropped'
  | 'unsubscribe'
  | 'other';

interface NormalizedEvent {
  provider: SabmailEventProvider;
  event: SabmailEventName;
  email: string;
  messageId: string;
  ts: number;
  raw: unknown;
  /** Provider-native id for dedupe (sg_event_id | event-data.id | svix-id | …). */
  dedupeId?: string;
  /** SendGrid `sg_machine_open`; other providers have no flag. */
  machineOpen?: boolean;
  bounceType?: 'permanent' | 'transient';
  detail?: string;
}

/** The stored shape required by the brief: {provider,event,email,messageId,ts,raw}. */
interface SabmailEventDoc {
  workspaceId: string;
  provider: SabmailEventProvider;
  event: SabmailEventName;
  email: string;
  messageId: string;
  ts: number;
  raw: unknown;
  dedupeId?: string;
  machineOpen?: boolean;
  bounceType?: 'permanent' | 'transient';
  detail?: string;
  createdAt: Date;
}

const PROVIDERS: readonly SabmailEventProvider[] = [
  'sendgrid',
  'mailgun',
  'resend',
  'ses',
];

function isProvider(value: string): value is SabmailEventProvider {
  return (PROVIDERS as readonly string[]).includes(value);
}

/** Reasons that trigger suppression. */
const SUPPRESS_EVENTS: ReadonlySet<SabmailEventName> = new Set([
  'bounce',
  'complaint',
  'dropped',
]);

function suppressionReasonFor(
  event: SabmailEventName,
): SabmailSuppressionReason {
  if (event === 'complaint') return 'complaint';
  return 'bounce'; // bounce + dropped both block as a bounce-class signal
}

function lc(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/* ──────────────────────────────────────────────────────────────────────
 * Signature verification (best-effort, per provider)
 * ──────────────────────────────────────────────────────────────────── */

function secretFor(provider: SabmailEventProvider): string | undefined {
  const key = `SABMAIL_${provider.toUpperCase()}_WEBHOOK_SECRET`;
  const value = process.env[key];
  return value && value.length > 0 ? value : undefined;
}

/** SendGrid: ECDSA P-256 over `timestamp + rawBody`. Public key is base64 DER SPKI. */
function verifySendgrid(
  rawBody: Buffer,
  req: NextRequest,
  publicKeyB64: string,
): boolean {
  try {
    const sigB64 = req.headers.get('x-twilio-email-event-webhook-signature');
    const ts = req.headers.get('x-twilio-email-event-webhook-timestamp');
    if (!sigB64 || !ts) return false;
    const key = crypto.createPublicKey({
      key: Buffer.from(publicKeyB64, 'base64'),
      format: 'der',
      type: 'spki',
    });
    const signed = Buffer.concat([Buffer.from(ts, 'utf8'), rawBody]);
    return crypto
      .createVerify('sha256')
      .update(signed)
      .end()
      .verify({ key, dsaEncoding: 'der' }, Buffer.from(sigB64, 'base64'));
  } catch {
    return false;
  }
}

/** Mailgun: HMAC-SHA256 hex over `timestamp + token`, signing key. */
function verifyMailgun(parsed: unknown, signingKey: string): boolean {
  try {
    const sig = (parsed as { signature?: Record<string, unknown> } | null)
      ?.signature;
    const timestamp = String(sig?.timestamp ?? '');
    const token = String(sig?.token ?? '');
    const signature = String(sig?.signature ?? '');
    if (!timestamp || !token || !signature) return false;
    const expected = crypto
      .createHmac('sha256', signingKey)
      .update(timestamp + token)
      .digest('hex');
    return timingSafeEqualStr(expected, signature);
  } catch {
    return false;
  }
}

/** Resend (Svix): HMAC-SHA256 over `${id}.${ts}.${body}`; sig = "v1,<b64>" list. */
function verifyResend(
  rawBody: string,
  req: NextRequest,
  secret: string,
): boolean {
  try {
    const id = req.headers.get('svix-id');
    const ts = req.headers.get('svix-timestamp');
    const sig = req.headers.get('svix-signature');
    if (!id || !ts || !sig) return false;
    const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
    const signed = `${id}.${ts}.${rawBody}`;
    const expected = crypto
      .createHmac('sha256', key)
      .update(signed)
      .digest('base64');
    return sig.split(' ').some((part) => {
      const candidate = part.split(',')[1];
      return Boolean(candidate) && timingSafeEqualStr(candidate, expected);
    });
  } catch {
    return false;
  }
}

/**
 * SES via SNS: verify the SNS envelope signature (SignatureVersion 1/2,
 * SHA1/SHA256, X.509 cert fetched from `SigningCertURL` on an AWS host).
 * Hand-rolled (no `sns-validator` dependency, per the no-uninstalled-package
 * rule). Returns false on any anomaly.
 */
async function verifySnsEnvelope(envelope: unknown): Promise<boolean> {
  try {
    const msg = envelope as Record<string, unknown> | null;
    if (!msg) return false;
    const certUrlRaw = String(msg.SigningCertURL ?? '');
    if (!certUrlRaw) return false;

    const certUrl = new URL(certUrlRaw);
    // Only trust the official AWS SNS cert hosts.
    if (
      certUrl.protocol !== 'https:' ||
      !/(^|\.)amazonaws\.com$/.test(certUrl.hostname) ||
      !/^sns\./.test(certUrl.hostname)
    ) {
      return false;
    }

    const version = String(msg.SignatureVersion ?? '1');
    const hashAlg = version === '2' ? 'RSA-SHA256' : 'RSA-SHA1';

    // Canonical string to sign — field order is fixed by SNS per message type.
    const type = String(msg.Type ?? '');
    const fields =
      type === 'Notification'
        ? ['Message', 'MessageId', 'Subject', 'Timestamp', 'TopicArn', 'Type']
        : ['Message', 'MessageId', 'SubscribeURL', 'Timestamp', 'Token', 'TopicArn', 'Type'];

    let stringToSign = '';
    for (const field of fields) {
      const value = msg[field];
      if (value === undefined || value === null) continue;
      stringToSign += `${field}\n${String(value)}\n`;
    }

    const res = await fetch(certUrl.toString());
    if (!res.ok) return false;
    const pem = await res.text();

    const signature = Buffer.from(String(msg.Signature ?? ''), 'base64');
    return crypto
      .createVerify(hashAlg)
      .update(stringToSign, 'utf8')
      .verify(pem, signature);
  } catch {
    return false;
  }
}

/* ──────────────────────────────────────────────────────────────────────
 * Normalisers (one per provider) → NormalizedEvent[]
 * ──────────────────────────────────────────────────────────────────── */

function mapSendgridEvent(name: string): SabmailEventName {
  switch (name) {
    case 'delivered':
      return 'delivered';
    case 'bounce':
      return 'bounce';
    case 'dropped':
      return 'dropped';
    case 'spamreport':
      return 'complaint';
    case 'open':
      return 'open';
    case 'click':
      return 'click';
    case 'deferred':
      return 'deferred';
    case 'unsubscribe':
    case 'group_unsubscribe':
      return 'unsubscribe';
    default:
      return 'other';
  }
}

function normalizeSendgrid(parsed: unknown): NormalizedEvent[] {
  const arr = Array.isArray(parsed) ? parsed : [];
  const out: NormalizedEvent[] = [];
  for (const item of arr) {
    const e = item as Record<string, unknown>;
    const tsSec = Number(e['timestamp']);
    out.push({
      provider: 'sendgrid',
      event: mapSendgridEvent(String(e['event'] ?? '')),
      email: lc(e['email']),
      messageId: String(e['sg_message_id'] ?? ''),
      ts: Number.isFinite(tsSec) ? tsSec * 1000 : Date.now(),
      raw: e,
      dedupeId: e['sg_event_id'] ? String(e['sg_event_id']) : undefined,
      machineOpen: e['sg_machine_open'] === true,
      bounceType:
        String(e['event'] ?? '') === 'bounce'
          ? 'permanent'
          : undefined,
      detail: e['reason'] ? String(e['reason']) : undefined,
    });
  }
  return out;
}

function mapMailgunEvent(
  name: string,
  severity: string,
): { event: SabmailEventName; bounceType?: 'permanent' | 'transient' } {
  switch (name) {
    case 'delivered':
      return { event: 'delivered' };
    case 'opened':
      return { event: 'open' };
    case 'clicked':
      return { event: 'click' };
    case 'complained':
      return { event: 'complaint' };
    case 'unsubscribed':
      return { event: 'unsubscribe' };
    case 'failed':
      return severity === 'temporary'
        ? { event: 'deferred', bounceType: 'transient' }
        : { event: 'bounce', bounceType: 'permanent' };
    default:
      return { event: 'other' };
  }
}

function normalizeMailgun(parsed: unknown): NormalizedEvent[] {
  const data = (parsed as { 'event-data'?: Record<string, unknown> } | null)?.[
    'event-data'
  ];
  if (!data) return [];
  const severity = String(data['severity'] ?? '');
  const { event, bounceType } = mapMailgunEvent(
    String(data['event'] ?? ''),
    severity,
  );
  const tsSec = Number(data['timestamp']); // float epoch seconds
  const message = data['message'] as
    | { headers?: { 'message-id'?: unknown } }
    | undefined;
  return [
    {
      provider: 'mailgun',
      event,
      email: lc(data['recipient']),
      messageId: String(message?.headers?.['message-id'] ?? ''),
      ts: Number.isFinite(tsSec) ? Math.round(tsSec * 1000) : Date.now(),
      raw: data,
      dedupeId: data['id'] ? String(data['id']) : undefined,
      machineOpen: false, // Mailgun has no MPP flag
      bounceType,
      detail: data['reason'] ? String(data['reason']) : undefined,
    },
  ];
}

function mapResendEvent(type: string): {
  event: SabmailEventName;
  bounceType?: 'permanent' | 'transient';
} {
  switch (type) {
    case 'email.delivered':
      return { event: 'delivered' };
    case 'email.bounced':
      return { event: 'bounce' };
    case 'email.complained':
      return { event: 'complaint' };
    case 'email.opened':
      return { event: 'open' };
    case 'email.clicked':
      return { event: 'click' };
    case 'email.delivery_delayed':
      return { event: 'deferred', bounceType: 'transient' };
    case 'email.sent':
    default:
      return { event: 'other' };
  }
}

function normalizeResend(
  parsed: unknown,
  svixId: string | null,
): NormalizedEvent[] {
  const body = parsed as Record<string, unknown> | null;
  if (!body) return [];
  const data = (body['data'] ?? {}) as Record<string, unknown>;
  const { event, bounceType } = mapResendEvent(String(body['type'] ?? ''));
  const to = data['to'];
  const email = Array.isArray(to) ? lc(to[0]) : lc(to);
  const createdAt = String(body['created_at'] ?? data['created_at'] ?? '');
  const tsMs = createdAt ? Date.parse(createdAt) : NaN;
  const bounce = data['bounce'] as { type?: unknown; message?: unknown } | undefined;
  const resolvedBounceType =
    lc(bounce?.type) === 'permanent'
      ? 'permanent'
      : lc(bounce?.type) === 'transient'
        ? 'transient'
        : bounceType;
  return [
    {
      provider: 'resend',
      event:
        // a Resend "bounced" with a Transient type is really a soft/deferred
        event === 'bounce' && resolvedBounceType === 'transient'
          ? 'deferred'
          : event,
      email,
      messageId: String(data['email_id'] ?? ''),
      ts: Number.isFinite(tsMs) ? tsMs : Date.now(),
      raw: body,
      // The body has no stable event id — Svix message id is the dedupe key.
      dedupeId: svixId ?? undefined,
      machineOpen: false, // Resend has no MPP flag
      bounceType: resolvedBounceType,
      detail: bounce?.message ? String(bounce.message) : undefined,
    },
  ];
}

function firstRecipient(...lists: Array<unknown>): string {
  for (const list of lists) {
    if (Array.isArray(list) && list.length > 0) {
      const first = list[0];
      if (first && typeof first === 'object' && 'emailAddress' in first) {
        return lc((first as { emailAddress?: unknown }).emailAddress);
      }
      return lc(first);
    }
  }
  return '';
}

function mapSesEvent(
  type: string,
  bounceType: string,
): { event: SabmailEventName; bounceType?: 'permanent' | 'transient' } {
  switch (type) {
    case 'Delivery':
      return { event: 'delivered' };
    case 'Open':
      return { event: 'open' };
    case 'Click':
      return { event: 'click' };
    case 'Complaint':
      return { event: 'complaint' };
    case 'DeliveryDelay':
      return { event: 'deferred', bounceType: 'transient' };
    case 'Bounce':
      return bounceType === 'Permanent'
        ? { event: 'bounce', bounceType: 'permanent' }
        : { event: 'deferred', bounceType: 'transient' };
    default:
      return { event: 'other' };
  }
}

function normalizeSes(sesEvent: unknown): NormalizedEvent[] {
  const e = sesEvent as Record<string, unknown> | null;
  if (!e) return [];
  // event-publishing uses `eventType`; legacy notifications use `notificationType`.
  const type = String(e['eventType'] ?? e['notificationType'] ?? '');
  const mail = e['mail'] as
    | { messageId?: unknown; destination?: unknown }
    | undefined;
  const bounce = e['bounce'] as
    | {
        bounceType?: unknown;
        bouncedRecipients?: unknown;
        feedbackId?: unknown;
        timestamp?: unknown;
      }
    | undefined;
  const complaint = e['complaint'] as
    | { complainedRecipients?: unknown; feedbackId?: unknown; timestamp?: unknown }
    | undefined;
  const delivery = e['delivery'] as
    | { recipients?: unknown; timestamp?: unknown }
    | undefined;

  const { event, bounceType } = mapSesEvent(
    type,
    String(bounce?.bounceType ?? ''),
  );

  const email = firstRecipient(
    bounce?.bouncedRecipients,
    complaint?.complainedRecipients,
    delivery?.recipients,
    mail?.destination,
  );

  const tsRaw = String(
    bounce?.timestamp ??
      complaint?.timestamp ??
      delivery?.timestamp ??
      '',
  );
  const tsMs = tsRaw ? Date.parse(tsRaw) : NaN;
  const messageId = String(mail?.messageId ?? '');

  // SES has no per-event id — prefer feedbackId, else a stable composite.
  const feedbackId = String(bounce?.feedbackId ?? complaint?.feedbackId ?? '');
  const dedupeId =
    feedbackId || `${messageId}|${type}|${email}|${tsRaw}`;

  return [
    {
      provider: 'ses',
      event,
      email,
      messageId,
      ts: Number.isFinite(tsMs) ? tsMs : Date.now(),
      raw: e,
      dedupeId,
      machineOpen: false, // SES has no MPP flag
      bounceType,
      detail: undefined,
    },
  ];
}

/* ──────────────────────────────────────────────────────────────────────
 * Handler
 * ──────────────────────────────────────────────────────────────────── */

async function handle(
  req: NextRequest,
  ctx: { params: Promise<{ provider: string }> },
): Promise<NextResponse> {
  const { provider: providerRaw } = await ctx.params;
  const provider = lc(providerRaw);

  if (!isProvider(provider)) {
    return NextResponse.json(
      { ok: false, error: `Unknown provider: ${provider}` },
      { status: 404 },
    );
  }

  const workspaceId = new URL(req.url).searchParams.get('workspaceId') ?? '';
  if (!workspaceId) {
    return NextResponse.json(
      { ok: false, error: 'Missing required ?workspaceId= query param.' },
      { status: 400 },
    );
  }

  // Read the RAW body once — signature verification needs the exact bytes.
  const rawBody = await req.text();

  let parsed: unknown;
  try {
    parsed = rawBody.length > 0 ? JSON.parse(rawBody) : null;
  } catch {
    // SES posts with Content-Type text/plain but the body is still JSON; a
    // genuine parse failure is a malformed request.
    return NextResponse.json(
      { ok: false, error: 'Body is not valid JSON.' },
      { status: 400 },
    );
  }

  /* ---- Signature verification (best-effort) ------------------------- */
  const secret = secretFor(provider);
  if (!secret && provider !== 'ses') {
    console.warn(
      `[sabmail-events] no SABMAIL_${provider.toUpperCase()}_WEBHOOK_SECRET configured — accepting unverified event (dev).`,
    );
  } else {
    let verified = false;
    switch (provider) {
      case 'sendgrid':
        verified = verifySendgrid(
          Buffer.from(rawBody, 'utf8'),
          req,
          secret as string,
        );
        break;
      case 'mailgun':
        verified = verifyMailgun(parsed, secret as string);
        break;
      case 'resend':
        verified = verifyResend(rawBody, req, secret as string);
        break;
      case 'ses':
        // SES is verified via the SNS envelope X.509 signature, not a secret.
        verified = await verifySnsEnvelope(parsed);
        break;
    }
    if (!verified) {
      return NextResponse.json(
        { ok: false, error: 'Signature verification failed.' },
        { status: 401 },
      );
    }
  }

  /* ---- SES SNS envelope unwrapping --------------------------------- */
  let normalized: NormalizedEvent[] = [];
  if (provider === 'ses') {
    const envelope = parsed as Record<string, unknown> | null;
    const snsType = String(envelope?.['Type'] ?? '');
    if (snsType === 'SubscriptionConfirmation') {
      // One-time subscribe confirmation — visit the SubscribeURL to confirm.
      const subscribeUrl = String(envelope?.['SubscribeURL'] ?? '');
      if (subscribeUrl) {
        await fetch(subscribeUrl).catch((e) =>
          console.error('[sabmail-events] SES subscribe confirm failed:', e),
        );
      }
      return NextResponse.json({ ok: true, processed: 0 });
    }
    if (snsType === 'UnsubscribeConfirmation') {
      return NextResponse.json({ ok: true, processed: 0 });
    }
    // Notification → the SES event is stringified JSON in `Message`.
    let sesEvent: unknown = null;
    try {
      sesEvent = JSON.parse(String(envelope?.['Message'] ?? 'null'));
    } catch {
      sesEvent = null;
    }
    normalized = normalizeSes(sesEvent);
  } else if (provider === 'sendgrid') {
    normalized = normalizeSendgrid(parsed);
  } else if (provider === 'mailgun') {
    normalized = normalizeMailgun(parsed);
  } else if (provider === 'resend') {
    normalized = normalizeResend(parsed, req.headers.get('svix-id'));
  }

  /* ---- Persist + suppress (with dedupe + MPP filter) --------------- */
  let processed = 0;
  try {
    const { db } = await connectToDatabase();
    const events = db.collection(SABMAIL_COLLECTIONS.events);

    // Idempotent dedupe index on the provider-native event id (sparse: not
    // every doc carries one). Best-effort — safe to call repeatedly.
    await events
      .createIndex(
        { workspaceId: 1, provider: 1, dedupeId: 1 },
        { unique: true, sparse: true },
      )
      .catch(() => undefined);

    for (const n of normalized) {
      // Filter Apple-MPP machine opens (SendGrid sg_machine_open) — never
      // record them as engagement.
      if (n.event === 'open' && n.machineOpen === true) continue;

      // Dedupe by the provider event id when present (webhooks are
      // at-least-once). Skip when an event with this id already exists.
      if (n.dedupeId) {
        const exists = await events.findOne(
          { workspaceId, provider, dedupeId: n.dedupeId },
          { projection: { _id: 1 } },
        );
        if (exists) continue;
      }

      const doc: SabmailEventDoc = {
        workspaceId,
        provider: n.provider,
        event: n.event,
        email: n.email,
        messageId: n.messageId,
        ts: n.ts,
        raw: n.raw,
        dedupeId: n.dedupeId,
        machineOpen: n.machineOpen,
        bounceType: n.bounceType,
        detail: n.detail,
        createdAt: new Date(),
      };

      try {
        await events.insertOne(doc);
      } catch (e) {
        // A duplicate-key race means another delivery already won — that's a
        // successful dedupe, not an error. Skip suppression for the loser.
        if ((e as { code?: number }).code === 11000) continue;
        throw e;
      }
      processed += 1;

      // Suppress on hard bounce / complaint / dropped. Transient (soft)
      // bounces map to `deferred` above and are intentionally NOT suppressed.
      if (
        n.email &&
        SUPPRESS_EVENTS.has(n.event) &&
        n.bounceType !== 'transient'
      ) {
        const res = await addSabmailSuppression({
          workspaceId,
          email: n.email,
          reason: suppressionReasonFor(n.event),
          source: 'webhook',
          provider: n.provider,
          messageId: n.messageId || undefined,
          dedupeId: n.dedupeId,
          detail: n.detail,
        });
        if (!res.ok) {
          console.error(
            '[sabmail-events] suppression write failed:',
            res.error,
          );
        }
      }
    }

    return NextResponse.json({ ok: true, processed });
  } catch (err) {
    console.error('[sabmail-events] ingestion error:', err);
    return NextResponse.json(
      { ok: false, error: getErrorMessage(err), processed },
      { status: 500 },
    );
  }
}

export const POST = handle;
