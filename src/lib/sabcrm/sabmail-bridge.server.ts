import 'server-only';

/**
 * SabCRM → SabMail send bridge.
 *
 * Routes a SabCRM record email THROUGH the workspace's own SabMail mailbox so
 * the message lands in SabMail (folder `sent`) and threads with the inbound
 * reply — instead of going out only via the platform transactional transport.
 *
 * Two SabMail account stores exist; we resolve them in priority order:
 *
 *   1. **SabMail connected accounts** (`sabmail_accounts`, keyed by
 *      `workspaceId` — the active mail project) drive the Rust
 *      {@link sabmailEngine}.send path (`/v1/send`). Used when
 *      {@link isSabmailEngineEnabled} is true AND an active account exists.
 *   2. **Hosted mail accounts** (`mail_accounts` via the Rust BFF, keyed by
 *      `userId`) drive the in-process {@link sendMailMessage} action, which
 *      persists to `mail_messages` with `folderId = sent`.
 *
 * Everything here is **best-effort** and **session-optional**: it never throws,
 * and when SabMail isn't configured (no account / engine off / no session)
 * `sendViaSabmail` returns `{ ok: false }` so the caller falls back to today's
 * `dispatchTransactionalEmail` path unchanged.
 *
 * Nothing here reads the SabCRM session/gate — the caller resolves `userId`
 * first (same contract as `email-core.ts`).
 */

import {
  isSabmailEngineEnabled,
  sabmailEngine,
} from '@/lib/sabmail/engine-client';
import {
  buildRecipients,
  normalizeReferences,
  toAddressDescriptors,
} from './sabmail-bridge.pure';

export {
  isEmailLike,
  normalizeAddressList,
  buildRecipients,
  toAddressDescriptors,
  normalizeReferences,
} from './sabmail-bridge.pure';
export type { NormalizedRecipients } from './sabmail-bridge.pure';

/* ------------------------------------------------------------------------ */
/* Account resolution                                                        */
/* ------------------------------------------------------------------------ */

export interface CrmMailAccount {
  /** Account id for the chosen transport (engine: sabmail_accounts._id;
   *  hosted: mail_accounts._id). */
  accountId: string;
  fromAddress: string;
  displayName?: string;
  /** The SabMail workspaceId (engine path); undefined for hosted accounts. */
  workspaceId?: string;
  /** Which send path this account drives. */
  via: 'engine' | 'hosted';
}

/**
 * Resolve the user's/workspace's active SabMail account, or `null` when none
 * is configured. Best-effort — never throws.
 *
 *   - When the engine is enabled and the session has an active mail
 *     workspace with an active `sabmail_accounts` row, returns the engine
 *     account (so `sabmailEngine.send` can deliver).
 *   - Otherwise falls back to the user's first active hosted `mail_accounts`
 *     row (so `sendMailMessage` can record + send).
 */
export async function resolveCrmMailAccount(
  userId: string,
): Promise<CrmMailAccount | null> {
  // 1. Engine-backed connected account (preferred when the engine is on).
  if (isSabmailEngineEnabled()) {
    try {
      const { getSabmailWorkspaceId } = await import('@/lib/sabmail/workspace');
      const workspaceId = await getSabmailWorkspaceId();
      if (workspaceId) {
        const { connectToDatabase } = await import('@/lib/mongodb');
        const { db } = await connectToDatabase();
        const account = await db.collection('sabmail_accounts').findOne(
          { workspaceId, status: 'active' },
          { projection: { _id: 1, email: 1, displayName: 1 } },
        );
        const fromAddress =
          typeof account?.email === 'string' ? account.email.trim() : '';
        if (account?._id && fromAddress) {
          return {
            accountId: String(account._id),
            fromAddress,
            displayName:
              typeof account.displayName === 'string'
                ? account.displayName
                : undefined,
            workspaceId,
            via: 'engine',
          };
        }
      }
    } catch {
      /* fall through to the hosted account */
    }
  }

  // 2. Hosted mailbox account (in-process transport).
  try {
    const { listMailAccounts } = await import('@/app/actions/mailbox.actions');
    const accounts = await listMailAccounts({ status: 'active', limit: 1 });
    const account = accounts[0];
    const fromAddress =
      (typeof account?.emailAddress === 'string' && account.emailAddress) ||
      (typeof account?.localPart === 'string' && account.localPart) ||
      '';
    if (account?._id && fromAddress) {
      return {
        accountId: account._id,
        fromAddress,
        displayName: account.displayName,
        via: 'hosted',
      };
    }
  } catch {
    /* no hosted account / no session */
  }

  return null;
}

/* ------------------------------------------------------------------------ */
/* Send                                                                      */
/* ------------------------------------------------------------------------ */

export interface SendViaSabmailInput {
  userId: string;
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  cc?: string | string[];
  bcc?: string | string[];
  /** Message-Id of the message being replied to (threading). */
  inReplyTo?: string;
  /** References chain (threading); the inReplyTo id is appended automatically. */
  references?: string | string[];
}

export interface SendViaSabmailResult {
  ok: boolean;
  messageId?: string;
  /** Which path delivered (diagnostic only). */
  via?: 'engine' | 'hosted';
}

/**
 * Deliver a SabCRM record email through SabMail's own mailbox so it lands in
 * the sent folder and threads. Returns `{ ok: true, messageId }` on success;
 * `{ ok: false }` when SabMail isn't configured or the send failed — the
 * caller then falls back to `dispatchTransactionalEmail`. Never throws.
 */
export async function sendViaSabmail(
  input: SendViaSabmailInput,
): Promise<SendViaSabmailResult> {
  try {
    const recipients = buildRecipients({
      to: input.to,
      cc: input.cc,
      bcc: input.bcc,
    });
    if (!recipients) return { ok: false };

    const subject = (input.subject ?? '').trim();
    if (!subject) return { ok: false };

    const account = await resolveCrmMailAccount(input.userId);
    if (!account) return { ok: false };

    const references = normalizeReferences(input.references, input.inReplyTo);

    // Engine path — Rust SMTP (lettre). Threading headers are owned by the
    // engine; we still pass the SabMail account + workspace it keys on.
    if (account.via === 'engine' && account.workspaceId) {
      try {
        const res = await sabmailEngine.send({
          workspaceId: account.workspaceId,
          accountId: account.accountId,
          to: recipients.to,
          cc: recipients.cc,
          bcc: recipients.bcc,
          subject,
          html: input.html,
          text: input.text,
        });
        if (res?.ok) return { ok: true, messageId: res.messageId, via: 'engine' };
      } catch {
        /* engine unreachable — fall through to the hosted path */
      }
    }

    // Hosted path — in-process transport via the mailbox action. Persists to
    // `mail_messages` (folderId = sent) and threads via inReplyTo/references.
    const { sendMailMessage } = await import('@/app/actions/mailbox.actions');
    const res = await sendMailMessage({
      accountId: account.accountId,
      from: { email: account.fromAddress, name: account.displayName },
      to: toAddressDescriptors(recipients.to),
      cc: recipients.cc ? toAddressDescriptors(recipients.cc) : undefined,
      bcc: recipients.bcc ? toAddressDescriptors(recipients.bcc) : undefined,
      subject,
      html: input.html,
      text: input.text,
      inReplyTo: input.inReplyTo,
      references: references.length ? references : undefined,
    });
    if (res?.ok) return { ok: true, messageId: res.messageId, via: 'hosted' };
    return { ok: false };
  } catch {
    return { ok: false };
  }
}
