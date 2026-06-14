import 'server-only';

import { randomBytes } from 'node:crypto';

import { ObjectId, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import {
  SABMAIL_COLLECTIONS,
  ensureSabmailIndexes,
  getSabmailCollections,
} from '@/lib/sabmail/db/collections';
import { encryptMailboxCreds, hasMailboxCredsKey } from '@/lib/sabmail/credentials';
import {
  stalwartAdmin as hostedProvider,
  isStalwartEnabled,
  StalwartError,
} from '@/lib/sabmail/hosted-provider';
import type { SabmailAccount } from '@/lib/sabmail/types';
import type {
  SabmailDomainDoc,
  SabmailDomainStatus,
} from '@/app/sabmail/domains/actions';
import { getErrorMessage } from '@/lib/utils';

/* ──────────────────────────────────────────────────────────────────────
 * SabMail — HOSTED mailbox provisioning + management CORE.
 *
 * This is the cookie-free heart of the hosted-mailbox lifecycle. It takes an
 * explicit `workspaceId` (the `kind:'mail'` project `_id`) so it can be driven
 * both by the SabMail UI (which resolves the workspace from the
 * `sabmail_project` cookie — see `hosted-actions.ts`) AND by other modules that
 * provision mailboxes on a workspace they resolve themselves (e.g. the SabNode
 * Admin Center, which onboards an employee's company mailbox on the org's mail
 * workspace).
 *
 * A hosted mailbox is a real `individual` principal on the Stalwart Mail Server
 * (the MTA/IMAP/JMAP sidecar), provisioned on a domain the workspace has
 * ALREADY verified in `sabmail_domains` (status === 'verified'), then mirrored
 * into `sabmail_accounts` as a `provider:'hosted'` account so the rest of
 * SabMail (inbox sync, sending, gate) treats it like any other mailbox.
 *
 * Mailbox secrets (the generated password, used for IMAP+SMTP auth) are
 * persisted ONLY inside `credentialsCipher` (AES-256-GCM); the plaintext is
 * returned to the caller AT MOST ONCE, as `generatedPassword`.
 *
 * NOTE: these core functions deliberately do NOT call `revalidatePath` — that
 * is a per-surface concern left to the thin server-action wrappers, so each
 * caller revalidates the path that actually rendered the data.
 * ──────────────────────────────────────────────────────────────────── */

export const HOSTED_NOT_CONFIGURED =
  'Hosted mail is not configured. Set STALWART_ADMIN_URL and STALWART_ADMIN_TOKEN to provision mailboxes on your own domain.';

/** local-part of an email address: dot-separated atoms, no leading/trailing/double dots. */
const LOCAL_PART_RE =
  /^(?=.{1,64}$)[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;

export type Result<T> = ({ ok: true } & T) | { ok: false; error: string };
export type VoidResult = { ok: true } | { ok: false; error: string };

/** Input accepted by {@link provisionHostedMailboxForWorkspace}. */
export interface HostedMailboxProvisionInput {
  localPart: string;
  domain: string;
  displayName?: string;
  password?: string;
  quotaMb?: number;
}

/** Safe (no-secret) projection of a hosted mailbox + its domain status. */
export interface SabmailHostedMailboxRow {
  id: string;
  email: string;
  localPart: string;
  domain: string;
  displayName: string | null;
  status: SabmailAccount['status'];
  /** Status of the underlying `sabmail_domains` entry, or null if it's gone. */
  domainStatus: SabmailDomainStatus | null;
  imapHost: string | null;
  smtpHost: string | null;
  lastError: string | null;
  createdAt: string | null;
}

/* ── helpers ──────────────────────────────────────────────────────────── */

/** Translate any thrown error (incl. StalwartError) into a friendly message. */
function describeProviderError(err: unknown): string {
  if (err instanceof StalwartError) {
    if (err.status === 503) return HOSTED_NOT_CONFIGURED;
    return `Hosted mail server error (${err.status}): ${err.message}`;
  }
  return getErrorMessage(err);
}

/**
 * Generate a strong, URL-safe-ish mailbox password (24 chars). Used when the
 * caller does not supply one; returned to the UI exactly once.
 */
export function generateStrongMailboxPassword(): string {
  // base64url of 18 random bytes → 24 URL-safe chars, no padding.
  return randomBytes(18).toString('base64url');
}

/** Resolve the IMAP host for a hosted mailbox (env override → domain fallback). */
function hostedImapHost(domain: string): string {
  return (process.env.SABMAIL_MAIL_HOST || domain).trim();
}

/** Resolve the SMTP host for a hosted mailbox (env override chain → domain). */
function hostedSmtpHost(domain: string): string {
  return (
    process.env.SABMAIL_SMTP_HOST ||
    process.env.SABMAIL_MAIL_HOST ||
    domain
  ).trim();
}

function hostedSmtpPort(): number {
  const raw = Number(process.env.SABMAIL_SMTP_PORT || 587);
  return Number.isFinite(raw) && raw > 0 ? raw : 587;
}

/** Project a hosted `sabmail_accounts` doc to a safe, serializable row. */
function toHostedRow(
  doc: WithId<SabmailAccount>,
  domainStatus: SabmailDomainStatus | null,
): SabmailHostedMailboxRow {
  const [localPart, domain = ''] = doc.email.split('@');
  return {
    id: String(doc._id),
    email: doc.email,
    localPart: localPart ?? doc.email,
    domain,
    displayName: doc.displayName ?? null,
    status: doc.status,
    domainStatus,
    imapHost: doc.imap?.host ?? null,
    smtpHost: doc.smtp?.host ?? null,
    lastError: doc.lastError ?? null,
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
  };
}

/** Find a domain doc for this workspace, or null. */
async function findDomainForWorkspace(
  workspaceId: string,
  domain: string,
): Promise<WithId<SabmailDomainDoc> | null> {
  const { db } = await connectToDatabase();
  const doc = await db
    .collection<SabmailDomainDoc>(SABMAIL_COLLECTIONS.domains)
    .findOne({ workspaceId, domain });
  if (!doc) return null;
  return doc as WithId<SabmailDomainDoc>;
}

/* ── list ─────────────────────────────────────────────────────────────── */

/**
 * List a workspace's hosted mailboxes (`provider:'hosted'`), each annotated
 * with the status of its underlying verified domain. Never returns secrets.
 */
export async function listHostedMailboxesForWorkspace(
  workspaceId: string,
): Promise<Result<{ mailboxes: SabmailHostedMailboxRow[] }>> {
  try {
    const { db } = await connectToDatabase();
    const docs = await db
      .collection<SabmailAccount>(SABMAIL_COLLECTIONS.accounts)
      .find({ workspaceId, provider: 'hosted' })
      .sort({ createdAt: -1 })
      .limit(500)
      .toArray();

    // One lookup of all referenced domains → status map (avoids N+1).
    const domains = Array.from(
      new Set(
        docs
          .map((d) => (d.email.split('@')[1] || '').toLowerCase())
          .filter((x) => x.length > 0),
      ),
    );
    const domainStatus = new Map<string, SabmailDomainStatus>();
    if (domains.length > 0) {
      const domDocs = await db
        .collection<SabmailDomainDoc>(SABMAIL_COLLECTIONS.domains)
        .find({ workspaceId, domain: { $in: domains } }, { projection: { domain: 1, status: 1 } })
        .toArray();
      for (const dd of domDocs) domainStatus.set(dd.domain, dd.status);
    }

    const mailboxes = docs.map((d) => {
      const domain = (d.email.split('@')[1] || '').toLowerCase();
      return toHostedRow(d as WithId<SabmailAccount>, domainStatus.get(domain) ?? null);
    });
    return { ok: true, mailboxes };
  } catch (err) {
    return { ok: false, error: getErrorMessage(err) };
  }
}

/* ── provision ────────────────────────────────────────────────────────── */

/**
 * Provision a brand-new hosted mailbox `localPart@domain` on the Stalwart
 * server, then mirror it into `sabmail_accounts` as a `provider:'hosted'`
 * account. The domain MUST be a `status:'verified'` entry in this workspace's
 * `sabmail_domains`. A strong password is generated when none is supplied and
 * returned exactly once as `generatedPassword` (never persisted in plaintext).
 */
export async function provisionHostedMailboxForWorkspace(
  workspaceId: string,
  input: HostedMailboxProvisionInput,
): Promise<Result<{ mailbox: SabmailHostedMailboxRow; generatedPassword?: string }>> {
  try {
    if (!workspaceId) return { ok: false, error: 'No mail workspace.' };
    if (!isStalwartEnabled()) {
      return { ok: false, error: HOSTED_NOT_CONFIGURED };
    }
    if (!hasMailboxCredsKey()) {
      return {
        ok: false,
        error: 'Mailbox encryption key not configured. Set SABMAIL_CREDS_KEY (64 hex chars).',
      };
    }

    const localPart = (input.localPart || '').trim().toLowerCase();
    if (!localPart) return { ok: false, error: 'Enter the part before the @.' };
    if (!LOCAL_PART_RE.test(localPart)) {
      return { ok: false, error: 'Invalid mailbox name. Use letters, digits, dots, hyphens.' };
    }

    const domain = (input.domain || '').trim().toLowerCase().replace(/\.$/, '');
    if (!domain) return { ok: false, error: 'Pick a verified domain.' };

    // Only allow provisioning on a domain VERIFIED in this workspace.
    const domainDoc = await findDomainForWorkspace(workspaceId, domain);
    if (!domainDoc) {
      return { ok: false, error: 'That domain is not in this workspace.' };
    }
    if (domainDoc.status !== 'verified') {
      return {
        ok: false,
        error: 'Verify the domain (SPF, DKIM, DMARC) before provisioning mailboxes on it.',
      };
    }

    const email = `${localPart}@${domain}`;

    const generated = !input.password?.trim();
    const password = input.password?.trim() || generateStrongMailboxPassword();

    let quotaBytes: number | undefined;
    if (typeof input.quotaMb === 'number' && Number.isFinite(input.quotaMb) && input.quotaMb > 0) {
      quotaBytes = Math.round(input.quotaMb * 1024 * 1024);
    }

    // Refuse to clobber an existing account row for the same address.
    const { cols } = await getSabmailCollections();
    const dupe = await cols.accounts.findOne(
      { workspaceId, email },
      { projection: { _id: 1 } },
    );
    if (dupe) {
      return { ok: false, error: 'A mailbox with that address already exists.' };
    }

    // Create the principal on the mail server first — if this fails we never
    // write a half-provisioned account row.
    try {
      await hostedProvider.createMailbox({
        email,
        password,
        displayName: input.displayName?.trim() || undefined,
        quotaBytes,
      });
    } catch (err) {
      return { ok: false, error: describeProviderError(err) };
    }

    // Encrypt the IMAP+SMTP secrets (same login for both on Stalwart).
    const credentialsCipher = encryptMailboxCreds(workspaceId, {
      imapUser: email,
      imapPass: password,
      smtpUser: email,
      smtpPass: password,
    });

    await ensureSabmailIndexes();
    const now = new Date();
    const set: Record<string, unknown> = {
      workspaceId,
      provider: 'hosted',
      email,
      imap: { host: hostedImapHost(domain), port: 993, secure: true },
      smtp: { host: hostedSmtpHost(domain), port: hostedSmtpPort(), secure: false },
      credentialsCipher,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    if (input.displayName?.trim()) set.displayName = input.displayName.trim();

    let accountId: string;
    try {
      const ins = await cols.accounts.insertOne(set as never);
      accountId = String(ins.insertedId);
    } catch (err) {
      // A unique-key (E11000) collision means a row appeared between the dupe
      // pre-check and the insert (race / retry). Roll back the orphaned Stalwart
      // principal and return a friendly error.
      const isDup =
        typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
      if (isDup) {
        try {
          await hostedProvider.deleteMailbox(email);
        } catch {
          /* best-effort rollback — the principal may already be gone */
        }
        return { ok: false, error: `A mailbox ${email} already exists.` };
      }
      throw err;
    }

    // Best-effort: bump the domain's mailboxCount (non-fatal on failure).
    try {
      const { db } = await connectToDatabase();
      await db
        .collection<SabmailDomainDoc>(SABMAIL_COLLECTIONS.domains)
        .updateOne({ _id: domainDoc._id, workspaceId }, { $inc: { mailboxCount: 1 } as never });
    } catch {
      /* count is advisory only */
    }

    const mailbox = toHostedRow(
      { ...set, _id: accountId } as unknown as WithId<SabmailAccount>,
      domainDoc.status,
    );
    mailbox.id = accountId;

    return generated
      ? { ok: true, mailbox, generatedPassword: password }
      : { ok: true, mailbox };
  } catch (err) {
    return { ok: false, error: getErrorMessage(err) };
  }
}

/* ── reset password ───────────────────────────────────────────────────── */

/**
 * Reset a hosted mailbox's password: set it on the mail server, re-encrypt the
 * IMAP+SMTP secrets and persist. When `newPassword` is omitted a strong one is
 * generated and returned exactly once as `generatedPassword`.
 */
export async function resetHostedMailboxPasswordForWorkspace(
  workspaceId: string,
  accountId: string,
  newPassword?: string,
): Promise<Result<{ generatedPassword?: string }>> {
  try {
    if (!workspaceId) return { ok: false, error: 'No mail workspace.' };
    if (!isStalwartEnabled()) return { ok: false, error: HOSTED_NOT_CONFIGURED };
    if (!hasMailboxCredsKey()) {
      return {
        ok: false,
        error: 'Mailbox encryption key not configured. Set SABMAIL_CREDS_KEY (64 hex chars).',
      };
    }
    if (!accountId || !ObjectId.isValid(accountId)) {
      return { ok: false, error: 'Invalid mailbox id.' };
    }

    const { cols } = await getSabmailCollections();
    const doc = (await cols.accounts.findOne({
      _id: new ObjectId(accountId),
      workspaceId,
      provider: 'hosted',
    })) as WithId<SabmailAccount> | null;
    if (!doc) return { ok: false, error: 'Hosted mailbox not found.' };

    const generated = !newPassword?.trim();
    const password = newPassword?.trim() || generateStrongMailboxPassword();

    try {
      await hostedProvider.setPassword(doc.email, password);
    } catch (err) {
      return { ok: false, error: describeProviderError(err) };
    }

    const credentialsCipher = encryptMailboxCreds(workspaceId, {
      imapUser: doc.email,
      imapPass: password,
      smtpUser: doc.email,
      smtpPass: password,
    });

    await cols.accounts.updateOne(
      { _id: doc._id, workspaceId },
      { $set: { credentialsCipher, updatedAt: new Date() }, $unset: { lastError: '', lastErrorAt: '' } },
    );

    return generated ? { ok: true, generatedPassword: password } : { ok: true };
  } catch (err) {
    return { ok: false, error: getErrorMessage(err) };
  }
}

/* ── status (suspend / re-activate) ───────────────────────────────────── */

/**
 * Suspend or re-activate a hosted mailbox: flip the principal's state on the
 * mail server, then mirror the status into `sabmail_accounts`
 * (`'suspended' → 'disconnected'`).
 */
export async function setHostedMailboxStatusForWorkspace(
  workspaceId: string,
  accountId: string,
  status: 'active' | 'suspended',
): Promise<VoidResult> {
  try {
    if (!workspaceId) return { ok: false, error: 'No mail workspace.' };
    if (!isStalwartEnabled()) return { ok: false, error: HOSTED_NOT_CONFIGURED };
    if (status !== 'active' && status !== 'suspended') {
      return { ok: false, error: 'Status must be "active" or "suspended".' };
    }
    if (!accountId || !ObjectId.isValid(accountId)) {
      return { ok: false, error: 'Invalid mailbox id.' };
    }

    const { cols } = await getSabmailCollections();
    const doc = (await cols.accounts.findOne({
      _id: new ObjectId(accountId),
      workspaceId,
      provider: 'hosted',
    })) as WithId<SabmailAccount> | null;
    if (!doc) return { ok: false, error: 'Hosted mailbox not found.' };

    try {
      await hostedProvider.setStatus(doc.email, status);
    } catch (err) {
      return { ok: false, error: describeProviderError(err) };
    }

    const accountStatus: SabmailAccount['status'] =
      status === 'suspended' ? 'disconnected' : 'active';
    await cols.accounts.updateOne(
      { _id: doc._id, workspaceId },
      { $set: { status: accountStatus, updatedAt: new Date() } },
    );

    return { ok: true };
  } catch (err) {
    return { ok: false, error: getErrorMessage(err) };
  }
}

/* ── delete ───────────────────────────────────────────────────────────── */

/**
 * Permanently delete a hosted mailbox: remove the principal from the mail
 * server, then delete its `sabmail_accounts` row and decrement the domain's
 * advisory `mailboxCount`.
 */
export async function deleteHostedMailboxForWorkspace(
  workspaceId: string,
  accountId: string,
): Promise<VoidResult> {
  try {
    if (!workspaceId) return { ok: false, error: 'No mail workspace.' };
    if (!isStalwartEnabled()) return { ok: false, error: HOSTED_NOT_CONFIGURED };
    if (!accountId || !ObjectId.isValid(accountId)) {
      return { ok: false, error: 'Invalid mailbox id.' };
    }

    const { cols } = await getSabmailCollections();
    const doc = (await cols.accounts.findOne({
      _id: new ObjectId(accountId),
      workspaceId,
      provider: 'hosted',
    })) as WithId<SabmailAccount> | null;
    if (!doc) return { ok: false, error: 'Hosted mailbox not found.' };

    try {
      await hostedProvider.deleteMailbox(doc.email);
    } catch (err) {
      return { ok: false, error: describeProviderError(err) };
    }

    await cols.accounts.deleteOne({ _id: doc._id, workspaceId });

    // Best-effort: decrement the domain's mailboxCount (non-fatal on failure).
    const domain = (doc.email.split('@')[1] || '').toLowerCase();
    if (domain) {
      try {
        const { db } = await connectToDatabase();
        await db
          .collection<SabmailDomainDoc>(SABMAIL_COLLECTIONS.domains)
          .updateOne({ workspaceId, domain }, { $inc: { mailboxCount: -1 } as never });
      } catch {
        /* count is advisory only */
      }
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: getErrorMessage(err) };
  }
}
