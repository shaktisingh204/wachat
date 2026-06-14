import type { ObjectId } from 'mongodb';

/**
 * SabMail shared TypeScript shapes.
 *
 * SabMail is the consolidated email module — a connected web email client
 * (Gmail / Outlook / IMAP) AND a sending platform (transactional + marketing
 * on verified / hosted domains). It mirrors the SabSMS tenancy model: a
 * `kind:'mail'` project's `_id` string is the `workspaceId` every SabMail
 * collection (and the future Rust SabMail engine) scopes by.
 *
 * Only the shapes Phase 0 needs are defined here; message/thread/campaign
 * shapes are added as their phases land.
 */

/** How a mailbox connects to the outside world. */
export type SabmailAccountProvider = 'imap' | 'gmail' | 'outlook' | 'hosted';

export type SabmailAccountStatus = 'active' | 'error' | 'pending' | 'disconnected';

/** A non-secret IMAP/SMTP endpoint descriptor. */
export interface SabmailHostEndpoint {
  host: string;
  port: number;
  /** Implicit TLS (true) vs STARTTLS/plain (false). */
  secure: boolean;
}

/**
 * A connected mailbox (`sabmail_accounts`). Secrets live ONLY inside
 * `credentialsCipher` (AES-256-GCM, see `./credentials.ts`) — never in
 * plaintext fields. OAuth accounts (gmail/outlook) store their refresh
 * token in the same cipher blob.
 */
export interface SabmailAccount {
  _id?: ObjectId;
  workspaceId: string;
  provider: SabmailAccountProvider;
  /** The mailbox address, e.g. `you@example.com`. Unique per workspace. */
  email: string;
  displayName?: string;
  imap?: SabmailHostEndpoint;
  smtp?: SabmailHostEndpoint;
  /** AES-256-GCM cipher of `{ imapUser, imapPass, smtpUser, smtpPass }` or `{ refreshToken }`. */
  credentialsCipher?: string;
  status: SabmailAccountStatus;
  lastError?: string;
  lastErrorAt?: Date;
  lastSyncedAt?: Date;
  /** Sync cursor (Gmail historyId / Graph deltaLink / IMAP UIDVALIDITY:UID) — set in Phase 1. */
  syncCursor?: string;
  /** Azure AD tenant for Outlook accounts (per-account override of SABMAIL_MS_AUTHORITY). */
  tenantId?: string;
  /** OAuth scopes granted at connect time (audit / re-consent decisions). */
  oauthScopes?: string;
  /** Microsoft Graph push subscription id (set when a webhook subscription is registered). */
  graphSubscriptionId?: string;
  /** ISO expiry of the Graph subscription — the renewal cron PATCHes before this. */
  graphSubscriptionExpiry?: string;
  /** Last time the Gmail watch / Graph subscription was (re-)armed. */
  pushRenewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/** Per-workspace SabMail settings (`sabmail_settings`). */
export interface SabmailSettings {
  _id?: ObjectId;
  workspaceId: string;
  /** Default From identity for sends, when not overridden. */
  defaultFromAccountId?: string;
  /** Image-proxy + remote-content policy for safe rendering (Phase 1). */
  blockRemoteImages?: boolean;
  updatedAt: Date;
}
