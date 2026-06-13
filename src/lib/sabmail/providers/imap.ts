import 'server-only';

import { isSabmailSuppressed } from '@/lib/sabmail/suppressions';
import {
  makeUnsubscribeToken,
  buildUnsubscribeHeaders,
} from '@/lib/sabmail/unsubscribe';
import { getErrorMessage } from '@/lib/utils';

import type {
  SabmailFolderRow,
  SabmailMessageRow,
  SabmailMessageFull,
  SabmailSendInput,
} from '@/app/sabmail/inbox/actions';

import type {
  MailProvider,
  MailProviderContext,
} from './types';

/* ──────────────────────────────────────────────────────────────────────
 * SabMail IMAP adapter — the REFERENCE provider implementation (Phase B).
 *
 * This is the transport-agnostic `MailProvider` contract realised over real
 * `imapflow` + `nodemailer` + `mailparser` operations. It is the exact, proven
 * IMAP behaviour that `src/app/sabmail/inbox/actions.ts` ships inline today —
 * replicated here (NOT imported) so this module carries no `'use server'`
 * coupling and stays a plain `server-only` library the action layer can
 * dispatch through.
 *
 * Contract bridge (see `./types.ts`):
 *   - `ctx.account.imap` / `ctx.account.smtp` carry the non-secret endpoints.
 *   - `ctx.creds` is the ALREADY-DECRYPTED credential blob
 *     (`{ imapUser, imapPass, smtpUser?, smtpPass? }`); we never re-decrypt and
 *     never log a secret. SMTP creds fall back to the IMAP login (same mailbox).
 *   - `id` (message id) is the IMAP UID rendered as a STRING; every method
 *     parses it with `parseUid()` and passes `{ uid: true }` to imapflow.
 *   - Operations return the SAME `Sabmail*` row/full/send shapes the inbox UI
 *     already consumes, so dispatch is drop-in.
 *
 * Defensive throughout: methods may throw; the action layer wraps with its own
 * `{ ok, error }` envelope. Best-effort steps (mark-seen, Sent append) swallow.
 * ──────────────────────────────────────────────────────────────────── */

/** Loose imapflow client handle — imapflow ships no strict bundled d.ts. */
type ImapClient = any;

/** The IMAP/SMTP credentials this adapter reads from `ctx.creds`. */
interface ImapCreds {
  imapUser: string;
  imapPass: string;
}

/* ── credential + identity helpers ───────────────────────────────────── */

/** Read + validate the IMAP login from the decrypted creds blob. Throws if incomplete. */
function readImapCreds(ctx: MailProviderContext): ImapCreds {
  const creds = ctx.creds ?? {};
  const imapUser = String((creds as Record<string, unknown>).imapUser ?? '');
  const imapPass = String((creds as Record<string, unknown>).imapPass ?? '');
  if (!imapUser || !imapPass) {
    throw new Error(
      'Mailbox credentials are incomplete — reconnect the account.',
    );
  }
  return { imapUser, imapPass };
}

/** Parse a string message id into a numeric IMAP UID. Throws on a bad id. */
function parseUid(id: string): number {
  const uid = Number(id);
  if (!Number.isFinite(uid) || uid <= 0) {
    throw new Error(`Invalid message id "${id}".`);
  }
  return uid;
}

/* ── connection lifecycle ────────────────────────────────────────────── */

/**
 * Connect to the account's IMAP endpoint, run `fn`, then always log out
 * (falling back to a hard close). Mirrors the inbox action's `withImap`.
 */
async function withImap<T>(
  ctx: MailProviderContext,
  fn: (client: ImapClient) => Promise<T>,
): Promise<T> {
  const imap = ctx.account?.imap;
  if (!imap?.host) {
    throw new Error('This mailbox is not an IMAP account.');
  }
  const { imapUser, imapPass } = readImapCreds(ctx);

  const mod = (await import('imapflow')) as unknown as {
    ImapFlow: new (opts: unknown) => ImapClient;
  };
  const client = new mod.ImapFlow({
    host: imap.host,
    port: imap.port,
    secure: imap.secure,
    auth: { user: imapUser, pass: imapPass },
    logger: false,
    socketTimeout: 20_000,
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    try {
      await client.logout();
    } catch {
      try {
        client.close();
      } catch {
        /* already closed */
      }
    }
  }
}

/* ── envelope / body parsing helpers ─────────────────────────────────── */

function hasAttachments(bodyStructure: any): boolean {
  if (!bodyStructure) return false;
  const disp = bodyStructure.disposition;
  if (typeof disp === 'string' && disp.toLowerCase() === 'attachment') return true;
  const children = bodyStructure.childNodes;
  if (Array.isArray(children)) return children.some((c) => hasAttachments(c));
  return false;
}

function addrList(field: any): string[] {
  const value = field?.value;
  if (!Array.isArray(value)) return [];
  return value
    .map((a: any) => (a?.name ? `${a.name} <${a.address ?? ''}>` : a?.address ?? ''))
    .filter(Boolean);
}

function firstAddr(field: any): { name: string; email: string } {
  const value = field?.value;
  const first = Array.isArray(value) ? value[0] : undefined;
  return { name: first?.name ?? '', email: (first?.address ?? '').toLowerCase() };
}

/** Sanitize untrusted INCOMING email HTML; block remote images unless asked. */
async function sanitizeEmailHtml(
  html: string,
  showRemoteImages: boolean,
): Promise<string> {
  const mod = (await import('sanitize-html')) as any;
  const sanitizeHtml = mod.default ?? mod;
  return sanitizeHtml(html, {
    allowedTags: [
      ...sanitizeHtml.defaults.allowedTags,
      'img', 'style', 'span', 'center', 'font',
      'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'col', 'colgroup',
      'h1', 'h2', 'u', 's', 'sub', 'sup',
    ],
    allowedAttributes: {
      '*': ['style', 'class', 'align', 'valign', 'width', 'height', 'bgcolor', 'color', 'dir'],
      a: ['href', 'name', 'target', 'rel'],
      img: ['src', 'alt', 'width', 'height', 'style', 'data-sabmail-blocked'],
      table: ['border', 'cellpadding', 'cellspacing', 'role'],
      font: ['face', 'size', 'color'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'cid', 'data', 'tel'],
    allowProtocolRelative: false,
    transformTags: {
      a: (_t: string, attribs: Record<string, string>) => ({
        tagName: 'a',
        attribs: { ...attribs, target: '_blank', rel: 'noopener noreferrer nofollow' },
      }),
      ...(showRemoteImages
        ? {}
        : {
            img: (_t: string, attribs: Record<string, string>) => {
              const src = attribs.src ?? '';
              if (/^https?:/i.test(src)) {
                const { src: _drop, ...rest } = attribs;
                return {
                  tagName: 'img',
                  attribs: { ...rest, 'data-sabmail-blocked': src, alt: attribs.alt ?? '' },
                };
              }
              return { tagName: 'img', attribs };
            },
          }),
    },
  }) as string;
}

/** Sanitize OUTGOING html: strip scripts/handlers but keep the user's images + formatting. */
async function sanitizeOutgoingHtml(html: string): Promise<string> {
  const mod = (await import('sanitize-html')) as any;
  const sanitizeHtml = mod.default ?? mod;
  return sanitizeHtml(html, {
    allowedTags: [
      'p', 'br', 'div', 'span', 'b', 'strong', 'i', 'em', 'u', 's', 'sub', 'sup',
      'a', 'img', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
      'h1', 'h2', 'h3', 'h4', 'hr', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'font',
    ],
    allowedAttributes: {
      '*': ['style', 'align', 'dir'],
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt', 'width', 'height', 'style'],
      font: ['face', 'size', 'color'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'cid', 'data', 'tel'],
  }) as string;
}

function htmlToPlain(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>(?=)/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Find a special-use mailbox path (Sent/Archive/Trash/Junk) with name fallbacks. */
async function resolveSpecialFolder(
  client: ImapClient,
  specialUse: string,
  nameFallbacks: string[],
): Promise<string | null> {
  try {
    const list = (await client.list()) as any[];
    const bySpecial = list.find(
      (f) =>
        typeof f.specialUse === 'string' &&
        f.specialUse.toLowerCase() === specialUse.toLowerCase(),
    );
    if (bySpecial) return bySpecial.path as string;
    const wanted = nameFallbacks.map((n) => n.toLowerCase());
    const byName = list.find((f) =>
      wanted.includes(String(f.name ?? f.path).toLowerCase()),
    );
    return byName ? (byName.path as string) : null;
  } catch {
    return null;
  }
}

/* ── operations ──────────────────────────────────────────────────────── */

async function listFolders(
  ctx: MailProviderContext,
): Promise<SabmailFolderRow[]> {
  return withImap(ctx, async (client) => {
    const list = (await client.list()) as any[];
    return list.map((f) => ({
      path: f.path as string,
      name: (f.name ?? f.path) as string,
      specialUse: (f.specialUse ?? null) as string | null,
      subscribed: !!f.subscribed,
    }));
  });
}

async function listMessages(
  ctx: MailProviderContext,
  folder: string,
  page: number,
  pageSize: number,
): Promise<{ messages: SabmailMessageRow[]; total: number }> {
  const path = folder || 'INBOX';
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 0;
  const safeSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : 30;

  return withImap(ctx, async (client) => {
    const lock = await client.getMailboxLock(path);
    try {
      const total: number = client.mailbox?.exists ?? 0;
      if (total === 0) return { messages: [] as SabmailMessageRow[], total: 0 };
      const end = total - safePage * safeSize;
      if (end < 1) return { messages: [] as SabmailMessageRow[], total };
      const start = Math.max(1, end - safeSize + 1);

      const rows: SabmailMessageRow[] = [];
      for await (const msg of client.fetch(`${start}:${end}`, {
        uid: true,
        envelope: true,
        flags: true,
        bodyStructure: true,
      })) {
        const env = msg.envelope ?? {};
        const from = Array.isArray(env.from) && env.from[0] ? env.from[0] : {};
        rows.push({
          uid: msg.uid,
          subject: env.subject || '(no subject)',
          fromName: from.name ?? '',
          fromEmail: (from.address ?? '').toLowerCase(),
          date: env.date ? new Date(env.date).toISOString() : null,
          seen: !!msg.flags?.has?.('\\Seen'),
          flagged: !!msg.flags?.has?.('\\Flagged'),
          hasAttachments: hasAttachments(msg.bodyStructure),
          messageId: env.messageId ?? null,
          inReplyTo: env.inReplyTo ?? null,
          screenerDecision: null,
        });
      }
      rows.reverse(); // newest first
      return { messages: rows, total };
    } finally {
      lock.release();
    }
  });
}

async function getMessage(
  ctx: MailProviderContext,
  folder: string,
  id: string,
  opts?: { showRemoteImages?: boolean; markSeen?: boolean },
): Promise<SabmailMessageFull> {
  const path = folder || 'INBOX';
  const uid = parseUid(id);
  const showRemoteImages = !!opts?.showRemoteImages;
  const markSeen = opts?.markSeen !== false;

  return withImap(ctx, async (client) => {
    const lock = await client.getMailboxLock(path);
    try {
      const msg = await client.fetchOne(
        String(uid),
        { uid: true, source: true, envelope: true, flags: true },
        { uid: true },
      );
      if (!msg || !msg.source) throw new Error('Message not found.');

      const mp = (await import('mailparser')) as unknown as {
        simpleParser: (src: unknown) => Promise<any>;
      };
      const parsed = await mp.simpleParser(msg.source);

      if (markSeen && !msg.flags?.has?.('\\Seen')) {
        try {
          await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true });
        } catch {
          /* read-only mailbox or perms — non-fatal */
        }
      }

      const html = parsed.html
        ? await sanitizeEmailHtml(parsed.html, showRemoteImages)
        : null;

      const full: SabmailMessageFull = {
        uid,
        subject: parsed.subject || '(no subject)',
        from: firstAddr(parsed.from),
        to: addrList(parsed.to),
        cc: addrList(parsed.cc),
        date: parsed.date ? new Date(parsed.date).toISOString() : null,
        html,
        text: parsed.text ?? null,
        attachments: (parsed.attachments ?? []).map((att: any) => ({
          filename: att.filename ?? 'attachment',
          contentType: att.contentType ?? 'application/octet-stream',
          size: att.size ?? att.content?.length ?? 0,
        })),
        hadRemoteImages: html ? html.includes('data-sabmail-blocked') : false,
        messageId: parsed.messageId ?? null,
        references: Array.isArray(parsed.references)
          ? parsed.references
          : parsed.references
            ? [parsed.references]
            : [],
      };
      return full;
    } finally {
      lock.release();
    }
  });
}

async function setFlag(
  ctx: MailProviderContext,
  folder: string,
  id: string,
  flag: 'seen' | 'flagged',
  value: boolean,
): Promise<void> {
  const path = folder || 'INBOX';
  const uid = parseUid(id);
  const imapFlag = flag === 'seen' ? '\\Seen' : '\\Flagged';

  await withImap(ctx, async (client) => {
    const lock = await client.getMailboxLock(path);
    try {
      if (value) {
        await client.messageFlagsAdd(String(uid), [imapFlag], { uid: true });
      } else {
        await client.messageFlagsRemove(String(uid), [imapFlag], { uid: true });
      }
    } finally {
      lock.release();
    }
  });
}

/** Shared move-to-special-folder for archive / trash. */
async function moveToSpecial(
  ctx: MailProviderContext,
  folder: string,
  id: string,
  specialUse: string,
  nameFallbacks: string[],
): Promise<void> {
  const path = folder || 'INBOX';
  const uid = parseUid(id);

  await withImap(ctx, async (client) => {
    const dest = await resolveSpecialFolder(client, specialUse, nameFallbacks);
    if (!dest) throw new Error(`No ${nameFallbacks[0]} folder found on this mailbox.`);
    const lock = await client.getMailboxLock(path);
    try {
      await client.messageMove(String(uid), dest, { uid: true });
    } finally {
      lock.release();
    }
  });
}

async function archive(
  ctx: MailProviderContext,
  folder: string,
  id: string,
): Promise<void> {
  await moveToSpecial(ctx, folder, id, '\\Archive', [
    'Archive',
    'All Mail',
    '[Gmail]/All Mail',
  ]);
}

async function trash(
  ctx: MailProviderContext,
  folder: string,
  id: string,
): Promise<void> {
  await moveToSpecial(ctx, folder, id, '\\Trash', [
    'Trash',
    'Deleted',
    'Deleted Items',
    '[Gmail]/Trash',
  ]);
}

async function send(
  ctx: MailProviderContext,
  input: SabmailSendInput,
): Promise<{ messageId: string }> {
  const account = ctx.account;
  if (!account?.smtp?.host) {
    throw new Error(
      'This mailbox has no SMTP configured — reconnect it with SMTP details to send.',
    );
  }

  const to = (input.to ?? []).map((s) => s.trim()).filter(Boolean);
  if (to.length === 0) throw new Error('Add at least one recipient.');

  // Drop suppressed recipients (hard bounce / complaint / unsubscribe) before sending.
  const allowedTo: string[] = [];
  for (const addr of to) {
    const email = (addr.match(/<([^>]+)>/)?.[1] ?? addr).trim().toLowerCase();
    if (!(await isSabmailSuppressed(ctx.workspaceId, email))) allowedTo.push(addr);
  }
  if (allowedTo.length === 0) {
    throw new Error('All recipients are on the suppression list.');
  }

  const subject = input.subject?.trim() || '(no subject)';

  // SMTP creds fall back to the IMAP login (same mailbox). Read from the
  // already-decrypted blob — never re-decrypt, never log.
  const creds = (ctx.creds ?? {}) as Record<string, unknown>;
  const smtpUser = String(creds.smtpUser ?? creds.imapUser ?? '');
  const smtpPass = String(creds.smtpPass ?? creds.imapPass ?? '');
  if (!smtpUser || !smtpPass) {
    throw new Error('Mailbox credentials are incomplete — reconnect the account.');
  }

  const html = input.html ? await sanitizeOutgoingHtml(input.html) : undefined;
  const text = input.text?.trim() || (html ? htmlToPlain(html) : '');
  const from = account.displayName
    ? `"${account.displayName.replace(/"/g, '')}" <${account.email}>`
    : account.email;

  // Bulk-mail headers (campaign sends only): one-click List-Unsubscribe (RFC
  // 8058) + a Feedback-ID for Postmaster Tools correlation. Absent on 1:1
  // replies so transactional mail stays clean.
  const extraHeaders: Record<string, string> = {};
  if (input.unsubscribe?.email) {
    const appBaseUrl = (
      process.env.SABMAIL_APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      ''
    ).trim();
    // Skip the List-Unsubscribe header gracefully when no public URL is
    // configured (a relative/empty link would be useless to mailbox providers).
    if (appBaseUrl) {
      const token = makeUnsubscribeToken(
        ctx.workspaceId,
        input.unsubscribe.email,
        input.unsubscribe.campaignId,
      );
      Object.assign(
        extraHeaders,
        buildUnsubscribeHeaders(appBaseUrl, token, account.email),
      );
    } else {
      // Observable failure: bulk mail without List-Unsubscribe fails Gmail/Yahoo
      // one-click compliance. Make the misconfiguration visible in logs.
      console.warn(
        '[sabmail] bulk send missing SABMAIL_APP_URL/NEXT_PUBLIC_APP_URL — List-Unsubscribe header omitted',
      );
    }
    // Postmaster correlation — campaign id (or 'tx') : workspace : sabmail.
    extraHeaders['Feedback-ID'] =
      `${input.unsubscribe.campaignId ?? 'tx'}:${ctx.workspaceId}:sabmail`;
  }

  const mailOptions: Record<string, unknown> = {
    from,
    to: allowedTo,
    cc: (input.cc ?? []).map((s) => s.trim()).filter(Boolean),
    bcc: (input.bcc ?? []).map((s) => s.trim()).filter(Boolean),
    subject,
    text: text || ' ',
    ...(html ? { html } : {}),
    ...(input.inReplyTo ? { inReplyTo: input.inReplyTo } : {}),
    ...(input.references && input.references.length ? { references: input.references } : {}),
    ...(input.attachments && input.attachments.length
      ? {
          attachments: input.attachments
            .filter((a) => a.url)
            .map((a) => ({ filename: a.filename, href: a.url })),
        }
      : {}),
    ...(Object.keys(extraHeaders).length ? { headers: extraHeaders } : {}),
  };

  const nm = (await import('nodemailer')) as any;
  const nodemailer = nm.default ?? nm;

  let messageId = '';
  try {
    const transport = nodemailer.createTransport({
      host: account.smtp.host,
      port: account.smtp.port,
      secure: account.smtp.secure,
      auth: { user: smtpUser, pass: smtpPass },
      connectionTimeout: 20_000,
    });
    const info = await transport.sendMail(mailOptions);
    messageId = info?.messageId ?? '';
  } catch (e) {
    throw new Error(`Send failed: ${getErrorMessage(e)}`);
  }

  // Best-effort: append a copy to the Sent folder (build raw via a stream transport).
  try {
    const buildTransport = nodemailer.createTransport({
      streamTransport: true,
      buffer: true,
      newline: 'unix',
    });
    const built = await buildTransport.sendMail(mailOptions);
    const raw: Buffer | undefined = built?.message;
    if (raw) {
      await withImap(ctx, async (client) => {
        const sent = await resolveSpecialFolder(client, '\\Sent', [
          'Sent',
          'Sent Mail',
          'Sent Items',
        ]);
        if (sent) {
          await client.append(sent, raw, ['\\Seen']);
        }
      });
    }
  } catch {
    /* non-fatal — the message was already sent */
  }

  return { messageId };
}

/**
 * The IMAP `MailProvider` implementation. Exported as the documented named
 * `provider` export so `getMailProvider` (in `./types.ts`) can resolve it via
 * its dynamic `./imap` import.
 */
export const provider: MailProvider = {
  id: 'imap',
  listFolders,
  listMessages,
  getMessage,
  setFlag,
  archive,
  trash,
  send,
};

export default provider;
