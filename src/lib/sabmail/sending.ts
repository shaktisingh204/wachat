import 'server-only';

import { connectToDatabase } from '@/lib/mongodb';
import { SABMAIL_COLLECTIONS } from '@/lib/sabmail/db/collections';
import { getErrorMessage } from '@/lib/utils';

/* ──────────────────────────────────────────────────────────────────────
 * SabMail — own-domain / bulk send path.
 *
 * This is the path SabMail uses to send mail FROM a workspace's own verified
 * sending domain (campaigns, journeys, transactional bulk) — authenticated
 * with the domain's real, self-hosted DKIM keypair (generated in
 * `src/app/sabmail/domains/actions.ts`).
 *
 * It is DISTINCT from the per-account user inbox send, which goes through
 * `src/app/sabmail/inbox/actions.ts` → `sendSabmailMessage` (logs into the
 * user's own SMTP mailbox). Use THAT for "reply from my inbox"; use THIS for
 * sending on the workspace's behalf over the shared MTA.
 *
 * Transport selection (first that's configured wins):
 *   1. Amazon SES   — when `SABMAIL_SES=1` AND `@aws-sdk/client-ses` is
 *                     installed (optional dep). Sends via `SendRawEmail`.
 *   2. SMTP relay   — when `SABMAIL_SMTP_HOST` (+ optional PORT/USER/PASS) is
 *                     set. Uses nodemailer (always installed).
 * DKIM signing is done by nodemailer's built-in `dkim` option (dep-free) using
 * the matching domain's stored private key. We DO NOT require `mailauth` —
 * nodemailer signs the raw message itself, which also makes the SES raw blob
 * carry a valid DKIM-Signature header.
 *
 * Optional deps (`@aws-sdk/client-ses`) are imported as NON-LITERAL
 * specifiers so this file compiles with the package absent.
 * ──────────────────────────────────────────────────────────────────── */

export interface SendSabmailOwnDomainInput {
  /** Envelope/header From — e.g. `"Acme" <hello@mail.acme.com>` or `hello@mail.acme.com`. */
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html?: string;
  text?: string;
  /** Workspace that owns the sending domain (used to look up the DKIM key). */
  workspaceId: string;
  /**
   * Sending domain to DKIM-sign with. When omitted it's derived from the
   * `from` address; the matching `sabmail_domains` doc supplies the key.
   */
  domain?: string;
}

export type SendSabmailOwnDomainResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string };

/** The DKIM material we need from a `sabmail_domains` doc to sign. */
interface DkimKeyDoc {
  domain: string;
  dkimSelector: string;
  dkimPrivateKeyPem?: string;
}

/** Extract the bare email + its domain from a `Name <addr>` or `addr` string. */
function parseAddress(value: string): { email: string; domain: string } {
  const raw = (value || '').trim();
  const email = (raw.match(/<([^>]+)>/)?.[1] ?? raw).trim().toLowerCase();
  const domain = email.includes('@') ? email.split('@').pop()!.trim() : '';
  return { email, domain };
}

const cleanList = (list?: string[]): string[] =>
  (list ?? []).map((s) => s.trim()).filter(Boolean);

/**
 * Look up the DKIM key for the best-matching sending domain. Prefers an exact
 * `domain` match; otherwise matches the longest registered domain that the
 * From-address domain is equal to or a subdomain of (so `mail.acme.com` mail
 * can be signed by an `acme.com` key when only the apex is registered).
 */
async function loadDkimKey(
  workspaceId: string,
  fromDomain: string,
  explicitDomain?: string,
): Promise<DkimKeyDoc | null> {
  if (!workspaceId) return null;
  const { db } = await connectToDatabase();
  const col = db.collection(SABMAIL_COLLECTIONS.domains);

  const wanted = (explicitDomain || fromDomain || '').trim().toLowerCase();
  if (!wanted) return null;

  // Exact match first.
  const exact = (await col.findOne(
    { workspaceId, domain: wanted },
    { projection: { domain: 1, dkimSelector: 1, dkimPrivateKeyPem: 1 } },
  )) as DkimKeyDoc | null;
  if (exact?.dkimPrivateKeyPem) return exact;

  // Otherwise: any registered domain that `wanted` is a subdomain of.
  const candidates = (await col
    .find(
      { workspaceId },
      { projection: { domain: 1, dkimSelector: 1, dkimPrivateKeyPem: 1 } },
    )
    .toArray()) as unknown as DkimKeyDoc[];

  const matches = candidates
    .filter(
      (c) =>
        c.dkimPrivateKeyPem &&
        (wanted === c.domain || wanted.endsWith(`.${c.domain}`)),
    )
    .sort((a, b) => b.domain.length - a.domain.length);

  return matches[0] ?? null;
}

/** Build the shared nodemailer mail-options object (with DKIM when available). */
function buildMailOptions(
  input: SendSabmailOwnDomainInput,
  to: string[],
  dkim: DkimKeyDoc | null,
): Record<string, unknown> {
  const subject = input.subject?.trim() || '(no subject)';
  const text = input.text?.trim() || '';
  const html = input.html?.trim() || '';
  return {
    from: input.from,
    to,
    cc: cleanList(input.cc),
    bcc: cleanList(input.bcc),
    subject,
    ...(text ? { text } : html ? {} : { text: ' ' }),
    ...(html ? { html } : {}),
    // nodemailer's built-in DKIM signing (dep-free). When present, the raw
    // message carries a valid DKIM-Signature header — true for SMTP AND for
    // the raw blob we hand to SES SendRawEmail.
    ...(dkim?.dkimPrivateKeyPem
      ? {
          dkim: {
            domainName: dkim.domain,
            keySelector: dkim.dkimSelector || 'sabmail',
            privateKey: dkim.dkimPrivateKeyPem,
          },
        }
      : {}),
  };
}

/* ── SES (optional dep) ───────────────────────────────────────────────── */

/**
 * Send via Amazon SES `SendRawEmail`. We build the raw, DKIM-signed MIME with
 * nodemailer's stream transport, then hand it to the SES client. Returns null
 * when the optional `@aws-sdk/client-ses` package is not installed (caller
 * then falls back to SMTP / degrades).
 */
async function trySendViaSes(
  mailOptions: Record<string, unknown>,
): Promise<SendSabmailOwnDomainResult | null> {
  const sesMod = (await import(/* webpackIgnore: true */ ('@aws-sdk/client-ses' as string)).catch(
    () => null,
  )) as any;
  if (!sesMod?.SESClient || !sesMod?.SendRawEmailCommand) return null;

  // Build the raw, DKIM-signed message via nodemailer (always installed).
  const nm = (await import('nodemailer')) as any;
  const nodemailer = nm.default ?? nm;
  const builder = nodemailer.createTransport({
    streamTransport: true,
    buffer: true,
    newline: 'unix',
  });
  const built = await builder.sendMail(mailOptions);
  const raw: Buffer | undefined = built?.message;
  if (!raw) return { ok: false, error: 'Could not build the SES raw message.' };

  const region = process.env.AWS_REGION || process.env.SABMAIL_SES_REGION || 'us-east-1';
  const client = new sesMod.SESClient({ region });
  const command = new sesMod.SendRawEmailCommand({
    RawMessage: { Data: raw },
  });
  const res = await client.send(command);
  const messageId: string = res?.MessageId ?? built?.messageId ?? '';
  return { ok: true, messageId };
}

/* ── SMTP relay (nodemailer, always available) ────────────────────────── */

function smtpEnvConfigured(): boolean {
  return !!process.env.SABMAIL_SMTP_HOST;
}

async function trySendViaSmtp(
  mailOptions: Record<string, unknown>,
): Promise<SendSabmailOwnDomainResult> {
  const host = process.env.SABMAIL_SMTP_HOST;
  if (!host) {
    return { ok: false, error: 'SMTP relay is not configured (SABMAIL_SMTP_HOST).' };
  }
  const port = Number(process.env.SABMAIL_SMTP_PORT || 587);
  const user = process.env.SABMAIL_SMTP_USER || '';
  const pass = process.env.SABMAIL_SMTP_PASS || '';

  const nm = (await import('nodemailer')) as any;
  const nodemailer = nm.default ?? nm;
  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    ...(user || pass ? { auth: { user, pass } } : {}),
    connectionTimeout: 20_000,
  });
  const info = await transport.sendMail(mailOptions);
  return { ok: true, messageId: info?.messageId ?? '' };
}

/* ── public entry ─────────────────────────────────────────────────────── */

/**
 * Send a message FROM the workspace's own sending domain over the shared MTA,
 * DKIM-signed with that domain's stored private key.
 *
 * For "reply from the user's connected inbox", use
 * `sendSabmailMessage` in `src/app/sabmail/inbox/actions.ts` instead.
 */
export async function sendSabmailOwnDomain(
  input: SendSabmailOwnDomainInput,
): Promise<SendSabmailOwnDomainResult> {
  try {
    if (!input.workspaceId) return { ok: false, error: 'No workspace.' };
    if (!input.from?.trim()) return { ok: false, error: 'A From address is required.' };

    const to = cleanList(input.to);
    if (to.length === 0) return { ok: false, error: 'Add at least one recipient.' };

    if (!input.html?.trim() && !input.text?.trim()) {
      return { ok: false, error: 'Add an HTML or text body.' };
    }

    const { domain: fromDomain } = parseAddress(input.from);
    const dkim = await loadDkimKey(input.workspaceId, fromDomain, input.domain);
    const mailOptions = buildMailOptions(input, to, dkim);

    // 1) SES (opt-in + optional dep present).
    if (process.env.SABMAIL_SES === '1') {
      const sesResult = await trySendViaSes(mailOptions);
      if (sesResult) return sesResult;
      // SES requested but package missing — try SMTP, else degrade clearly.
      if (!smtpEnvConfigured()) {
        return {
          ok: false,
          error:
            'SABMAIL_SES=1 but the @aws-sdk/client-ses package is not installed. Run: npm i @aws-sdk/client-ses (or set SABMAIL_SMTP_HOST to relay over SMTP).',
        };
      }
    }

    // 2) SMTP relay.
    if (smtpEnvConfigured()) {
      return await trySendViaSmtp(mailOptions);
    }

    // 3) Nothing configured — degrade clearly.
    return {
      ok: false,
      error:
        'No own-domain send transport is configured. Set SABMAIL_SMTP_HOST (+ optional PORT/USER/PASS) for an SMTP relay, or SABMAIL_SES=1 with @aws-sdk/client-ses installed.',
    };
  } catch (err) {
    return { ok: false, error: `Send failed: ${getErrorMessage(err)}` };
  }
}
