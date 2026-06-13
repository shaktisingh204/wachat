/**
 * POST /api/webhooks/sabmail-inbound?workspaceId=<kind:'mail' project _id>
 *
 * SabMail inbound-parse webhook (Postmark-style). An email provider POSTs the
 * parsed inbound message here whenever mail arrives at an address whose MX /
 * inbound route points at SabMail. The parsed message is stored as an
 * `inbound` event in `SABMAIL_COLLECTIONS.events`, and (best-effort) tied to a
 * known contact when the sender matches one in the workspace address book.
 *
 * ── Configuring your provider / MX to deliver here ─────────────────────────
 * This route has NO session/cookie — the target workspace is identified by the
 * REQUIRED `?workspaceId=` query param (the `kind:'mail'` SabMail project
 * `_id`). Point the provider's inbound webhook URL at, e.g.:
 *
 *   https://<your-sabnode-host>/api/webhooks/sabmail-inbound?workspaceId=<projectId>
 *
 *   • Postmark — Servers → <server> → Settings → Inbound, set the "Inbound
 *     webhook URL" to the URL above. Postmark then POSTs its parsed JSON
 *     (FromFull / ToFull / Subject / TextBody / HtmlBody / StrippedTextReply /
 *     MessageID / Headers / Attachments). Either use Postmark's inbound MX
 *     (`<hash>@inbound.postmarkapp.com`) or add an MX record on your domain
 *     pointing at the provider's inbound MTA.
 *   • SendGrid Inbound Parse / Mailgun Routes / Mailchimp Mandrill / Cloudflare
 *     Email Workers, etc. — set the same webhook URL. This handler also tolerates
 *     a simpler `{from, to, subject, text, html}` shape, so most providers (or a
 *     thin adapter) can post directly.
 *   • DNS — add an MX record for the receiving (sub)domain pointing at your
 *     provider's inbound mail server, e.g.:
 *        mail.example.com.  IN  MX  10  inbound.postmarkapp.com.
 *     Mail to that domain is parsed by the provider and POSTed to this route.
 *
 * Returns `{ ok: true }` on success so the provider marks delivery complete.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { connectToDatabase } from '@/lib/mongodb';
import { SABMAIL_COLLECTIONS } from '@/lib/sabmail/db/collections';
import { getErrorMessage } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/* ── provider payload shapes (tolerant) ──────────────────────────────────── */

/** Postmark's `{Name, Email, MailboxHash}` address object. */
interface PostmarkAddress {
  Name?: string;
  Email?: string;
  MailboxHash?: string;
}

/** Postmark-style inbound body — plus the simpler `{from,to,subject,text,html}`. */
interface InboundBody {
  // Postmark shape
  FromFull?: PostmarkAddress;
  From?: string;
  ToFull?: PostmarkAddress[];
  To?: string;
  Subject?: string;
  TextBody?: string;
  HtmlBody?: string;
  StrippedTextReply?: string;
  MessageID?: string;
  Headers?: Array<{ Name?: string; Value?: string }>;
  Attachments?: Array<{ Name?: string; ContentType?: string; ContentLength?: number }>;
  // simpler shape
  from?: string;
  to?: string;
  subject?: string;
  text?: string;
  html?: string;
}

/** The stored shape of a parsed inbound message (one Mongo doc). */
interface SabmailInboundEventDoc {
  workspaceId: string;
  event: 'inbound';
  from: string;
  to: string;
  subject: string;
  text: string;
  messageId: string;
  ts: Date;
  contactId?: string;
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function str(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

/** Pull a clean address out of a Postmark address obj, a raw header, or a string. */
function extractEmail(...candidates: unknown[]): string {
  for (const c of candidates) {
    if (!c) continue;
    if (typeof c === 'object') {
      const addr = (c as PostmarkAddress).Email;
      if (addr) return addr.trim();
      continue;
    }
    const raw = str(c).trim();
    if (!raw) continue;
    // Handle "Name <email@host>" header form.
    const angled = raw.match(/<([^>]+)>/);
    return (angled ? angled[1] : raw).trim();
  }
  return '';
}

function authorize(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true; // not configured → open (local/dev)
  // Mirror the cron routes' auth: Bearer header, x-cron-secret header, or ?secret.
  const auth = req.headers.get('authorization') ?? '';
  if (auth === `Bearer ${expected}`) return true;
  const header = req.headers.get('x-cron-secret') ?? '';
  if (header === expected) return true;
  const query = new URL(req.url).searchParams.get('secret') ?? '';
  return query === expected;
}

/* ── handler ─────────────────────────────────────────────────────────────── */

async function handle(req: NextRequest): Promise<NextResponse> {
  if (!authorize(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const workspaceId = (new URL(req.url).searchParams.get('workspaceId') ?? '').trim();
  if (!workspaceId) {
    return NextResponse.json(
      { ok: false, error: 'Missing required ?workspaceId= query param.' },
      { status: 400 },
    );
  }

  let body: InboundBody;
  try {
    body = (await req.json()) as InboundBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 });
  }

  try {
    // Resolve fields from either the Postmark shape or the simpler one.
    const from = extractEmail(body.FromFull, body.From, body.from).toLowerCase();
    const to = extractEmail(
      Array.isArray(body.ToFull) ? body.ToFull[0] : undefined,
      body.To,
      body.to,
    );
    const subject = str(body.Subject ?? body.subject).trim() || '(no subject)';
    const text = str(
      body.StrippedTextReply ?? body.TextBody ?? body.text ?? body.HtmlBody ?? body.html,
    );
    const messageId = str(body.MessageID ?? '').trim();

    const doc: SabmailInboundEventDoc = {
      workspaceId,
      event: 'inbound',
      from,
      to,
      subject,
      text,
      messageId,
      ts: new Date(),
    };

    const { db } = await connectToDatabase();

    // Best-effort: tie the inbound to a known contact (matched by lowercased
    // sender within this workspace). Never fails the webhook.
    if (from && EMAIL_RE.test(from)) {
      try {
        const contact = (await db
          .collection(SABMAIL_COLLECTIONS.contacts)
          .findOne(
            { workspaceId, email: from },
            { projection: { _id: 1 } },
          )) as { _id?: unknown } | null;
        if (contact?._id) doc.contactId = String(contact._id);
      } catch {
        /* contact lookup is best-effort — ignore */
      }
    }

    await db.collection(SABMAIL_COLLECTIONS.events).insertOne(doc as never);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[sabmail-inbound] webhook error:', err);
    return NextResponse.json(
      { ok: false, error: getErrorMessage(err) },
      { status: 500 },
    );
  }
}

export const POST = handle;
