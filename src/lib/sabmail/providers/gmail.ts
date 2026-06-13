import 'server-only';

import { google, type gmail_v1 } from 'googleapis';

import type {
  SabmailFolderRow,
  SabmailMessageRow,
  SabmailMessageFull,
  SabmailAttachmentMeta,
  SabmailSendInput,
} from '@/app/sabmail/inbox/actions';

import type { MailProvider, MailProviderContext } from './types';

/* ──────────────────────────────────────────────────────────────────────
 * SabMail Gmail adapter — Phase B.
 *
 * The Gmail-API implementation of the transport-agnostic `MailProvider`
 * contract (see `./types.ts`). It produces the EXACT `Sabmail*` row/full/send
 * shapes the inbox surface already consumes, so dispatching a Gmail account
 * through `getMailProvider(account)` is drop-in with the IMAP path.
 *
 * Auth: an OAuth2 client built from `SABMAIL_GMAIL_CLIENT_ID` +
 * `SABMAIL_GMAIL_CLIENT_SECRET` + the account's stored refresh token (decrypted
 * into `ctx.creds.refreshToken`, with a fallback to an `oauth` field on the
 * account doc). `google-auth-library` auto-refreshes the access token from the
 * refresh token, so no access-token persistence is needed here. If any of the
 * three are missing every method throws a single, clear error so the dispatch
 * layer can surface "finish OAuth to enable Gmail sync".
 *
 * Identifier mapping (per the contract):
 *   - `folder` is a Gmail LABEL id (e.g. `INBOX`, `STARRED`, or a user label id).
 *   - message `id` is the opaque Gmail message id STRING.
 *   - `seen`   = NOT carrying the `UNREAD` label.
 *   - `flagged` = carrying the `STARRED` label.
 *
 * This module COMPILES and is importable without live credentials — the env +
 * refresh-token check is RUNTIME-gated (each operation funnels through
 * `gmailClient(ctx)`), so the adapter registry can lazy-import it freely.
 * ──────────────────────────────────────────────────────────────────── */

const OAUTH_ERROR =
  'Gmail account is not OAuth-connected — finish OAuth to enable Gmail sync';

/**
 * Build an authed Gmail API client for the account, or throw `OAUTH_ERROR`.
 *
 * Reads the refresh token from the decrypted creds blob
 * (`ctx.creds.refreshToken`), falling back to an `oauth` field on the account
 * document (`account.oauth.refreshToken` / `account.oauth.refresh_token`). The
 * OAuth2 client carries only the refresh token; google-auth-library mints a
 * fresh access token on demand.
 */
function gmailClient(ctx: MailProviderContext): gmail_v1.Gmail {
  const clientId = (process.env.SABMAIL_GMAIL_CLIENT_ID ?? '').trim();
  const clientSecret = (process.env.SABMAIL_GMAIL_CLIENT_SECRET ?? '').trim();

  const refreshToken = resolveRefreshToken(ctx);

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(OAUTH_ERROR);
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
  oauth2.setCredentials({ refresh_token: refreshToken });

  return google.gmail({ version: 'v1', auth: oauth2 });
}

/** Pull the refresh token from creds, then from an `oauth` field on the account. */
function resolveRefreshToken(ctx: MailProviderContext): string {
  const fromCreds =
    str(ctx.creds?.refreshToken) ||
    str((ctx.creds as Record<string, unknown>)?.refresh_token);
  if (fromCreds) return fromCreds;

  const oauth = (ctx.account as Record<string, unknown>)?.oauth as
    | Record<string, unknown>
    | undefined;
  if (oauth) {
    const fromAccount = str(oauth.refreshToken) || str(oauth.refresh_token);
    if (fromAccount) return fromAccount;
  }
  return '';
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/* ── header helpers ──────────────────────────────────────────────────── */

/** Case-insensitive header lookup over a Gmail payload's header list. */
function header(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  name: string,
): string {
  if (!Array.isArray(headers)) return '';
  const lower = name.toLowerCase();
  const found = headers.find((h) => (h.name ?? '').toLowerCase() === lower);
  return found?.value ?? '';
}

/** Parse a `Name <addr@host>` (or bare `addr@host`) into name + lowercased email. */
function parseAddress(raw: string): { name: string; email: string } {
  const value = (raw ?? '').trim();
  if (!value) return { name: '', email: '' };
  const angled = value.match(/^(.*)<([^>]+)>\s*$/);
  if (angled) {
    const name = angled[1].trim().replace(/^"(.*)"$/, '$1').trim();
    return { name, email: angled[2].trim().toLowerCase() };
  }
  return { name: '', email: value.toLowerCase() };
}

/** Split an address-list header into display strings (Name <addr> or bare addr). */
function splitAddressList(raw: string): string[] {
  const value = (raw ?? '').trim();
  if (!value) return [];
  // Split on commas that are not inside quotes or angle brackets.
  return value
    .split(/,(?![^<]*>)(?=(?:[^"]*"[^"]*")*[^"]*$)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Gmail's internal/header date → ISO string, or null when unparseable. */
function toIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function hasLabel(msg: gmail_v1.Schema$Message, label: string): boolean {
  return Array.isArray(msg.labelIds) && msg.labelIds.includes(label);
}

/* ── body + attachment walking ───────────────────────────────────────── */

interface WalkedBody {
  html: string | null;
  text: string | null;
  attachments: SabmailAttachmentMeta[];
}

/** base64url → UTF-8 string (Gmail part bodies are base64url-encoded). */
function decodeBody(data: string | null | undefined): string {
  if (!data) return '';
  try {
    return Buffer.from(data, 'base64url').toString('utf8');
  } catch {
    return '';
  }
}

/**
 * Walk a Gmail message payload, collecting the first html + text bodies and
 * attachment metadata (no content bytes). Recurses through multipart parts.
 */
function walkPayload(payload: gmail_v1.Schema$MessagePart | undefined): WalkedBody {
  const out: WalkedBody = { html: null, text: null, attachments: [] };
  if (!payload) return out;

  const visit = (part: gmail_v1.Schema$MessagePart): void => {
    const mime = (part.mimeType ?? '').toLowerCase();
    const filename = part.filename ?? '';
    const bodyData = part.body?.data;

    // An attachment has a filename (and usually an attachmentId, no inline data).
    if (filename) {
      out.attachments.push({
        filename,
        contentType: mime || 'application/octet-stream',
        size: typeof part.body?.size === 'number' ? part.body.size : 0,
      });
    } else if (mime === 'text/html' && out.html === null && bodyData) {
      out.html = decodeBody(bodyData);
    } else if (mime === 'text/plain' && out.text === null && bodyData) {
      out.text = decodeBody(bodyData);
    }

    if (Array.isArray(part.parts)) {
      for (const child of part.parts) visit(child);
    }
  };

  visit(payload);
  return out;
}

/**
 * Sanitize untrusted email HTML server-side; block remote images unless asked.
 * Replicates the inbox action's sanitize options + remote-image block so the
 * Gmail body renders identically to an IMAP-fetched body.
 */
async function sanitizeEmailHtml(
  html: string,
  showRemoteImages: boolean,
): Promise<string> {
  // sanitize-html's callable + `.defaults` namespace don't line up under strict
  // typing; the inbox action uses the same `any` shim — match it exactly.
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

/* ── label → folder mapping ──────────────────────────────────────────── */

/** Best-effort RFC 6154-style special-use tag for a Gmail label. */
function labelSpecialUse(label: gmail_v1.Schema$Label): string | null {
  const id = (label.id ?? '').toUpperCase();
  switch (id) {
    case 'INBOX':
      return '\\Inbox';
    case 'SENT':
      return '\\Sent';
    case 'DRAFT':
      return '\\Drafts';
    case 'TRASH':
      return '\\Trash';
    case 'SPAM':
      return '\\Junk';
    case 'STARRED':
      return '\\Flagged';
    default:
      return null;
  }
}

/* ── send: RFC822 builder ────────────────────────────────────────────── */

/** Fold header values defensively (Gmail accepts long lines, but keep clean). */
function headerLine(name: string, value: string): string {
  return `${name}: ${value}`;
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

/**
 * Build a minimal RFC 5322 message (multipart/alternative when both html+text
 * exist) and return it base64url-encoded for `users.messages.send`.
 */
async function buildRawMessage(
  from: string,
  input: SabmailSendInput,
  extraHeaders: Record<string, string>,
): Promise<string> {
  const to = (input.to ?? []).map((s) => s.trim()).filter(Boolean);
  const cc = (input.cc ?? []).map((s) => s.trim()).filter(Boolean);
  const bcc = (input.bcc ?? []).map((s) => s.trim()).filter(Boolean);
  const subject = input.subject?.trim() || '(no subject)';
  const html = input.html?.trim() || '';
  const text = input.text?.trim() || (html ? htmlToPlain(html) : '');

  const headers: string[] = [
    headerLine('From', from),
    headerLine('To', to.join(', ')),
  ];
  if (cc.length) headers.push(headerLine('Cc', cc.join(', ')));
  if (bcc.length) headers.push(headerLine('Bcc', bcc.join(', ')));
  headers.push(headerLine('Subject', subject));
  headers.push(headerLine('MIME-Version', '1.0'));
  if (input.inReplyTo) headers.push(headerLine('In-Reply-To', input.inReplyTo));
  if (input.references && input.references.length) {
    headers.push(headerLine('References', input.references.join(' ')));
  }
  for (const [name, value] of Object.entries(extraHeaders)) {
    if (value) headers.push(headerLine(name, value));
  }

  const uniq = () =>
    `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;

  // The message body as a self-contained MIME part: `partHeaders` are the
  // Content-Type/-Transfer-Encoding lines, `content` is the payload. Used
  // inline when there are no attachments, or as the first part of a
  // multipart/mixed envelope when there are.
  let partHeaders: string;
  let content: string;
  if (html && text) {
    const alt = `=_sabmail_alt_${uniq()}`;
    partHeaders = `Content-Type: multipart/alternative; boundary="${alt}"`;
    content =
      `--${alt}\r\n` +
      `Content-Type: text/plain; charset="UTF-8"\r\n` +
      `Content-Transfer-Encoding: 8bit\r\n\r\n` +
      `${text}\r\n\r\n` +
      `--${alt}\r\n` +
      `Content-Type: text/html; charset="UTF-8"\r\n` +
      `Content-Transfer-Encoding: 8bit\r\n\r\n` +
      `${html}\r\n\r\n` +
      `--${alt}--`;
  } else if (html) {
    partHeaders = 'Content-Type: text/html; charset="UTF-8"\r\nContent-Transfer-Encoding: 8bit';
    content = html;
  } else {
    partHeaders = 'Content-Type: text/plain; charset="UTF-8"\r\nContent-Transfer-Encoding: 8bit';
    content = text || ' ';
  }

  // Fetch attachments (from SabFiles URLs) into base64 MIME parts. Best-effort:
  // a fetch failure skips that one attachment rather than failing the send.
  const attInputs = (input.attachments ?? []).filter((a) => a.url);
  const attParts: string[] = [];
  for (const a of attInputs) {
    try {
      const res = await fetch(a.url);
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      const ct = res.headers.get('content-type') || 'application/octet-stream';
      const name = (a.filename || 'attachment').replace(/"/g, '');
      const b64 = buf.toString('base64').replace(/(.{76})/g, '$1\r\n');
      attParts.push(
        `Content-Type: ${ct}; name="${name}"\r\n` +
          `Content-Transfer-Encoding: base64\r\n` +
          `Content-Disposition: attachment; filename="${name}"\r\n\r\n` +
          b64,
      );
    } catch {
      /* skip a single failed attachment — never fail the whole send */
    }
  }

  let raw: string;
  if (attParts.length === 0) {
    // No attachments → inline the body part's headers into the top headers.
    headers.push(...partHeaders.split('\r\n'));
    raw = `${headers.join('\r\n')}\r\n\r\n${content}`;
  } else {
    const mixed = `=_sabmail_mixed_${uniq()}`;
    headers.push(headerLine('Content-Type', `multipart/mixed; boundary="${mixed}"`));
    const blocks = [`${partHeaders}\r\n\r\n${content}`, ...attParts];
    const body =
      blocks.map((b) => `--${mixed}\r\n${b}`).join('\r\n') + `\r\n--${mixed}--`;
    raw = `${headers.join('\r\n')}\r\n\r\n${body}`;
  }
  return Buffer.from(raw, 'utf8').toString('base64url');
}

/* ── the adapter ─────────────────────────────────────────────────────── */

export const provider: MailProvider = {
  id: 'gmail',

  async listFolders(ctx: MailProviderContext): Promise<SabmailFolderRow[]> {
    const gmail = gmailClient(ctx);
    const res = await gmail.users.labels.list({ userId: 'me' });
    const labels = res.data.labels ?? [];
    return labels.map((label) => ({
      // The label id is the portable "path" the adapter understands.
      path: label.id ?? '',
      name: label.name ?? label.id ?? '',
      specialUse: labelSpecialUse(label),
      // Gmail labels have no IMAP "subscribed" concept — always shown.
      subscribed: true,
    }));
  },

  async listMessages(
    ctx: MailProviderContext,
    folder: string,
    page: number,
    pageSize: number,
  ): Promise<{ messages: SabmailMessageRow[]; total: number }> {
    const gmail = gmailClient(ctx);
    const labelIds = folder ? [folder] : ['INBOX'];
    const maxResults = Math.max(1, Math.min(pageSize || 30, 100));

    // Best-effort paging: Gmail's list API is cursor (pageToken) based, not
    // index based. Walk forward `page` times to reach the requested page's
    // token, then fetch that page. (Phase B keeps this simple; the real sync
    // engine caches tokens.)
    let pageToken: string | undefined;
    for (let i = 0; i < (page || 0); i += 1) {
      const hop = await gmail.users.messages.list({
        userId: 'me',
        labelIds,
        maxResults,
        pageToken,
      });
      pageToken = hop.data.nextPageToken ?? undefined;
      // No further pages — return empty for an out-of-range page request.
      if (!pageToken) {
        return {
          messages: [],
          total: hop.data.resultSizeEstimate ?? 0,
        };
      }
    }

    const listRes = await gmail.users.messages.list({
      userId: 'me',
      labelIds,
      maxResults,
      pageToken,
    });
    const ids = (listRes.data.messages ?? [])
      .map((m) => m.id)
      .filter((id): id is string => !!id);
    const total = listRes.data.resultSizeEstimate ?? ids.length;

    // Metadata fetch per id (Gmail has no envelope batch over the JS client).
    const rows = await Promise.all(
      ids.map(async (id): Promise<SabmailMessageRow | null> => {
        try {
          const res = await gmail.users.messages.get({
            userId: 'me',
            id,
            format: 'metadata',
            metadataHeaders: ['From', 'Subject', 'Date', 'Message-ID', 'In-Reply-To'],
          });
          const msg = res.data;
          const headers = msg.payload?.headers;
          const from = parseAddress(header(headers, 'From'));
          return {
            // Gmail message id (string) is the portable id — see contract note.
            uid: id as unknown as number,
            subject: header(headers, 'Subject') || '(no subject)',
            fromName: from.name,
            fromEmail: from.email,
            date:
              toIso(header(headers, 'Date')) ??
              (msg.internalDate
                ? new Date(Number(msg.internalDate)).toISOString()
                : null),
            seen: !hasLabel(msg, 'UNREAD'),
            flagged: hasLabel(msg, 'STARRED'),
            hasAttachments: messageHasAttachments(msg.payload),
            messageId: header(headers, 'Message-ID') || null,
            inReplyTo: header(headers, 'In-Reply-To') || null,
            screenerDecision: null,
          };
        } catch {
          return null;
        }
      }),
    );

    return {
      messages: rows.filter((r): r is SabmailMessageRow => r !== null),
      total,
    };
  },

  async getMessage(
    ctx: MailProviderContext,
    folder: string,
    id: string,
    opts?: { showRemoteImages?: boolean; markSeen?: boolean },
  ): Promise<SabmailMessageFull> {
    const gmail = gmailClient(ctx);
    const showRemoteImages = !!opts?.showRemoteImages;
    const markSeen = opts?.markSeen !== false;

    const res = await gmail.users.messages.get({
      userId: 'me',
      id,
      format: 'full',
    });
    const msg = res.data;
    const headers = msg.payload?.headers;
    const walked = walkPayload(msg.payload);

    const html = walked.html
      ? await sanitizeEmailHtml(walked.html, showRemoteImages)
      : null;

    if (markSeen && hasLabel(msg, 'UNREAD')) {
      try {
        await gmail.users.messages.modify({
          userId: 'me',
          id,
          requestBody: { removeLabelIds: ['UNREAD'] },
        });
      } catch {
        /* perms / already-read — non-fatal */
      }
    }

    const referencesRaw = header(headers, 'References');
    const references = referencesRaw
      ? referencesRaw.split(/\s+/).filter(Boolean)
      : [];

    return {
      // The inbox `uid` field carries the Gmail id string for Gmail accounts.
      uid: id as unknown as number,
      subject: header(headers, 'Subject') || '(no subject)',
      from: parseAddress(header(headers, 'From')),
      to: splitAddressList(header(headers, 'To')),
      cc: splitAddressList(header(headers, 'Cc')),
      date:
        toIso(header(headers, 'Date')) ??
        (msg.internalDate
          ? new Date(Number(msg.internalDate)).toISOString()
          : null),
      html,
      text: walked.text,
      attachments: walked.attachments,
      hadRemoteImages: html ? html.includes('data-sabmail-blocked') : false,
      messageId: header(headers, 'Message-ID') || null,
      references,
    };
  },

  async setFlag(
    ctx: MailProviderContext,
    _folder: string,
    id: string,
    flag: 'seen' | 'flagged',
    value: boolean,
  ): Promise<void> {
    const gmail = gmailClient(ctx);
    // seen maps to the ABSENCE of UNREAD; flagged maps to the STARRED label.
    const label = flag === 'seen' ? 'UNREAD' : 'STARRED';
    // seen=true  → remove UNREAD; seen=false → add UNREAD.
    // flagged=true → add STARRED; flagged=false → remove STARRED.
    const addLabel = flag === 'seen' ? !value : value;
    await gmail.users.messages.modify({
      userId: 'me',
      id,
      requestBody: addLabel
        ? { addLabelIds: [label] }
        : { removeLabelIds: [label] },
    });
  },

  async archive(
    ctx: MailProviderContext,
    _folder: string,
    id: string,
  ): Promise<void> {
    const gmail = gmailClient(ctx);
    // Gmail "archive" = drop the INBOX label (the message stays in All Mail).
    await gmail.users.messages.modify({
      userId: 'me',
      id,
      requestBody: { removeLabelIds: ['INBOX'] },
    });
  },

  async trash(
    ctx: MailProviderContext,
    _folder: string,
    id: string,
  ): Promise<void> {
    const gmail = gmailClient(ctx);
    await gmail.users.messages.trash({ userId: 'me', id });
  },

  async send(
    ctx: MailProviderContext,
    input: SabmailSendInput,
  ): Promise<{ messageId: string }> {
    const gmail = gmailClient(ctx);

    // From identity: prefer the account's display name + address.
    const account = ctx.account;
    const from = account.displayName
      ? `"${String(account.displayName).replace(/"/g, '')}" <${account.email}>`
      : account.email;

    // Bulk-mail headers (campaign sends only): one-click List-Unsubscribe
    // (RFC 8058) + a Feedback-ID for Postmaster correlation — only when the
    // caller marks this send as bulk via `input.unsubscribe`.
    const extraHeaders: Record<string, string> = {};
    if (input.unsubscribe?.email) {
      const { makeUnsubscribeToken, buildUnsubscribeHeaders } = await import(
        '@/lib/sabmail/unsubscribe'
      );
      const appBaseUrl = (
        process.env.SABMAIL_APP_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        ''
      ).trim();
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
        console.warn(
          '[sabmail/gmail] bulk send missing SABMAIL_APP_URL/NEXT_PUBLIC_APP_URL — List-Unsubscribe header omitted',
        );
      }
      extraHeaders['Feedback-ID'] =
        `${input.unsubscribe.campaignId ?? 'tx'}:${ctx.workspaceId}:sabmail`;
    }

    const raw = await buildRawMessage(from, input, extraHeaders);
    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    });

    // Gmail returns the new message id; the RFC Message-ID is not echoed by the
    // send call, so fall back to the Gmail id (still a stable handle).
    return { messageId: res.data.id ?? '' };
  },
};

/** True when the Gmail payload tree carries any named (attachment) part. */
function messageHasAttachments(
  payload: gmail_v1.Schema$MessagePart | undefined,
): boolean {
  if (!payload) return false;
  if (payload.filename) return true;
  if (Array.isArray(payload.parts)) {
    return payload.parts.some((p) => messageHasAttachments(p));
  }
  return false;
}
