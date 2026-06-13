import 'server-only';

import {
  ConfidentialClientApplication,
  type Configuration,
} from '@azure/msal-node';

import { getErrorMessage } from '@/lib/utils';
import {
  makeUnsubscribeToken,
  buildUnsubscribeHeaders,
} from '@/lib/sabmail/unsubscribe';
import type { MailProvider, MailProviderContext } from './types';
import type {
  SabmailFolderRow,
  SabmailMessageRow,
  SabmailMessageFull,
  SabmailSendInput,
} from '@/app/sabmail/inbox/actions';

/* ──────────────────────────────────────────────────────────────────────
 * SabMail Microsoft Graph adapter — Outlook / Microsoft 365 (Phase B).
 *
 * Implements the transport-agnostic `MailProvider` contract over the
 * Microsoft Graph REST API (https://graph.microsoft.com/v1.0). Tokens are
 * minted with `@azure/msal-node`'s `ConfidentialClientApplication` from the
 * account's stored OAuth refresh token; every Graph call is a plain `fetch`
 * (we deliberately do NOT depend on `@microsoft/microsoft-graph-client` — it
 * is not installed, so this adapter must compile and run with msal-node +
 * fetch alone).
 *
 * Mapping back to the existing inbox `Sabmail*` shapes (so dispatch is
 * drop-in, same as the IMAP adapter):
 *   - Graph message `id` (an opaque string)            → `String` row id
 *   - `isRead`                                         → `seen`
 *   - `flag.flagStatus === 'flagged'`                  → `flagged`
 *   - `hasAttachments`                                 → `hasAttachments`
 *   - `body.content` (html) sanitized via the same     → `html`
 *     allow-list the inbox uses (remote images blocked by default)
 *
 * The `MailProvider` interface keeps message ids as STRINGS, but the inbox
 * `Sabmail*` row/full types carry a numeric `uid`. Graph ids are opaque
 * strings with no numeric form, so we expose them through a side-channel
 * (`graphId`) and set `uid` to a stable numeric hash purely so the field is
 * populated — callers that round-trip Graph messages MUST use `graphId`, never
 * the synthetic `uid`. (The IMAP adapter is the only one where `uid` is the
 * real provider id.)
 *
 * Credentials / config: minted via msal from
 * `SABMAIL_MS_CLIENT_ID` + `SABMAIL_MS_CLIENT_SECRET` (authority defaults to
 * the common multi-tenant endpoint, overridable via
 * `SABMAIL_MS_AUTHORITY` / a per-account `tenantId`) plus the account's stored
 * `refreshToken`. When any of those are missing, EVERY method throws the same
 * "finish OAuth" error so the inbox surfaces a clean, actionable message.
 * ──────────────────────────────────────────────────────────────────── */

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const GRAPH_SCOPES = ['https://graph.microsoft.com/.default'];
const DEFAULT_AUTHORITY = 'https://login.microsoftonline.com/common';

const NOT_CONNECTED =
  'Outlook account is not OAuth-connected — finish OAuth to enable Graph sync';

/** Fields we request per message envelope (list view — no body). */
const LIST_SELECT = [
  'id',
  'subject',
  'from',
  'isRead',
  'flag',
  'hasAttachments',
  'receivedDateTime',
  'sentDateTime',
  'internetMessageId',
  'conversationId',
].join(',');

/* ── Graph response shapes (only the fields we read) ─────────────────── */

interface GraphEmailAddress {
  name?: string;
  address?: string;
}
interface GraphRecipient {
  emailAddress?: GraphEmailAddress;
}
interface GraphFlag {
  flagStatus?: string;
}
interface GraphBody {
  contentType?: string;
  content?: string;
}
interface GraphAttachment {
  name?: string;
  contentType?: string;
  size?: number;
}
interface GraphMessage {
  id?: string;
  subject?: string;
  from?: GraphRecipient;
  sender?: GraphRecipient;
  toRecipients?: GraphRecipient[];
  ccRecipients?: GraphRecipient[];
  isRead?: boolean;
  flag?: GraphFlag;
  hasAttachments?: boolean;
  receivedDateTime?: string;
  sentDateTime?: string;
  internetMessageId?: string;
  conversationId?: string;
  body?: GraphBody;
}
interface GraphMailFolder {
  id?: string;
  displayName?: string;
  wellKnownName?: string;
}
interface GraphCollection<T> {
  value?: T[];
  '@odata.count'?: number;
}

/* ── token + http helpers ────────────────────────────────────────────── */

interface GraphCreds {
  clientId: string;
  clientSecret: string;
  authority: string;
  refreshToken: string;
}

/**
 * Resolve the env + per-account creds needed for an authenticated Graph call.
 * Throws the canonical NOT_CONNECTED error when anything is missing so every
 * adapter method fails identically and the inbox can show one clear message.
 */
function resolveGraphCreds(ctx: MailProviderContext): GraphCreds {
  const clientId = (process.env.SABMAIL_MS_CLIENT_ID ?? '').trim();
  const clientSecret = (process.env.SABMAIL_MS_CLIENT_SECRET ?? '').trim();

  // Authority precedence: explicit env override → per-account tenant id →
  // the common multi-tenant endpoint.
  const tenantId = String(
    (ctx.account as Record<string, unknown>).tenantId ??
      (ctx.creds as Record<string, unknown>).tenantId ??
      '',
  ).trim();
  const authority =
    (process.env.SABMAIL_MS_AUTHORITY ?? '').trim() ||
    (tenantId ? `https://login.microsoftonline.com/${tenantId}` : DEFAULT_AUTHORITY);

  const refreshToken = String(
    (ctx.creds as Record<string, unknown>).refreshToken ?? '',
  ).trim();

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(NOT_CONNECTED);
  }
  return { clientId, clientSecret, authority, refreshToken };
}

/**
 * Acquire a Graph access token via msal's refresh-token grant. We construct a
 * fresh `ConfidentialClientApplication` per call (stateless; msal owns its own
 * in-memory token cache which we don't persist here). Any failure is surfaced
 * as the canonical NOT_CONNECTED error.
 */
async function acquireAccessToken(creds: GraphCreds): Promise<string> {
  const config: Configuration = {
    auth: {
      clientId: creds.clientId,
      clientSecret: creds.clientSecret,
      authority: creds.authority,
    },
  };
  const cca = new ConfidentialClientApplication(config);
  try {
    const result = await cca.acquireTokenByRefreshToken({
      refreshToken: creds.refreshToken,
      scopes: GRAPH_SCOPES,
    });
    const token = result?.accessToken;
    if (!token) throw new Error('no access token');
    return token;
  } catch {
    // Refresh-token expired/revoked, bad client secret, etc. — all map to the
    // single actionable "finish OAuth" message.
    throw new Error(NOT_CONNECTED);
  }
}

/**
 * Authenticated Graph request. `path` is appended to the v1.0 base. JSON bodies
 * are serialized automatically. Non-2xx responses throw with the Graph error
 * message when present. Pass `parse: false` for endpoints that return 202/204
 * with no body (move/send).
 */
async function graphFetch<T>(
  token: string,
  path: string,
  init?: { method?: string; body?: unknown; parse?: boolean },
): Promise<T> {
  const method = init?.method ?? 'GET';
  const hasBody = init?.body !== undefined;
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(hasBody ? { body: JSON.stringify(init?.body) } : {}),
  });

  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const errBody = (await res.json()) as { error?: { message?: string } };
      if (errBody?.error?.message) detail = errBody.error.message;
    } catch {
      /* non-JSON error body — keep the status line */
    }
    throw new Error(`Microsoft Graph request failed: ${detail}`);
  }

  if (init?.parse === false || res.status === 204 || res.status === 202) {
    return undefined as T;
  }
  // Some 200s (rare) have empty bodies — guard the JSON parse.
  const txt = await res.text();
  if (!txt) return undefined as T;
  try {
    return JSON.parse(txt) as T;
  } catch {
    return undefined as T;
  }
}

/** Mint a token for this context (throws NOT_CONNECTED on any gap). */
async function tokenFor(ctx: MailProviderContext): Promise<string> {
  return acquireAccessToken(resolveGraphCreds(ctx));
}

/* ── mapping helpers ─────────────────────────────────────────────────── */

function recipientName(r?: GraphRecipient): string {
  return r?.emailAddress?.name ?? '';
}
function recipientEmail(r?: GraphRecipient): string {
  return (r?.emailAddress?.address ?? '').toLowerCase();
}
function recipientDisplay(r?: GraphRecipient): string {
  const name = r?.emailAddress?.name ?? '';
  const addr = r?.emailAddress?.address ?? '';
  if (!addr && !name) return '';
  return name ? `${name} <${addr}>` : addr;
}

/**
 * The Graph message id is an opaque STRING; the inbox row/full types type `uid`
 * as `number`, but the whole stack (inbox client, dispatch wire, push-sync
 * store) only ever round-trips `uid` by value via `String(uid)` and value
 * equality — never numeric arithmetic. So we carry the real Graph id straight
 * through `uid` (the same approach the Gmail adapter uses), and `String(uid)`
 * losslessly recovers it in getMessage/setFlag/archive/trash. No synthetic hash,
 * no invisible side-channel that nothing reads.
 */
function asUid(id: string): number {
  return id as unknown as number;
}

/** Sanitize untrusted Graph HTML — mirrors the inbox `sanitizeEmailHtml`. */
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

/** Convert sanitized HTML to a rough plain-text fallback (mirrors the inbox helper). */
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

/** Build a `<addr>` recipient list for a Graph sendMail payload. */
function toGraphRecipients(addrs: string[] | undefined): GraphRecipient[] {
  return (addrs ?? [])
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      // Accept either a bare address or a `Name <addr>` display string.
      const match = entry.match(/<([^>]+)>/);
      const address = (match?.[1] ?? entry).trim();
      const name = match ? entry.replace(/<[^>]+>/, '').replace(/"/g, '').trim() : '';
      return { emailAddress: { address, ...(name ? { name } : {}) } };
    })
    .filter((r) => !!r.emailAddress.address);
}

/* ── adapter implementation ──────────────────────────────────────────── */

async function listFolders(
  ctx: MailProviderContext,
): Promise<SabmailFolderRow[]> {
  const token = await tokenFor(ctx);
  const data = await graphFetch<GraphCollection<GraphMailFolder>>(
    token,
    `/me/mailFolders?$top=100&$select=id,displayName,wellKnownName`,
  );
  return (data?.value ?? []).map((f) => ({
    // `path` is the adapter-understood folder id (Graph folder id), mirroring
    // how the IMAP adapter uses the IMAP path as `path`.
    path: f.id ?? '',
    name: f.displayName ?? f.wellKnownName ?? f.id ?? '',
    // Graph exposes `wellKnownName` (e.g. inbox/sentitems/archive) — surface it
    // through the existing `specialUse` slot the inbox already renders.
    specialUse: f.wellKnownName ?? null,
    subscribed: true,
  }));
}

async function listMessages(
  ctx: MailProviderContext,
  folder: string,
  page: number,
  pageSize: number,
): Promise<{ messages: SabmailMessageRow[]; total: number }> {
  const token = await tokenFor(ctx);
  const folderId = folder || 'inbox';
  const top = Math.max(1, pageSize);
  const skip = Math.max(0, page) * top;

  const data = await graphFetch<GraphCollection<GraphMessage>>(
    token,
    `/me/mailFolders/${encodeURIComponent(folderId)}/messages` +
      `?$top=${top}&$skip=${skip}` +
      `&$count=true&$orderby=receivedDateTime%20desc` +
      `&$select=${encodeURIComponent(LIST_SELECT)}`,
  );

  const messages: SabmailMessageRow[] = (data?.value ?? []).map((m) => {
    const id = m.id ?? '';
    const fromRecip = m.from ?? m.sender;
    const date = m.receivedDateTime ?? m.sentDateTime ?? null;
    return {
      uid: asUid(id), // real opaque Graph id, round-trips via String(uid)
      subject: m.subject || '(no subject)',
      fromName: recipientName(fromRecip),
      fromEmail: recipientEmail(fromRecip),
      date: date ? new Date(date).toISOString() : null,
      seen: !!m.isRead,
      flagged: (m.flag?.flagStatus ?? '').toLowerCase() === 'flagged',
      hasAttachments: !!m.hasAttachments,
      messageId: m.internetMessageId ?? null,
      // Graph does not return In-Reply-To on the envelope $select; null here.
      inReplyTo: null,
      screenerDecision: null,
    } satisfies SabmailMessageRow;
  });

  const total = typeof data?.['@odata.count'] === 'number'
    ? (data['@odata.count'] as number)
    : skip + messages.length;

  return { messages, total };
}

async function getMessage(
  ctx: MailProviderContext,
  _folder: string,
  id: string,
  opts?: { showRemoteImages?: boolean; markSeen?: boolean },
): Promise<SabmailMessageFull> {
  const token = await tokenFor(ctx);
  const showRemoteImages = !!opts?.showRemoteImages;
  const markSeen = opts?.markSeen !== false;

  const m = await graphFetch<GraphMessage>(
    token,
    `/me/messages/${encodeURIComponent(id)}` +
      `?$select=id,subject,from,sender,toRecipients,ccRecipients,isRead,flag,` +
      `hasAttachments,receivedDateTime,sentDateTime,internetMessageId,body,` +
      `internetMessageHeaders`,
  );
  if (!m) throw new Error('Message not found.');

  // Derive the References / In-Reply-To chain so replies thread correctly
  // (Graph only returns these under internetMessageHeaders, not the envelope).
  const headers = (m as { internetMessageHeaders?: Array<{ name?: string; value?: string }> })
    .internetMessageHeaders ?? [];
  const headerVal = (name: string): string =>
    headers.find((h) => (h.name ?? '').toLowerCase() === name.toLowerCase())?.value ?? '';
  const references = `${headerVal('References')} ${headerVal('In-Reply-To')}`
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => s.startsWith('<'));

  // Attachment metadata (no content bytes — mirrors the inbox full shape).
  let attachments: SabmailMessageFull['attachments'] = [];
  if (m.hasAttachments) {
    try {
      const att = await graphFetch<GraphCollection<GraphAttachment>>(
        token,
        `/me/messages/${encodeURIComponent(id)}/attachments?$select=name,contentType,size`,
      );
      attachments = (att?.value ?? []).map((a) => ({
        filename: a.name ?? 'attachment',
        contentType: a.contentType ?? 'application/octet-stream',
        size: a.size ?? 0,
      }));
    } catch {
      /* attachment listing is best-effort — keep the body */
    }
  }

  // Mark read (best-effort) when requested and not already seen.
  if (markSeen && !m.isRead) {
    try {
      await graphFetch<void>(token, `/me/messages/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: { isRead: true },
        parse: false,
      });
    } catch {
      /* perms / transient — non-fatal, same as IMAP read-only handling */
    }
  }

  const rawContentType = (m.body?.contentType ?? '').toLowerCase();
  const rawContent = m.body?.content ?? '';
  let html: string | null = null;
  let text: string | null = null;
  if (rawContentType === 'html' && rawContent) {
    html = await sanitizeEmailHtml(rawContent, showRemoteImages);
    text = htmlToPlain(html);
  } else if (rawContent) {
    text = rawContent;
  }

  const date = m.receivedDateTime ?? m.sentDateTime ?? null;
  const fromRecip = m.from ?? m.sender;

  return {
    uid: asUid(id), // real opaque Graph id, round-trips via String(uid)
    subject: m.subject || '(no subject)',
    from: { name: recipientName(fromRecip), email: recipientEmail(fromRecip) },
    to: (m.toRecipients ?? []).map(recipientDisplay).filter(Boolean),
    cc: (m.ccRecipients ?? []).map(recipientDisplay).filter(Boolean),
    date: date ? new Date(date).toISOString() : null,
    html,
    text,
    attachments,
    hadRemoteImages: html ? html.includes('data-sabmail-blocked') : false,
    messageId: m.internetMessageId ?? null,
    references,
  } satisfies SabmailMessageFull;
}

async function setFlag(
  ctx: MailProviderContext,
  _folder: string,
  id: string,
  flag: 'seen' | 'flagged',
  value: boolean,
): Promise<void> {
  const token = await tokenFor(ctx);
  const body =
    flag === 'seen'
      ? { isRead: value }
      : { flag: { flagStatus: value ? 'flagged' : 'notFlagged' } };
  await graphFetch<void>(token, `/me/messages/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body,
    parse: false,
  });
}

async function move(
  ctx: MailProviderContext,
  id: string,
  destinationId: string,
): Promise<void> {
  const token = await tokenFor(ctx);
  await graphFetch<void>(token, `/me/messages/${encodeURIComponent(id)}/move`, {
    method: 'POST',
    body: { destinationId },
    parse: false,
  });
}

async function archive(
  ctx: MailProviderContext,
  _folder: string,
  id: string,
): Promise<void> {
  // 'archive' is a Graph well-known folder name.
  await move(ctx, id, 'archive');
}

async function trash(
  ctx: MailProviderContext,
  _folder: string,
  id: string,
): Promise<void> {
  // 'deleteditems' is the Graph well-known Trash folder name.
  await move(ctx, id, 'deleteditems');
}

async function send(
  ctx: MailProviderContext,
  input: SabmailSendInput,
): Promise<{ messageId: string }> {
  const token = await tokenFor(ctx);

  const toRecipients = toGraphRecipients(input.to);
  if (toRecipients.length === 0) {
    throw new Error('Add at least one recipient.');
  }

  const subject = input.subject?.trim() || '(no subject)';
  const html = input.html?.trim();
  const text = input.text?.trim();

  const body = html
    ? { contentType: 'HTML', content: html }
    : { contentType: 'Text', content: text || ' ' };

  // Bulk-mail provenance headers (campaign sends only): one-click
  // List-Unsubscribe (RFC 8058) + a Feedback-ID for Postmaster correlation.
  // Graph carries custom headers via `internetMessageHeaders` (names MUST start
  // with `x-` OR be a registered header like List-Unsubscribe). Absent on 1:1
  // replies so transactional mail stays header-clean.
  const internetMessageHeaders: Array<{ name: string; value: string }> = [];
  if (input.unsubscribe?.email) {
    const appBaseUrl = (
      process.env.SABMAIL_APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      ''
    ).trim();
    if (appBaseUrl) {
      const accountEmail = String(
        (ctx.account as Record<string, unknown>).email ?? '',
      );
      // Use the SAME signed-token helper the SMTP/IMAP path uses, so the header
      // points at the real /api/sabmail/unsubscribe/[token] route (RFC 8058
      // one-click). A query-string URL would 404 — that route only reads a
      // signed token path segment.
      const token = makeUnsubscribeToken(
        ctx.workspaceId,
        input.unsubscribe.email,
        input.unsubscribe.campaignId,
      );
      const headerMap = buildUnsubscribeHeaders(appBaseUrl, token, accountEmail);
      for (const [name, value] of Object.entries(headerMap)) {
        internetMessageHeaders.push({ name, value });
      }
    }
    internetMessageHeaders.push({
      name: 'Feedback-ID',
      value: `${input.unsubscribe.campaignId ?? 'tx'}:${ctx.workspaceId}:sabmail`,
    });
  }

  const message: Record<string, unknown> = {
    subject,
    body,
    toRecipients,
    ...(input.cc && input.cc.length
      ? { ccRecipients: toGraphRecipients(input.cc) }
      : {}),
    ...(input.bcc && input.bcc.length
      ? { bccRecipients: toGraphRecipients(input.bcc) }
      : {}),
    ...(internetMessageHeaders.length ? { internetMessageHeaders } : {}),
  };

  try {
    await graphFetch<void>(token, `/me/sendMail`, {
      method: 'POST',
      body: { message, saveToSentItems: true },
      parse: false,
    });
  } catch (e) {
    throw new Error(`Send failed: ${getErrorMessage(e)}`);
  }

  // Graph's sendMail returns 202 Accepted with no body and no Message-ID. The
  // RFC Message-ID is assigned by Exchange asynchronously, so we cannot read it
  // back here; return an empty string (the inbox treats messageId as optional
  // provenance, same as a missing nodemailer messageId on the IMAP path).
  return { messageId: '' };
}

/**
 * The Microsoft Graph adapter. Exported as the documented `provider` named
 * export so `getMailProvider` (registry convention: `./<id>` →
 * `mod.provider`) picks it up for `account.provider === 'outlook'`
 * (`adapterIdForProvider` → 'graph').
 */
export const provider: MailProvider = {
  id: 'graph',
  listFolders,
  listMessages,
  getMessage,
  setFlag,
  archive,
  trash,
  send,
};

export default provider;
