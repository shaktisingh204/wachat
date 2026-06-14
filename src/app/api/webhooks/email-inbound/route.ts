import { NextResponse, type NextRequest } from 'next/server';
import crypto from 'node:crypto';

import { ingestTicketEmail } from '@/lib/crm/ticket-email.server';
import { routeInboundSabcrmEmail } from '@/lib/sabcrm/email-inbound';
import { isDropboxAddress } from '@/lib/sabcrm/email-dropbox';
import { captureDropboxEmail } from '@/lib/sabcrm/email-dropbox.server';

const LOG_PREFIX = '[EMAIL INBOUND]';

/**
 * Inbound email webhook.
 *
 * Receives parsed inbound email envelopes from the SabNode Email module
 * (or any third-party inbound provider — SendGrid Inbound Parse,
 * Mailgun routes, Postal, etc.) and routes them through the CRM
 * ticket-email binding, optionally creating a `crm_tickets` document.
 *
 * Each envelope is ALSO routed onto SabCRM records additively
 * (`routeInboundSabcrmEmail` — matches the sender against record
 * EMAIL / EMAILS fields, logs an `EMAIL` activity per match and
 * auto-unenrolls replying records from their active sequences). SabCRM
 * routing is best-effort and never fails the webhook.
 *
 * Authentication: a shared secret HMAC stored as
 * `EMAIL_INBOUND_WEBHOOK_SECRET`. Senders include the secret as the
 * `X-Inbound-Secret` header or sign the raw body with HMAC-SHA256 in
 * `X-Inbound-Signature`. When the env var is unset, the route accepts
 * unsigned requests (development only).
 *
 * Body shape:
 *   {
 *     to: string,
 *     from: string,
 *     fromName?: string,
 *     subject: string,
 *     bodyText?: string,
 *     bodyHtml?: string,
 *     messageId?: string,
 *     receivedAt?: string  // ISO timestamp
 *   }
 */

function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function verify(req: NextRequest, raw: string): boolean {
  const secret = process.env.EMAIL_INBOUND_WEBHOOK_SECRET;
  if (!secret) return true; // dev-only fallback

  const headerSecret = req.headers.get('x-inbound-secret');
  if (headerSecret && timingSafeEqualStr(headerSecret, secret)) return true;

  const sig = req.headers.get('x-inbound-signature');
  if (sig) {
    const computed = crypto
      .createHmac('sha256', secret)
      .update(raw)
      .digest('hex');
    if (timingSafeEqualStr(sig, computed)) return true;
  }
  return false;
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verify(req, raw)) {
    console.warn(`${LOG_PREFIX} unauthorized request rejected`);
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: any;
  try {
    body = JSON.parse(raw);
  } catch (e) {
    console.warn(`${LOG_PREFIX} invalid json:`, (e as Error).message);
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  if (!body?.to || !body?.from || typeof body.subject !== 'string') {
    console.warn(`${LOG_PREFIX} missing required fields`, {
      hasTo: Boolean(body?.to),
      hasFrom: Boolean(body?.from),
      hasSubject: typeof body?.subject === 'string',
    });
    return NextResponse.json(
      { error: 'missing required fields: to, from, subject' },
      { status: 400 },
    );
  }

  const envelope = {
    to: String(body.to),
    from: String(body.from),
    fromName: body.fromName ? String(body.fromName) : undefined,
    subject: String(body.subject),
    bodyText: body.bodyText ? String(body.bodyText) : undefined,
    bodyHtml: body.bodyHtml ? String(body.bodyHtml) : undefined,
    messageId: body.messageId ? String(body.messageId) : undefined,
    receivedAt: body.receivedAt ? new Date(body.receivedAt) : undefined,
  };

  // SabCRM record routing — additive and best-effort (`routeInboundSabcrmEmail`
  // never throws; the .catch guards the contract). Started alongside the
  // ticket ingest so a ticket-side failure cannot suppress it.
  const sabcrmPromise = routeInboundSabcrmEmail(envelope).catch(() => ({
    routed: false,
    matchedRecords: 0,
    activitiesLogged: 0,
    sequencesUnenrolled: 0,
    reason: 'route-failed',
  }));

  // BCC-dropbox capture — when the recipient is a project dropbox address,
  // log the message onto the record matched by the SENDER (`from`). Additive,
  // best-effort, and a no-op for ordinary (non-dropbox) recipients.
  if (isDropboxAddress(envelope.to)) {
    captureDropboxEmail(
      envelope.to,
      envelope.from,
      envelope.subject,
      envelope.bodyText ?? envelope.bodyHtml ?? '',
      envelope.messageId,
    ).catch(() => undefined);
  }

  try {
    const result = await ingestTicketEmail(envelope);
    const sabcrm = await sabcrmPromise;
    console.log(
      `${LOG_PREFIX} ${result.created ? 'created' : 'skipped'} ticket — to=${body.to} from=${body.from} reason=${result.reason ?? 'ok'} ticketId=${result.ticketId ?? '—'} | sabcrm routed=${sabcrm.routed} matched=${sabcrm.matchedRecords} activities=${sabcrm.activitiesLogged} unenrolled=${sabcrm.sequencesUnenrolled}${sabcrm.reason ? ` reason=${sabcrm.reason}` : ''}`,
    );
    return NextResponse.json({ ...result, sabcrm });
  } catch (e) {
    const sabcrm = await sabcrmPromise;
    console.error(
      `${LOG_PREFIX} ingest failed (sabcrm routed=${sabcrm.routed}):`,
      e,
    );
    return NextResponse.json(
      { error: 'ingest failed', message: (e as Error).message, sabcrm },
      { status: 500 },
    );
  }
}

export async function GET() {
  console.log(`${LOG_PREFIX} GET docs request`);
  return NextResponse.json({
    ok: true,
    docs: 'POST a parsed email envelope (to, from, subject, bodyHtml). See /dashboard/crm/settings/integrations/ticket-email.',
  });
}
