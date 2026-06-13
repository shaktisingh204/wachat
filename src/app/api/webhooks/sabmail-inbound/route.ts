/**
 * POST /api/webhooks/sabmail-inbound?workspaceId=<kind:'mail' project _id>
 *
 * SabMail inbound webhook — two delivery paths converge here:
 *
 *  1. PROVIDER-PARSED (Postmark-style). An email provider POSTs the already-
 *     parsed inbound message as JSON whenever mail arrives at an address whose
 *     MX / inbound route points at SabMail.
 *
 *  2. HOSTED-MTA RAW (our own Stalwart MTA). When mail is delivered to a hosted
 *     mailbox (`provider:'hosted'`), a Sieve script POSTs the FULL RFC822
 *     message here as `message/rfc822` (or raw `text/plain`, or a JSON field
 *     `raw` / `rawEmail`). We parse it with `mailparser`'s `simpleParser`
 *     (dynamic import — same as `inbox/actions.ts`) and, when the recipient is a
 *     known hosted account, MIRROR a row into `SABMAIL_COLLECTIONS.messages`
 *     (the same envelope-cache the IMAP sync worker writes) so it shows up in
 *     the inbox immediately, then run the live binder.
 *
 * Both paths:
 *   • record an `inbound` event in `SABMAIL_COLLECTIONS.events`,
 *   • best-effort tie the inbound to a known contact, and
 *   • call `bindInboundMessage(...)` so conversation + screener + rules + the
 *     `inbound_email` journey trigger fire.
 *
 * ── Configuring delivery here ──────────────────────────────────────────────
 * This route has NO session/cookie — the target workspace is identified by the
 * REQUIRED `?workspaceId=` query param (the `kind:'mail'` SabMail project
 * `_id`). Point the provider's inbound webhook URL — or the hosted MTA's Sieve
 * poster — at, e.g.:
 *
 *   https://<your-sabnode-host>/api/webhooks/sabmail-inbound?workspaceId=<projectId>
 *
 *   • Postmark / SendGrid Inbound Parse / Mailgun Routes / Mailchimp Mandrill /
 *     Cloudflare Email Workers — set the webhook URL above; this handler tolerates
 *     the Postmark JSON shape AND the simpler `{from,to,subject,text,html}` shape.
 *   • Stalwart (hosted mailboxes) — a Sieve `eval` / external-program script POSTs
 *     the raw message body with `Content-Type: message/rfc822` and the shared
 *     secret header (see Auth below).
 *   • DNS — add an MX record for the receiving (sub)domain pointing at the
 *     inbound mail server.
 *
 * ── Auth ───────────────────────────────────────────────────────────────────
 * The shared secret is accepted as `Authorization: Bearer <secret>`,
 * `x-cron-secret: <secret>`, or `?secret=<secret>`, and is matched against
 * EITHER `CRON_SECRET` (cron/provider posters) OR
 * `SABMAIL_INBOUND_WEBHOOK_SECRET` (the Sieve poster). When neither env is set
 * the route is open (local/dev).
 *
 * Returns `{ ok: true }` on success so the poster marks delivery complete.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { connectToDatabase } from '@/lib/mongodb';
import { SABMAIL_COLLECTIONS } from '@/lib/sabmail/db/collections';
import { bindInboundMessage } from '@/lib/sabmail/inbound-binding';
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
  // raw RFC822 (.eml) carried inside JSON — hosted-MTA Sieve poster
  raw?: string;
  rawEmail?: string;
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

/** Loose shape of `mailparser`'s `simpleParser` result (only fields we read). */
interface ParsedMail {
  from?: { value?: Array<{ name?: string; address?: string }>; text?: string };
  to?: { value?: Array<{ name?: string; address?: string }>; text?: string };
  subject?: string;
  messageId?: string;
  html?: string | false;
  text?: string;
  textAsHtml?: string;
  date?: Date;
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
  const secrets = [process.env.CRON_SECRET, process.env.SABMAIL_INBOUND_WEBHOOK_SECRET]
    .map((s) => (s ?? '').trim())
    .filter(Boolean);
  if (secrets.length === 0) return true; // not configured → open (local/dev)

  // Mirror the cron routes' auth: Bearer header, x-cron-secret header, or ?secret.
  const auth = (req.headers.get('authorization') ?? '').trim();
  const bearer = auth.startsWith('Bearer ') ? auth.slice('Bearer '.length).trim() : '';
  const header = (req.headers.get('x-cron-secret') ?? '').trim();
  const query = (new URL(req.url).searchParams.get('secret') ?? '').trim();

  const presented = [bearer, header, query].filter(Boolean);
  return presented.some((p) => secrets.includes(p));
}

/** True when the request carries a raw RFC822 message rather than parsed JSON.
 * Only `message/rfc822` is treated as a raw body — a JSON poster that mislabels
 * its Content-Type as text/plain must NOT be mis-parsed as an .eml (that would
 * silently drop it). Sieve posters that can't set the content-type can carry the
 * raw message in a JSON `raw`/`rawEmail` field instead (handled below). */
function isRawRequest(req: NextRequest): boolean {
  const ct = (req.headers.get('content-type') ?? '').toLowerCase();
  return ct.includes('message/rfc822');
}

/** Dynamic-import `mailparser.simpleParser` (same pattern as inbox/actions.ts). */
async function parseRaw(rawEml: string | Buffer): Promise<ParsedMail | null> {
  try {
    const mp = (await import('mailparser')) as unknown as {
      simpleParser: (src: unknown) => Promise<ParsedMail>;
    };
    return await mp.simpleParser(rawEml);
  } catch (e) {
    console.error('[sabmail-inbound] simpleParser failed:', getErrorMessage(e));
    return null;
  }
}

/** First parsed address ({name, address}) from a `simpleParser` address node. */
function firstAddr(
  node: ParsedMail['from'] | ParsedMail['to'],
): { name: string; address: string } {
  const v = node?.value?.[0];
  if (v?.address) return { name: str(v.name).trim(), address: str(v.address).trim() };
  // Fall back to parsing the display text ("Name <addr>" / "addr").
  const text = str(node?.text).trim();
  return { name: '', address: extractEmail(text) };
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

  // ── Resolve the message fields from whichever delivery path posted ──────────
  // `from`/`to` are normalized; `rawEml` (if any) is kept for storage/binding.
  let from = '';
  let to = '';
  let subject = '(no subject)';
  let text = '';
  let html: string | null = null;
  let messageId = '';
  let fromName = '';
  let date: Date | null = null;
  let rawEml: string | null = null;
  let parsedFromRaw = false;

  try {
    if (isRawRequest(req)) {
      // ── PATH 2a: raw RFC822 posted as the request BODY ──────────────────────
      rawEml = await req.text();
      const parsed = rawEml ? await parseRaw(rawEml) : null;
      if (parsed) {
        const f = firstAddr(parsed.from);
        const t = firstAddr(parsed.to);
        from = f.address.toLowerCase();
        fromName = f.name;
        to = t.address;
        subject = str(parsed.subject).trim() || '(no subject)';
        messageId = str(parsed.messageId).trim();
        html = parsed.html ? str(parsed.html) : null;
        text = str(parsed.text || parsed.textAsHtml || '');
        date = parsed.date instanceof Date ? parsed.date : null;
        parsedFromRaw = true;
      }
    } else {
      // ── JSON body — provider-parsed OR raw carried in `raw`/`rawEmail` ───────
      let body: InboundBody;
      try {
        body = (await req.json()) as InboundBody;
      } catch {
        return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 });
      }

      const jsonRaw = str(body.raw ?? body.rawEmail).trim();
      if (jsonRaw) {
        // ── PATH 2b: raw RFC822 inside a JSON field ───────────────────────────
        rawEml = jsonRaw;
        const parsed = await parseRaw(jsonRaw);
        if (parsed) {
          const f = firstAddr(parsed.from);
          const t = firstAddr(parsed.to);
          from = f.address.toLowerCase();
          fromName = f.name;
          to = t.address;
          subject = str(parsed.subject).trim() || '(no subject)';
          messageId = str(parsed.messageId).trim();
          html = parsed.html ? str(parsed.html) : null;
          text = str(parsed.text || parsed.textAsHtml || '');
          date = parsed.date instanceof Date ? parsed.date : null;
          parsedFromRaw = true;
        }
      }

      if (!parsedFromRaw) {
        // ── PATH 1: provider-parsed JSON (Postmark shape or simple shape) ─────
        from = extractEmail(body.FromFull, body.From, body.from).toLowerCase();
        to = extractEmail(
          Array.isArray(body.ToFull) ? body.ToFull[0] : undefined,
          body.To,
          body.to,
        );
        subject = str(body.Subject ?? body.subject).trim() || '(no subject)';
        text = str(
          body.StrippedTextReply ?? body.TextBody ?? body.text ?? body.HtmlBody ?? body.html,
        );
        html = body.HtmlBody || body.html ? str(body.HtmlBody ?? body.html) : null;
        messageId = str(body.MessageID ?? '').trim();
        fromName = str(body.FromFull?.Name).trim();
      }
    }
  } catch (err) {
    // A parse/body-read failure must never 500 the poster (it would retry/bounce).
    console.error('[sabmail-inbound] payload read/parse error:', getErrorMessage(err));
    return NextResponse.json({ ok: true, parsed: false });
  }

  const toLower = to.toLowerCase();
  const nowTs = new Date();

  try {
    const { db } = await connectToDatabase();

    const doc: SabmailInboundEventDoc = {
      workspaceId,
      event: 'inbound',
      from,
      to,
      subject,
      text,
      messageId,
      ts: nowTs,
    };

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

    // ── Resolve the hosted account (if the recipient is one) ────────────────
    // We DON'T mirror the message into `sabmail_messages`: hosted accounts
    // (`provider:'hosted'`) read on-demand through the IMAP adapter against
    // Stalwart's own IMAP store (src/lib/sabmail/providers/imap.ts via the inbox
    // dispatch), so a mirror would be write-only dead data AND collide with the
    // unique {workspaceId,accountId,provider,providerMessageId} index. We only
    // need the accountId so the binder can apply screener/rule mailbox actions.
    let accountId = '';
    if (toLower && EMAIL_RE.test(toLower)) {
      try {
        const account = (await db.collection(SABMAIL_COLLECTIONS.accounts).findOne(
          { workspaceId, email: toLower, provider: 'hosted' },
          { projection: { _id: 1 } },
        )) as { _id?: unknown } | null;
        if (account?._id) accountId = String(account._id);
      } catch {
        /* account lookup is best-effort — binding still runs without accountId */
      }
    }

    // Live binding: conversation + screener + rules (engine-first, in-process
    // fallback) and the `inbound_email` journey trigger. Best-effort — a
    // binding error must not fail the webhook (the poster would retry/bounce).
    // `accountId` is passed so screener/rule mailbox-apply can resolve the
    // hosted account when applicable.
    try {
      await bindInboundMessage({
        workspaceId,
        from,
        fromName,
        subject,
        messageId,
        accountId: accountId || undefined,
        folder: 'INBOX',
      });
    } catch (e) {
      console.error('[sabmail-inbound] binding failed:', getErrorMessage(e));
    }

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
