'use server';

import { ObjectId, type WithId } from 'mongodb';

import { getSabmailWorkspaceId } from '@/lib/sabmail/workspace';
import { getSabmailCollections, SABMAIL_COLLECTIONS } from '@/lib/sabmail/db/collections';
import { decryptMailboxCreds } from '@/lib/sabmail/credentials';
import { sabmailLlm } from '@/lib/sabmail/ai';
import { isSabmailSuppressed } from '@/lib/sabmail/suppressions';
import {
  makeUnsubscribeToken,
  buildUnsubscribeHeaders,
} from '@/lib/sabmail/unsubscribe';
import type { SabmailAccount } from '@/lib/sabmail/types';
import {
  getMailProvider,
  buildProviderContext,
  type MailProvider,
  type MailProviderContext,
} from '@/lib/sabmail/providers/types';
import { getActiveSnoozedUids } from './snooze-actions';
import { searchSabmailMessagesIndex } from '@/lib/sabmail/search';
import { getErrorMessage } from '@/lib/utils';

/* ──────────────────────────────────────────────────────────────────────
 * SabMail inbox — real, on-demand IMAP read (Phase 1 MVP).
 *
 * Connects to a connected IMAP mailbox per request via `imapflow`, lists
 * folders + recent message envelopes, and fetches+parses a single message
 * body (sanitized server-side, remote images blocked by default). The
 * background sync engine + optimistic write path (Phase 1b) replace the
 * per-request connect later; the API shape here stays stable.
 *
 * Reuses the proven connect/fetch/parse pattern from
 * `src/lib/integrations/imap-tickets.ts`.
 * ──────────────────────────────────────────────────────────────────── */

export interface SabmailFolderRow {
  path: string;
  name: string;
  specialUse: string | null;
  subscribed: boolean;
}

export interface SabmailMessageRow {
  uid: number;
  subject: string;
  fromName: string;
  fromEmail: string;
  date: string | null;
  seen: boolean;
  flagged: boolean;
  hasAttachments: boolean;
  /** From ENVELOPE (free, no header fetch) — powers client-side JWZ threading. */
  messageId: string | null;
  inReplyTo: string | null;
  /**
   * HEY-style screener verdict for the sender (`pending`/`allowed`/`denied`),
   * or `null` when the sender has no screener record yet. Annotated from the
   * `sabmail_screener` collection after the envelope fetch.
   */
  screenerDecision: string | null;
}

export interface SabmailAttachmentMeta {
  filename: string;
  contentType: string;
  size: number;
}

export interface SabmailMessageFull {
  uid: number;
  subject: string;
  from: { name: string; email: string };
  to: string[];
  cc: string[];
  date: string | null;
  html: string | null;
  text: string | null;
  attachments: SabmailAttachmentMeta[];
  /** True when remote images were stripped (offer a "show images" toggle). */
  hadRemoteImages: boolean;
  /** RFC Message-ID + References chain — drives correct reply threading. */
  messageId: string | null;
  references: string[];
}

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };
type VoidResult = { ok: true } | { ok: false; error: string };

interface LoadedAccount {
  workspaceId: string;
  account: WithId<SabmailAccount>;
  creds: { imapUser: string; imapPass: string };
}

type LoadAccountResult = { ok: true; data: LoadedAccount } | { ok: false; error: string };

/** Load/decrypt an IMAP account for an EXPLICIT workspace (no session/cookie). */
async function loadAccountForWorkspace(
  workspaceId: string,
  accountId: string,
): Promise<LoadAccountResult> {
  if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };
  if (!accountId || !ObjectId.isValid(accountId)) {
    return { ok: false, error: 'Invalid account id.' };
  }
  const { cols } = await getSabmailCollections();
  const account = (await cols.accounts.findOne({
    _id: new ObjectId(accountId),
    workspaceId,
  })) as WithId<SabmailAccount> | null;
  if (!account) return { ok: false, error: 'Mailbox not found.' };
  if (account.provider !== 'imap' || !account.imap || !account.credentialsCipher) {
    return { ok: false, error: 'This mailbox is not an IMAP account.' };
  }
  let creds: Record<string, unknown>;
  try {
    creds = decryptMailboxCreds(workspaceId, account.credentialsCipher);
  } catch {
    return { ok: false, error: 'Could not read mailbox credentials.' };
  }
  const imapUser = String(creds.imapUser ?? '');
  const imapPass = String(creds.imapPass ?? '');
  if (!imapUser || !imapPass) {
    return { ok: false, error: 'Mailbox credentials are incomplete — reconnect the account.' };
  }
  return { ok: true, data: { workspaceId, account, creds: { imapUser, imapPass } } };
}

/** Authorize the active workspace (session + cookie) + load/decrypt the IMAP account. */
async function loadAccount(accountId: string): Promise<LoadAccountResult> {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };
  return loadAccountForWorkspace(workspaceId, accountId);
}

/* ── provider dispatch (non-IMAP) ────────────────────────────────────────
 *
 * IMAP accounts keep flowing through `loadAccount`/`loadAccountForWorkspace` +
 * `withImap` UNCHANGED. For every OTHER provider ('gmail' | 'outlook' |
 * 'hosted'→graph/imap-adapter) the public actions short-circuit to the
 * provider registry BEFORE touching any IMAP code, so the same inbox UI works
 * across transports.
 *
 * The IMAP-specific account loaders above intentionally reject non-IMAP
 * accounts ("This mailbox is not an IMAP account."); these resolvers instead
 * load the account for the registry path WITHOUT that IMAP-only validation,
 * then build the `MailProviderContext` (which decrypts the OAuth/other creds).
 *
 * uid/id boundary: the inbox actions speak numeric `uid`; the `MailProvider`
 * contract speaks string `id`. We map `String(uid)` on the way in. Adapters
 * return the `Sabmail*` shapes directly (incl. the numeric `uid` on
 * `SabmailMessageFull`), so no Number()-cast is needed on the way out — the
 * adapter owns round-tripping its id form back into the numeric field.
 * ──────────────────────────────────────────────────────────────────── */

interface ResolvedProvider {
  workspaceId: string;
  provider: MailProvider;
  ctx: MailProviderContext;
}

type ResolveProviderResult =
  | { ok: true; data: ResolvedProvider }
  | { ok: false; error: string };

/** Load a (non-IMAP) account for an EXPLICIT workspace and resolve its adapter. */
async function resolveProviderForWorkspace(
  workspaceId: string,
  accountId: string,
): Promise<ResolveProviderResult> {
  if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };
  if (!accountId || !ObjectId.isValid(accountId)) {
    return { ok: false, error: 'Invalid account id.' };
  }
  const { cols } = await getSabmailCollections();
  const account = (await cols.accounts.findOne({
    _id: new ObjectId(accountId),
    workspaceId,
  })) as WithId<SabmailAccount> | null;
  if (!account) return { ok: false, error: 'Mailbox not found.' };

  const provider = await getMailProvider(account);
  if (!provider) {
    return {
      ok: false,
      error: 'This mailbox provider is not supported yet.',
    };
  }
  let ctx: MailProviderContext;
  try {
    ctx = await buildProviderContext(workspaceId, account);
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
  return { ok: true, data: { workspaceId, provider, ctx } };
}

/** True when an account should dispatch through the provider registry (non-IMAP). */
function isNonImap(provider: SabmailAccount['provider'] | string | undefined): boolean {
  return provider !== 'imap';
}

/**
 * Cheap provider-kind peek for dispatch routing — reads ONLY the `provider`
 * field so we can decide IMAP-inline vs registry-dispatch without paying for
 * the IMAP credential decrypt the loaders do. Scoped to the workspace, so it
 * doubles as the not-found / wrong-tenant guard before either path runs.
 * Returns `undefined` when the account is missing/invalid (callers fall through
 * to the IMAP loaders, which produce the canonical "Mailbox not found." error).
 */
async function peekAccountProvider(
  workspaceId: string,
  accountId: string,
): Promise<string | undefined> {
  if (!workspaceId || !accountId || !ObjectId.isValid(accountId)) return undefined;
  try {
    const { cols } = await getSabmailCollections();
    const doc = (await cols.accounts.findOne(
      { _id: new ObjectId(accountId), workspaceId },
      { projection: { provider: 1 } },
    )) as { provider?: string } | null;
    return doc?.provider;
  } catch {
    return undefined;
  }
}

/** Connect, run `fn`, always log out. imapflow is typed loosely (no bundled d.ts in strict mode). */
async function withImap<T>(
  loaded: LoadedAccount,
  fn: (client: any) => Promise<T>,
): Promise<T> {
  const mod = (await import('imapflow')) as unknown as {
    ImapFlow: new (opts: unknown) => any;
  };
  const imap = loaded.account.imap!;
  const client = new mod.ImapFlow({
    host: imap.host,
    port: imap.port,
    secure: imap.secure,
    auth: { user: loaded.creds.imapUser, pass: loaded.creds.imapPass },
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

/** Sanitize untrusted email HTML server-side; block remote images unless asked. */
async function sanitizeEmailHtml(html: string, showRemoteImages: boolean): Promise<string> {
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

/* ── public actions ──────────────────────────────────────────────────── */

export async function listSabmailFolders(
  accountId: string,
): Promise<Result<{ folders: SabmailFolderRow[] }>> {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };
  const kind = await peekAccountProvider(workspaceId, accountId);
  if (isNonImap(kind)) {
    const resolved = await resolveProviderForWorkspace(workspaceId, accountId);
    if (!resolved.ok) return { ok: false, error: resolved.error };
    try {
      const folders = await resolved.data.provider.listFolders(resolved.data.ctx);
      return { ok: true, folders };
    } catch (e) {
      return { ok: false, error: getErrorMessage(e) };
    }
  }
  const loaded = await loadAccount(accountId);
  if (!loaded.ok) return { ok: false, error: loaded.error };
  try {
    const folders = await withImap(loaded.data, async (client) => {
      const list = (await client.list()) as any[];
      return list.map((f) => ({
        path: f.path as string,
        name: (f.name ?? f.path) as string,
        specialUse: (f.specialUse ?? null) as string | null,
        subscribed: !!f.subscribed,
      }));
    });
    return { ok: true, folders };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

/**
 * Batch-annotate rows with each sender's screener verdict — one query per page
 * (by unique fromEmails), then map decisions back onto the rows. Senders with
 * no screener record keep `screenerDecision: null`. Best-effort.
 */
async function annotateScreenerDecisions(
  workspaceId: string,
  rows: SabmailMessageRow[],
): Promise<void> {
  if (!workspaceId || rows.length === 0) return;
  const emails = Array.from(
    new Set(rows.map((r) => r.fromEmail).filter((e): e is string => !!e)),
  );
  if (emails.length === 0) return;
  try {
    const { db } = await getSabmailCollections();
    const docs = (await db
      .collection(SABMAIL_COLLECTIONS.screener)
      .find(
        { workspaceId, email: { $in: emails } },
        { projection: { email: 1, decision: 1 } },
      )
      .toArray()) as Array<{ email?: string; decision?: string }>;
    const byEmail = new Map<string, string>();
    for (const d of docs) {
      if (d.email) byEmail.set(d.email, String(d.decision ?? 'pending'));
    }
    for (const r of rows) {
      r.screenerDecision = byEmail.get(r.fromEmail) ?? null;
    }
  } catch {
    /* best-effort — screener annotation is non-essential */
  }
}

/**
 * Drop currently-snoozed messages from a freshly-built page, decrementing the
 * reported total accordingly. Best-effort: a snooze-lookup failure (or no
 * workspace) leaves the list untouched so snooze never breaks inbox loading.
 * `folder` is the IMAP path (e.g. 'INBOX'); the param order mirrors the
 * `getActiveSnoozedUids(workspaceId, accountId, folder)` helper.
 */
async function filterSnoozedMessages(
  workspaceId: string,
  accountId: string,
  folder: string,
  data: { messages: SabmailMessageRow[]; total: number },
): Promise<{ messages: SabmailMessageRow[]; total: number }> {
  try {
    const hidden = new Set(await getActiveSnoozedUids(workspaceId, accountId, folder));
    if (hidden.size === 0) return data;
    const kept = data.messages.filter((row) => !hidden.has(row.uid));
    const removed = data.messages.length - kept.length;
    return { messages: kept, total: Math.max(0, data.total - removed) };
  } catch {
    return data;
  }
}

export async function listSabmailMessages(
  accountId: string,
  path = 'INBOX',
  page = 0,
  pageSize = 30,
): Promise<Result<{ messages: SabmailMessageRow[]; total: number }>> {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };
  return listSabmailMessagesForWorkspace(workspaceId, accountId, path, page, pageSize);
}

/**
 * Workspace-explicit message listing — for contexts WITHOUT a session/cookie
 * (e.g. the RAG-ingest cron sweep). Resolves the account by the passed
 * `workspaceId`; otherwise identical to `listSabmailMessages`.
 */
export async function listSabmailMessagesForWorkspace(
  workspaceId: string,
  accountId: string,
  path = 'INBOX',
  page = 0,
  pageSize = 30,
): Promise<Result<{ messages: SabmailMessageRow[]; total: number }>> {
  if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };
  const kind = await peekAccountProvider(workspaceId, accountId);
  if (isNonImap(kind)) {
    const resolved = await resolveProviderForWorkspace(workspaceId, accountId);
    if (!resolved.ok) return { ok: false, error: resolved.error };
    try {
      const data = await resolved.data.provider.listMessages(
        resolved.data.ctx,
        path,
        page,
        pageSize,
      );
      await annotateScreenerDecisions(resolved.data.workspaceId, data.messages);
      const visible = await filterSnoozedMessages(
        resolved.data.workspaceId,
        accountId,
        path,
        data,
      );
      return { ok: true, ...visible };
    } catch (e) {
      return { ok: false, error: getErrorMessage(e) };
    }
  }
  const loaded = await loadAccountForWorkspace(workspaceId, accountId);
  if (!loaded.ok) return { ok: false, error: loaded.error };
  try {
    const data = await withImap(loaded.data, async (client) => {
      const lock = await client.getMailboxLock(path);
      try {
        const total: number = client.mailbox?.exists ?? 0;
        if (total === 0) return { messages: [] as SabmailMessageRow[], total: 0 };
        const end = total - page * pageSize;
        if (end < 1) return { messages: [] as SabmailMessageRow[], total };
        const start = Math.max(1, end - pageSize + 1);

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
    await annotateScreenerDecisions(loaded.data.workspaceId, data.messages);
    const visible = await filterSnoozedMessages(
      loaded.data.workspaceId,
      accountId,
      path,
      data,
    );
    return { ok: true, ...visible };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

export async function getSabmailMessage(
  accountId: string,
  path: string,
  uid: number,
  opts?: { showRemoteImages?: boolean; markSeen?: boolean },
): Promise<Result<{ message: SabmailMessageFull }>> {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };
  return getSabmailMessageForWorkspace(workspaceId, accountId, path, uid, opts);
}

/**
 * Workspace-explicit single-message fetch — for contexts WITHOUT a
 * session/cookie (e.g. the RAG-ingest cron sweep). Resolves the account by the
 * passed `workspaceId`; otherwise identical to `getSabmailMessage`.
 */
export async function getSabmailMessageForWorkspace(
  workspaceId: string,
  accountId: string,
  path: string,
  uid: number,
  opts?: { showRemoteImages?: boolean; markSeen?: boolean },
): Promise<Result<{ message: SabmailMessageFull }>> {
  if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };
  const kind = await peekAccountProvider(workspaceId, accountId);
  if (isNonImap(kind)) {
    const resolved = await resolveProviderForWorkspace(workspaceId, accountId);
    if (!resolved.ok) return { ok: false, error: resolved.error };
    try {
      // uid/id boundary: the action signature stays numeric (`uid`); the
      // adapter contract takes a string id. For non-IMAP the id round-trips as
      // the numeric form rendered to string here — the adapter returns the full
      // shape (incl. the numeric `uid`) directly, so no cast on the way back.
      const message = await resolved.data.provider.getMessage(
        resolved.data.ctx,
        path,
        String(uid),
        opts,
      );
      return { ok: true, message };
    } catch (e) {
      return { ok: false, error: getErrorMessage(e) };
    }
  }
  const loaded = await loadAccountForWorkspace(workspaceId, accountId);
  if (!loaded.ok) return { ok: false, error: loaded.error };
  const showRemoteImages = !!opts?.showRemoteImages;
  const markSeen = opts?.markSeen !== false;
  try {
    const message = await withImap(loaded.data, async (client) => {
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
    return { ok: true, message };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

/* ── send + mutations ────────────────────────────────────────────────── */

export interface SabmailSendInput {
  accountId: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  /** Rich body (sanitized server-side before sending). */
  html?: string;
  text?: string;
  /** Reply context: Message-ID being replied to + the References chain. */
  inReplyTo?: string;
  references?: string[];
  /** SabFiles attachments — fetched by URL at send time. */
  attachments?: { filename: string; url: string }[];
  /**
   * Bulk-mail provenance: when present, this send gets a one-click
   * `List-Unsubscribe` header (RFC 8058) + a `Feedback-ID` for Postmaster
   * correlation. Set ONLY on campaign / bulk sends — 1:1 inbox replies omit
   * it so they stay header-clean (transactional, never "unsubscribable").
   */
  unsubscribe?: { email: string; campaignId?: string };
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

/** Find a special-use mailbox path (e.g. Sent/Archive/Trash/Junk) with name fallbacks. */
async function resolveSpecialFolder(
  client: any,
  specialUse: string,
  nameFallbacks: string[],
): Promise<string | null> {
  try {
    const list = (await client.list()) as any[];
    const bySpecial = list.find(
      (f) => typeof f.specialUse === 'string' && f.specialUse.toLowerCase() === specialUse.toLowerCase(),
    );
    if (bySpecial) return bySpecial.path as string;
    const wanted = nameFallbacks.map((n) => n.toLowerCase());
    const byName = list.find((f) => wanted.includes(String(f.name ?? f.path).toLowerCase()));
    return byName ? (byName.path as string) : null;
  } catch {
    return null;
  }
}

export async function sendSabmailMessage(
  input: SabmailSendInput,
): Promise<Result<{ messageId: string }>> {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };
  const kind = await peekAccountProvider(workspaceId, input.accountId);
  if (isNonImap(kind)) {
    const resolved = await resolveProviderForWorkspace(workspaceId, input.accountId);
    if (!resolved.ok) return { ok: false, error: resolved.error };
    try {
      return { ok: true, ...(await resolved.data.provider.send(resolved.data.ctx, input)) };
    } catch (e) {
      return { ok: false, error: getErrorMessage(e) };
    }
  }
  const loaded = await loadAccount(input.accountId);
  if (!loaded.ok) return { ok: false, error: loaded.error };
  return sendWithLoaded(loaded.data, input);
}

/**
 * Workspace-explicit send — for contexts WITHOUT a session/cookie (e.g. the
 * scheduled-send cron sweep). Resolves the account by the passed `workspaceId`.
 */
export async function sendSabmailMessageForWorkspace(
  workspaceId: string,
  input: SabmailSendInput,
): Promise<Result<{ messageId: string }>> {
  // Non-IMAP (Gmail/Outlook) accounts dispatch through the provider registry —
  // so scheduled/bulk campaign sends from those mailboxes work too, not just
  // the interactive path.
  const kind = await peekAccountProvider(workspaceId, input.accountId);
  if (isNonImap(kind)) {
    const resolved = await resolveProviderForWorkspace(workspaceId, input.accountId);
    if (!resolved.ok) return { ok: false, error: resolved.error };
    try {
      return { ok: true, ...(await resolved.data.provider.send(resolved.data.ctx, input)) };
    } catch (e) {
      return { ok: false, error: getErrorMessage(e) };
    }
  }
  const loaded = await loadAccountForWorkspace(workspaceId, input.accountId);
  if (!loaded.ok) return { ok: false, error: loaded.error };
  return sendWithLoaded(loaded.data, input);
}

async function sendWithLoaded(
  loaded: LoadedAccount,
  input: SabmailSendInput,
): Promise<Result<{ messageId: string }>> {
  const account = loaded.account;
  if (!account.smtp?.host) {
    return {
      ok: false,
      error: 'This mailbox has no SMTP configured — reconnect it with SMTP details to send.',
    };
  }

  const to = (input.to ?? []).map((s) => s.trim()).filter(Boolean);
  if (to.length === 0) return { ok: false, error: 'Add at least one recipient.' };

  // Drop suppressed recipients (hard bounce / complaint / unsubscribe) before sending.
  const allowedTo: string[] = [];
  for (const addr of to) {
    const email = (addr.match(/<([^>]+)>/)?.[1] ?? addr).trim().toLowerCase();
    if (!(await isSabmailSuppressed(loaded.workspaceId, email))) allowedTo.push(addr);
  }
  if (allowedTo.length === 0) {
    return { ok: false, error: 'All recipients are on the suppression list.' };
  }

  const subject = input.subject?.trim() || '(no subject)';

  // Decrypt SMTP creds (fall back to the IMAP user/pass — same mailbox login).
  let creds: Record<string, unknown>;
  try {
    creds = decryptMailboxCreds(loaded.workspaceId, account.credentialsCipher!);
  } catch {
    return { ok: false, error: 'Could not read mailbox credentials.' };
  }
  const smtpUser = String(creds.smtpUser ?? creds.imapUser ?? '');
  const smtpPass = String(creds.smtpPass ?? creds.imapPass ?? '');

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
        loaded.workspaceId,
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
      `${input.unsubscribe.campaignId ?? 'tx'}:${loaded.workspaceId}:sabmail`;
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
    return { ok: false, error: `Send failed: ${getErrorMessage(e)}` };
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
      await withImap(loaded, async (client) => {
        const sent = await resolveSpecialFolder(client, '\\Sent', ['Sent', 'Sent Mail', 'Sent Items']);
        if (sent) {
          await client.append(sent, raw, ['\\Seen']);
        }
      });
    }
  } catch {
    /* non-fatal — the message was already sent */
  }

  return { ok: true, messageId };
}

async function moveToSpecial(
  accountId: string,
  path: string,
  uid: number,
  specialUse: string,
  nameFallbacks: string[],
): Promise<VoidResult> {
  const loaded = await loadAccount(accountId);
  if (!loaded.ok) return { ok: false, error: loaded.error };
  try {
    await withImap(loaded.data, async (client) => {
      const dest = await resolveSpecialFolder(client, specialUse, nameFallbacks);
      if (!dest) throw new Error(`No ${nameFallbacks[0]} folder found on this mailbox.`);
      const lock = await client.getMailboxLock(path);
      try {
        await client.messageMove(String(uid), dest, { uid: true });
      } finally {
        lock.release();
      }
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

export async function archiveSabmailMessage(
  accountId: string,
  path: string,
  uid: number,
): Promise<VoidResult> {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };
  const kind = await peekAccountProvider(workspaceId, accountId);
  if (isNonImap(kind)) {
    const resolved = await resolveProviderForWorkspace(workspaceId, accountId);
    if (!resolved.ok) return { ok: false, error: resolved.error };
    try {
      await resolved.data.provider.archive(resolved.data.ctx, path, String(uid));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: getErrorMessage(e) };
    }
  }
  return moveToSpecial(accountId, path, uid, '\\Archive', ['Archive', 'All Mail', '[Gmail]/All Mail']);
}

export async function trashSabmailMessage(
  accountId: string,
  path: string,
  uid: number,
): Promise<VoidResult> {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };
  const kind = await peekAccountProvider(workspaceId, accountId);
  if (isNonImap(kind)) {
    const resolved = await resolveProviderForWorkspace(workspaceId, accountId);
    if (!resolved.ok) return { ok: false, error: resolved.error };
    try {
      await resolved.data.provider.trash(resolved.data.ctx, path, String(uid));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: getErrorMessage(e) };
    }
  }
  return moveToSpecial(accountId, path, uid, '\\Trash', ['Trash', 'Deleted', 'Deleted Items', '[Gmail]/Trash']);
}

export async function setSabmailFlag(
  accountId: string,
  path: string,
  uid: number,
  flag: 'seen' | 'flagged',
  value: boolean,
): Promise<VoidResult> {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };
  const kind = await peekAccountProvider(workspaceId, accountId);
  if (isNonImap(kind)) {
    const resolved = await resolveProviderForWorkspace(workspaceId, accountId);
    if (!resolved.ok) return { ok: false, error: resolved.error };
    try {
      await resolved.data.provider.setFlag(resolved.data.ctx, path, String(uid), flag, value);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: getErrorMessage(e) };
    }
  }
  const loaded = await loadAccount(accountId);
  if (!loaded.ok) return { ok: false, error: loaded.error };
  const imapFlag = flag === 'seen' ? '\\Seen' : '\\Flagged';
  try {
    await withImap(loaded.data, async (client) => {
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
    return { ok: true };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

/**
 * Apply matched-rule / screener-deny actions to the REAL mailbox for an
 * EXPLICIT workspace — for contexts WITHOUT a session/cookie (the IMAP sync
 * worker + the internal bind route). Resolves the account by `workspaceId`
 * (never `loadAccount`, which is cookie-bound) and reuses the same
 * `withImap` + special-folder + flag patterns as the cookie-bound mutations.
 *
 *   archive  → move the message to \Archive (Gmail "All Mail" fallback)
 *   markRead → add the \Seen flag
 *
 * Best-effort: never throws — a mailbox hiccup must not drop binding.
 */
export async function applySabmailMailboxActionsForWorkspace(
  workspaceId: string,
  accountId: string,
  path: string,
  uid: number,
  actions: { archive?: boolean; markRead?: boolean },
): Promise<{ ok: boolean }> {
  if (!actions.archive && !actions.markRead) return { ok: true };
  const loaded = await loadAccountForWorkspace(workspaceId, accountId);
  if (!loaded.ok) return { ok: false };
  const folder = path || 'INBOX';
  try {
    await withImap(loaded.data, async (client) => {
      if (actions.markRead) {
        // Set \Seen first (before any move) — best-effort per action.
        const lock = await client.getMailboxLock(folder);
        try {
          await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true });
        } catch {
          /* read-only / perms — non-fatal */
        } finally {
          lock.release();
        }
      }
      if (actions.archive) {
        // Reuse the archive logic: resolve \Archive (Gmail "All Mail") + move.
        const dest = await resolveSpecialFolder(client, '\\Archive', [
          'Archive',
          'All Mail',
          '[Gmail]/All Mail',
        ]);
        if (dest && dest !== folder) {
          const lock = await client.getMailboxLock(folder);
          try {
            await client.messageMove(String(uid), dest, { uid: true });
          } catch {
            /* no Archive / perms — non-fatal */
          } finally {
            lock.release();
          }
        }
      }
    });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/* ── AI (summaries, drafts, write-with-AI) ───────────────────────────── */

function bodyText(parsed: any): string {
  const t = parsed?.text;
  if (typeof t === 'string' && t.trim()) return t;
  return parsed?.html ? htmlToPlain(parsed.html) : '';
}

/** Summarize a conversation (newest ≤8 messages) into a tight brief + action items. */
export async function summarizeSabmailThread(
  accountId: string,
  path: string,
  uids: number[],
): Promise<Result<{ summary: string }>> {
  const loaded = await loadAccount(accountId);
  if (!loaded.ok) return { ok: false, error: loaded.error };
  if (!uids.length) return { ok: false, error: 'No messages to summarize.' };
  try {
    const parts = await withImap(loaded.data, async (client) => {
      const lock = await client.getMailboxLock(path);
      try {
        const mp = (await import('mailparser')) as unknown as {
          simpleParser: (src: unknown) => Promise<any>;
        };
        const out: string[] = [];
        for (const uid of uids.slice(0, 8)) {
          const msg = await client.fetchOne(String(uid), { uid: true, source: true }, { uid: true });
          if (!msg || !msg.source) continue;
          const parsed = await mp.simpleParser(msg.source);
          const from = parsed.from?.text ?? '';
          const date = parsed.date ? new Date(parsed.date).toISOString() : '';
          out.push(
            `From: ${from}\nDate: ${date}\nSubject: ${parsed.subject ?? ''}\n\n${bodyText(parsed).slice(0, 4000)}`,
          );
        }
        return out;
      } finally {
        lock.release();
      }
    });
    if (!parts.length) return { ok: false, error: 'Could not read the conversation.' };
    const llm = await sabmailLlm({
      system:
        'You summarize email threads for a busy professional. Reply with a tight 2–4 sentence summary, then (only if any exist) a short "Action items:" bullet list. No preamble, no sign-off.',
      prompt: `Summarize this email thread:\n\n${parts.join('\n\n---\n\n')}`,
      maxTokens: 500,
    });
    if (!llm.ok) return { ok: false, error: llm.error };
    return { ok: true, summary: llm.text.trim() };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

/** Draft a reply body (plain text) to a message; optional freeform instruction. */
export async function aiDraftReply(
  accountId: string,
  path: string,
  uid: number,
  instruction?: string,
): Promise<Result<{ draft: string }>> {
  const loaded = await loadAccount(accountId);
  if (!loaded.ok) return { ok: false, error: loaded.error };
  try {
    const ctx = await withImap(loaded.data, async (client) => {
      const mp = (await import('mailparser')) as unknown as {
        simpleParser: (src: unknown) => Promise<any>;
      };

      // Original message under the current folder.
      let original: { from: string; subject: string; body: string };
      {
        const lock = await client.getMailboxLock(path);
        try {
          const msg = await client.fetchOne(String(uid), { uid: true, source: true }, { uid: true });
          if (!msg || !msg.source) throw new Error('Message not found.');
          const parsed = await mp.simpleParser(msg.source);
          original = {
            from: parsed.from?.text ?? '',
            subject: parsed.subject ?? '',
            body: bodyText(parsed).slice(0, 6000),
          };
        } finally {
          lock.release();
        }
      }

      // Voice exemplars: a few of the user's recent Sent messages (best-effort).
      const exemplars: string[] = [];
      try {
        const sentPath = await resolveSpecialFolder(client, '\\Sent', ['Sent', 'Sent Mail', 'Sent Items']);
        if (sentPath) {
          const lock2 = await client.getMailboxLock(sentPath);
          try {
            const total: number = client.mailbox?.exists ?? 0;
            if (total > 0) {
              const start = Math.max(1, total - 4);
              for await (const m of client.fetch(`${start}:${total}`, { uid: true, source: true })) {
                if (!m.source) continue;
                const p = await mp.simpleParser(m.source);
                const t = bodyText(p).trim();
                if (t) exemplars.push(t.slice(0, 1200));
              }
            }
          } finally {
            lock2.release();
          }
        }
      } catch {
        /* no Sent access — fall back to a neutral voice */
      }

      return { ...original, exemplars };
    });

    const voiceBlock = ctx.exemplars.length
      ? `\n\nMatch the tone, phrasing, and sign-off of how I write (examples of my sent emails):\n${ctx.exemplars
          .map((e, i) => `Example ${i + 1}:\n${e}`)
          .join('\n\n')}`
      : '';

    const llm = await sabmailLlm({
      system:
        'You draft email replies in the user\'s own voice. Write a concise, professional reply body in plain text. Return ONLY the reply body — no subject line, no quoted original, no "[Your name]" placeholder.',
      prompt: `Draft a reply to this email${
        instruction ? ` (follow this instruction: ${instruction})` : ''
      }:\n\nFrom: ${ctx.from}\nSubject: ${ctx.subject}\n\n${ctx.body}${voiceBlock}`,
      maxTokens: 600,
    });
    if (!llm.ok) return { ok: false, error: llm.error };
    return { ok: true, draft: llm.text.trim() };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

/**
 * Precomputed suggested replies — up to 3 short, distinct reply options for an
 * open message (powers the "Suggest replies" chips under the reading pane).
 *
 * Cheaper than `aiDraftReply` by design: no Sent-folder voice exemplars, a
 * trimmed body, and a small token budget — one quick LLM call that returns a
 * JSON array of brief strings. Defensive: returns `{ ok:false }` when AI is not
 * configured or the model returns nothing usable, so the chips simply don't show.
 */
export async function suggestSabmailReplies(
  accountId: string,
  path: string,
  uid: number,
): Promise<Result<{ suggestions: string[] }>> {
  const loaded = await loadAccount(accountId);
  if (!loaded.ok) return { ok: false, error: loaded.error };
  try {
    const original = await withImap(loaded.data, async (client) => {
      const mp = (await import('mailparser')) as unknown as {
        simpleParser: (src: unknown) => Promise<any>;
      };
      const lock = await client.getMailboxLock(path);
      try {
        const msg = await client.fetchOne(
          String(uid),
          { uid: true, source: true },
          { uid: true },
        );
        if (!msg || !msg.source) throw new Error('Message not found.');
        const parsed = await mp.simpleParser(msg.source);
        return {
          from: parsed.from?.text ?? '',
          subject: parsed.subject ?? '',
          body: bodyText(parsed).slice(0, 3500),
        };
      } finally {
        lock.release();
      }
    });

    const llm = await sabmailLlm({
      system:
        'You generate quick reply suggestions for an email. Return ONLY a JSON array of exactly 3 short, distinct reply options as plain-text strings (each 1–2 sentences, ready to send, no greeting/sign-off/placeholders). Cover a range — e.g. a yes/accept, a clarifying question, and a defer/decline — when sensible. No prose, no code fences.',
      prompt: `Suggest 3 brief replies to this email:\n\nFrom: ${original.from}\nSubject: ${original.subject}\n\n${original.body}`,
      maxTokens: 400,
    });
    if (!llm.ok) return { ok: false, error: llm.error };

    const arr = parseLlmArray(llm.text);
    if (!arr) return { ok: false, error: 'AI returned an unexpected format.' };
    const suggestions = arr
      .map((s) => (typeof s === 'string' ? s.trim() : ''))
      .filter((s): s is string => s.length > 0)
      .slice(0, 3);
    if (suggestions.length === 0) {
      return { ok: false, error: 'No suggestions were generated.' };
    }
    return { ok: true, suggestions };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

/** Generate an email body from a short instruction (composer "Write with AI"). */
export async function aiWriteCompose(
  instruction: string,
): Promise<Result<{ text: string }>> {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };
  if (!instruction?.trim()) return { ok: false, error: 'Describe what to write.' };
  const llm = await sabmailLlm({
    system:
      'You write email bodies from a short instruction. Return ONLY the email body in plain text — clear, professional, and ready to send.',
    prompt: instruction.trim(),
    maxTokens: 600,
  });
  if (!llm.ok) return { ok: false, error: llm.error };
  return { ok: true, text: llm.text.trim() };
}

/* ── search (Meilisearch when configured, else IMAP SEARCH) ──────────── */

export async function searchSabmailMessages(
  accountId: string,
  path: string,
  query: string,
): Promise<Result<{ messages: SabmailMessageRow[] }>> {
  const loaded = await loadAccount(accountId);
  if (!loaded.ok) return { ok: false, error: loaded.error };
  const q = query.trim();
  if (!q) return { ok: true, messages: [] };

  // Fast path: try the Meilisearch index first (when MEILISEARCH_URL is set and
  // the index is warm). The layer returns `null` to signal "fall back" — when
  // unconfigured, the package is missing, the index is empty, or any error —
  // so the IMAP search below stays the source of truth otherwise. UX-identical.
  try {
    const indexed = await searchSabmailMessagesIndex(
      loaded.data.workspaceId,
      accountId,
      q,
      { folder: path },
    );
    if (indexed) {
      await annotateScreenerDecisions(loaded.data.workspaceId, indexed);
      return { ok: true, messages: indexed };
    }
  } catch {
    /* index hiccup — fall through to IMAP search */
  }

  try {
    const messages = await withImap(loaded.data, async (client) => {
      const lock = await client.getMailboxLock(path);
      try {
        let uids: number[] = [];
        try {
          uids =
            ((await client.search(
              { or: [{ subject: q }, { from: q }, { to: q }, { body: q }] },
              { uid: true },
            )) as number[]) || [];
        } catch {
          // Some servers reject OR/body criteria — fall back to subject-only.
          uids = ((await client.search({ subject: q }, { uid: true })) as number[]) || [];
        }
        if (!uids.length) return [] as SabmailMessageRow[];
        const top = uids.slice(-80); // newest UIDs are the largest
        const rows: SabmailMessageRow[] = [];
        for await (const msg of client.fetch(
          top,
          { uid: true, envelope: true, flags: true, bodyStructure: true },
          { uid: true },
        )) {
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
        rows.sort((a, b) => (Date.parse(b.date ?? '') || 0) - (Date.parse(a.date ?? '') || 0));
        return rows;
      } finally {
        lock.release();
      }
    });
    await annotateScreenerDecisions(loaded.data.workspaceId, messages);
    return { ok: true, messages };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

/* ── AI triage (smart categories) ────────────────────────────────────── */

export type SabmailCategory = 'urgent' | 'action' | 'fyi' | 'newsletter' | 'other';

const CATEGORY_SET: SabmailCategory[] = ['urgent', 'action', 'fyi', 'newsletter', 'other'];

function parseLlmArray(text: string): unknown[] | null {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed: unknown = JSON.parse(cleaned.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Classify a batch of messages (by subject + sender — cheap, no body fetch)
 * into one of five triage categories. Returns a uid→category map.
 */
export async function categorizeSabmailMessages(
  items: Array<{ uid: number; subject: string; from: string }>,
): Promise<Result<{ categories: Array<{ uid: number; category: SabmailCategory }> }>> {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };
  const batch = items.slice(0, 40);
  if (batch.length === 0) return { ok: true, categories: [] };

  const lines = batch
    .map((m) => `uid=${m.uid} | from: ${m.from} | subject: ${m.subject}`)
    .join('\n');
  const llm = await sabmailLlm({
    system:
      'You triage emails into exactly one category each: "urgent" (needs a fast human response), "action" (a task/request, not time-critical), "fyi" (informational, no action needed), "newsletter" (marketing/bulk/automated), or "other". Reply with ONLY a JSON array of {"uid":number,"category":string}. No prose, no code fences.',
    prompt: `Categorize these ${batch.length} emails:\n${lines}`,
    maxTokens: 1200,
  });
  if (!llm.ok) return { ok: false, error: llm.error };

  const arr = parseLlmArray(llm.text);
  if (!arr) return { ok: false, error: 'AI returned an unexpected format.' };
  const categories: Array<{ uid: number; category: SabmailCategory }> = [];
  for (const row of arr) {
    if (row && typeof row === 'object') {
      const uid = Number((row as { uid?: unknown }).uid);
      const cat = String((row as { category?: unknown }).category ?? '').toLowerCase() as SabmailCategory;
      if (Number.isFinite(uid) && CATEGORY_SET.includes(cat)) {
        categories.push({ uid, category: cat });
      }
    }
  }
  return { ok: true, categories };
}
