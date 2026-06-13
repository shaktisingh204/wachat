import 'server-only';

import { decryptMailboxCreds } from '@/lib/sabmail/credentials';
import type { SabmailAccount } from '@/lib/sabmail/types';

// Row/full/send shapes are imported TYPE-ONLY from the inbox action module so a
// provider's output is drop-in for the existing inbox surface (no shape drift).
import type {
  SabmailFolderRow,
  SabmailMessageRow,
  SabmailMessageFull,
  SabmailSendInput,
} from '@/app/sabmail/inbox/actions';

/* ──────────────────────────────────────────────────────────────────────
 * SabMail provider abstraction — the FOUNDATION (Phase B).
 *
 * One transport-agnostic interface every mailbox adapter implements (IMAP
 * today; Gmail API + Microsoft Graph next). The inbox actions currently talk
 * IMAP inline; once this layer lands, the same actions dispatch through
 * `getMailProvider(account)` and the adapter does the transport work. Because
 * the operations return the EXACT `Sabmail*` row/full/send shapes the inbox UI
 * already consumes, the dispatch swap is non-breaking.
 *
 * Contract notes (read before implementing an adapter):
 *   - `MailProvider.id` is the transport family: 'imap' | 'gmail' | 'graph'.
 *     The account's `provider` field is the broader connection kind
 *     ('imap' | 'gmail' | 'outlook' | 'hosted'); the registry maps
 *     account.provider → adapter id (outlook/hosted → 'graph'/'imap').
 *   - `id` (message id) is a STRING in this interface even though the inbox
 *     row/full types and `getSabmailMessage` use a numeric `uid`. For IMAP the
 *     id IS the UID rendered as a string — the adapter is responsible for
 *     `Number(id)` parsing. Gmail/Graph use opaque string ids natively, so a
 *     string id is the only portable choice across transports.
 *   - `folder` is the IMAP mailbox path for IMAP; for Gmail/Graph it is the
 *     label/folder id the adapter understands.
 *   - Every method may throw; callers wrap with their own try/catch + the
 *     `{ ok, error }` result envelope the inbox actions use.
 * ──────────────────────────────────────────────────────────────────── */

/** The transport family an adapter implements. */
export type MailProviderId = 'imap' | 'gmail' | 'graph';

/**
 * Everything a provider call needs: tenant + account identity, the loaded
 * account document, and the ALREADY-DECRYPTED credentials blob. `creds` is the
 * plaintext object returned by `decryptMailboxCreds` (e.g.
 * `{ imapUser, imapPass, smtpUser, smtpPass }` for IMAP or `{ refreshToken }`
 * for OAuth) — adapters read only the keys they need and never re-decrypt.
 */
export interface MailProviderContext {
  /** The `kind:'mail'` project `_id` string every SabMail collection scopes by. */
  workspaceId: string;
  /** The mailbox account `_id` as a string. */
  accountId: string;
  /** The loaded account document (open shape — adapters read provider-specific fields). */
  account: SabmailAccount & Record<string, unknown>;
  /** Already-decrypted credential blob (plaintext); never the cipher string. */
  creds: Record<string, unknown>;
}

/**
 * The transport-agnostic mailbox contract. Each adapter exports an
 * implementation as a NAMED `provider` export (see `getMailProvider`'s
 * convention), and every operation returns the existing inbox `Sabmail*`
 * shapes so dispatch is drop-in.
 */
export interface MailProvider {
  /** Transport family — must match the adapter module it is exported from. */
  id: MailProviderId;

  /** List the mailbox's folders/labels. */
  listFolders(ctx: MailProviderContext): Promise<SabmailFolderRow[]>;

  /**
   * List a page of messages in `folder`, newest-first. `page` is 0-based;
   * `pageSize` bounds the page. Returns the rows plus the folder `total`.
   */
  listMessages(
    ctx: MailProviderContext,
    folder: string,
    page: number,
    pageSize: number,
  ): Promise<{ messages: SabmailMessageRow[]; total: number }>;

  /**
   * Fetch one full message. `id` is the provider message id as a string — for
   * IMAP this is the UID string (the adapter calls `Number(id)`). `markSeen`
   * defaults to true at the action layer; `showRemoteImages` defaults to false.
   */
  getMessage(
    ctx: MailProviderContext,
    folder: string,
    id: string,
    opts?: { showRemoteImages?: boolean; markSeen?: boolean },
  ): Promise<SabmailMessageFull>;

  /** Add/remove a `seen` or `flagged` flag on one message. */
  setFlag(
    ctx: MailProviderContext,
    folder: string,
    id: string,
    flag: 'seen' | 'flagged',
    value: boolean,
  ): Promise<void>;

  /** Move one message to the mailbox's Archive/All-Mail location. */
  archive(ctx: MailProviderContext, folder: string, id: string): Promise<void>;

  /** Move one message to the mailbox's Trash/Deleted location. */
  trash(ctx: MailProviderContext, folder: string, id: string): Promise<void>;

  /** Send a message; returns the issued RFC Message-ID. */
  send(
    ctx: MailProviderContext,
    input: SabmailSendInput,
  ): Promise<{ messageId: string }>;
}

/**
 * Map a stored account `provider` to a transport adapter id. The account model
 * carries a broader set ('imap' | 'gmail' | 'outlook' | 'hosted') than the
 * adapter families ('imap' | 'gmail' | 'graph'):
 *   - 'gmail'  → 'gmail' (Gmail API)
 *   - 'outlook'→ 'graph' (Microsoft Graph)
 *   - 'imap'   → 'imap'
 *   - 'hosted' → 'imap'  (hosted mailboxes speak IMAP/SMTP)
 * Returns `null` for anything unrecognized.
 */
export function adapterIdForProvider(
  provider: SabmailAccount['provider'] | string | undefined,
): MailProviderId | null {
  switch (provider) {
    case 'gmail':
      return 'gmail';
    case 'outlook':
      return 'graph';
    case 'imap':
    case 'hosted':
      return 'imap';
    default:
      return null;
  }
}

/**
 * Lazily resolve the adapter for an account.
 *
 * Registry convention: each adapter module under `./` exports its
 * implementation as a NAMED `provider: MailProvider` export
 * (`export const provider: MailProvider = { ... }`). We dynamic-import by the
 * mapped transport id so unused transports (and their heavy SDKs) never load:
 *   'imap'  → './imap'
 *   'gmail' → './gmail'
 *   'graph' → './graph'
 *
 * Returns `null` for an unknown provider OR when the adapter module is not yet
 * present / does not export a valid `provider` (defensive: the IMAP adapter is
 * the only one that exists at the start of Phase B).
 */
export async function getMailProvider(
  account: SabmailAccount,
): Promise<MailProvider | null> {
  const id = adapterIdForProvider(account?.provider);
  if (!id) return null;

  let mod: Record<string, unknown> | null = null;
  try {
    // Explicit, statically-analyzable specifiers (NOT a computed `./${id}`):
    // bundlers (Next/webpack/turbopack) need real literals to resolve + code-
    // split each transport's SDK; a computed template would force-bundle every
    // sibling or fail to resolve in the server bundle. The id enum is closed,
    // so this switch is exhaustive; each transport still lazy-loads on demand.
    mod = (await (id === 'gmail'
      ? import('./gmail')
      : id === 'graph'
        ? import('./graph')
        : import('./imap'))) as Record<string, unknown>;
  } catch {
    // Adapter module not yet implemented / failed to load — degrade to null so
    // callers surface a clean "provider not supported yet" error, not a crash.
    return null;
  }

  // Accept the documented `provider` named export, falling back to a default
  // export shaped like a MailProvider (so adapters may pick either convention).
  const candidate =
    (mod?.provider as MailProvider | undefined) ??
    (mod?.default as MailProvider | undefined);

  if (!candidate || typeof candidate !== 'object') return null;
  if (typeof (candidate as MailProvider).listFolders !== 'function') return null;
  return candidate as MailProvider;
}

/**
 * Assemble a `MailProviderContext` for an account: decrypt its credentials and
 * package tenant/account identity. Throws (via `decryptMailboxCreds`) when no
 * cipher is present or the blob cannot be read — callers wrap with their own
 * error envelope.
 */
export async function buildProviderContext(
  workspaceId: string,
  account: SabmailAccount,
): Promise<MailProviderContext> {
  if (!workspaceId) {
    throw new Error('buildProviderContext: workspaceId is required.');
  }
  if (!account) {
    throw new Error('buildProviderContext: account is required.');
  }
  if (!account.credentialsCipher) {
    throw new Error(
      'buildProviderContext: account has no stored credentials — reconnect the mailbox.',
    );
  }

  const creds = decryptMailboxCreds(workspaceId, account.credentialsCipher);

  return {
    workspaceId,
    accountId: account._id ? String(account._id) : '',
    account: account as SabmailAccount & Record<string, unknown>,
    creds,
  };
}
