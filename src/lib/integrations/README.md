# Integrations

Plumbing for the 4 cross-cutting integrations wired into SabNode's CRM
& HR surfaces. All four are **non-fatal by design** — a misconfigured
integration must never break the originating server action.

## 1. Slack notifications (`slack.ts`)

Posts to a tenant-configured Incoming Webhook for key business events.

**Entry point**

```ts
import { sendSlackNotification } from '@/lib/integrations/slack';

await sendSlackNotification('New lead: Acme Corp from Website');
```

**Settings** are read from `crm_slack_settings` (one document per
tenant, keyed by `userId`). Fields used: `webhook_url`, `channel`,
`username`, `is_active`. When `is_active === false` or no `webhook_url`
is present the call is a no-op. Every successful delivery and every
failure is logged into `integration_events` for the integration console
at `/dashboard/crm/settings/integrations/slack`.

> Schema note — the brief asked for a `status` field with value
> `'disabled'`. The existing collection (`WsSlackSetting` in
> `src/lib/worksuite/integrations-types.ts`) uses `is_active: boolean`
> instead, so this implementation treats `is_active === false` as the
> disabled state.

**Wired into:**

| Action file                                        | Trigger                          | Message                                                |
| -------------------------------------------------- | -------------------------------- | ------------------------------------------------------ |
| `src/app/actions/crm-leads.actions.ts`             | `addCrmLead`                     | `New lead: {name} from {source}`                       |
| `src/app/actions/worksuite/payments.actions.ts`    | `recordPayment` (payment ok)     | `Payment received: {amount} for {invoiceNumber}`       |
| `src/app/actions/worksuite/leave.actions.ts`       | `saveLeave` (apply)              | `Leave request: {employee} for {N} day(s)`             |
| `src/app/actions/crm/tickets.actions.ts`           | `saveTicketAction` (create)      | `New ticket #{number}: {subject}`                      |
| `src/app/actions/crm-deals.actions.ts`             | `updateCrmDealStage` / `updateCrmDeal` → `won` | `Deal won: {name} - {currency value}`     |

> The payment hook lives in `worksuite/payments.actions.ts` (where the
> `recordPayment` action actually fires) rather than
> `crm-invoices.actions.ts` — the latter has no payment-received
> mutation; it's a read/list/save surface.

## 2. Google Calendar (`google-calendar.ts`)

Pushes events to the user's primary calendar using the Google Calendar
v3 REST API, with automatic refresh-token rotation.

**Entry points**

```ts
pushToCalendar(userId, { summary, description?, start, end, location?, timeZone?, allDay? })
  -> { ok, googleEventId?, error? }

removeFromCalendar(userId, googleEventId)
  -> { ok, error? }
```

Tokens live in `crm_google_calendar_settings` (per-tenant). The
existing settings page at
`/dashboard/crm/settings/integrations/google-calendar` configures the
workspace OAuth app. Per-user OAuth tokens are stored in the same
collection as `access_token`/`refresh_token`/`token_expires_at`.

**Wired into:**

| Action file                                         | Trigger              | Pushed event                                      |
| --------------------------------------------------- | -------------------- | ------------------------------------------------- |
| `src/app/actions/crm-events.actions.ts` → `saveEvent` | Create              | The event itself; mapping stored in `crm_event_calendar_sync` |
| `src/app/actions/worksuite/leave.actions.ts` → `approveLeave` | Approve              | Block the date(s) on the approver's calendar; `googleEventId` written back on the leave doc |
| `src/app/actions/crm-contracts.actions.ts` → `saveContract`   | Create               | Contract end-date renewal reminder; `googleEventId` written back on the contract doc |

On failure we set `syncFailed: true` (or `googleCalendarSyncFailed`) on
the originating entity so the UI / reports can surface stale pushes.

## 3. IMAP → ticket (`imap-tickets.ts`)

Polls each tenant's configured support inbox and turns unread emails
into rows in `crm_tickets`.

**Entry point**

```ts
pollImapInbox(): Promise<{ processed, ticketsCreated, inboxesPolled, errors }>
```

Cron job lives at `src/lib/cron/jobs/imap-tickets.ts` — register it on
a 5-minute schedule with the existing cron orchestrator. The job is
**safe to register before the IMAP packages are installed**: it
gracefully exits with `errors: ['dependencies-missing']` if `imapflow`
or `mailparser` are absent.

> **Install the IMAP packages before enabling the cron:**
>
> ```bash
> npm i imapflow mailparser
> npm i -D @types/mailparser
> ```

Settings come from `crm_ticket_email_settings` (`imap_host`,
`imap_port`, `email_address`, `password`, `encryption`, `lastUid`,
`is_active`). Stored passwords are decrypted with
`@/lib/sabflow/credentials/encryption` (with a verbatim fallback for
legacy plaintext rows).

Each new email becomes a `crm_tickets` row with
`status='open'`, `channel='email'`, `requester_email`, `subject`,
`description` (plain-text body, HTML stripped). The IMAP message is
flagged `\Seen` and the per-inbox `lastUid` watermark is updated.

Attachment handling: a TODO stub logs the attachment metadata and
skips the blob upload until a server-side SabFiles upload API ships.
See `uploadAttachmentToSabFiles()` in `imap-tickets.ts`.

## 4. Two-factor authentication

Lives in:

- `src/lib/totp.ts` — RFC 6238 TOTP (HMAC-SHA1, 30 s window, 6 digits)
  using only Node's built-in `crypto`. Verification accepts ±1 step for
  clock drift. Exposes `generateSecret`, `generateOtpauthUrl`,
  `generateQrUrl`, `verifyTotpCode`, `generateBackupCodes`.
- `src/app/actions/two-fa.actions.ts` — server actions for the UI:
  `getMy2faStatus`, `enableEmail2fa`, `verifyEmail2faCode`,
  `disableEmail2fa`, `generateAuthenticator2faSecret`,
  `verifyAuthenticator2faSetup`, `regenerateBackupCodes`, `disable2fa`
  (password re-auth). Also exposes the login-flow helpers
  `checkRequires2fa(userId)` and `verifyTwoFactorChallenge(userId, code)`.
- `src/app/dashboard/profile/2fa-setup/page.tsx` — the user-facing UI
  with Email / Authenticator tabs, backup-code regeneration, and a
  password-confirm disable flow.
- `src/app/api/auth/two-fa/route.ts` — login-completion endpoint. After
  the existing `/api/auth/session` route detects 2FA is required it
  returns `{ requires2fa: true }` and sets a 5-minute
  `session_pending_2fa` cookie; the client posts the 6-digit (or
  backup) code here, the code is verified, and the real session cookie
  is minted.
- `/api/auth/session` (existing route) — now returns
  `{ requires2fa, method, userId }` instead of the session payload when
  the user has 2FA enabled.

**Stored on the user document:**

| Field                            | Purpose                                                   |
| -------------------------------- | --------------------------------------------------------- |
| `twoFactorEnabled`               | boolean                                                   |
| `twoFactorMethod`                | `'email'` \| `'totp'`                                     |
| `twoFactorSecret`                | encrypted base32 TOTP secret (AES-256-GCM)                |
| `twoFactorBackupCodes`           | bcrypt-hashed strings (one-use each)                      |
| `twoFactorEmailCode` + `…ExpiresAt` | SHA-256 hash of pending enrolment email code           |
| `twoFactorChallengeCode` + `…ExpiresAt` | SHA-256 hash of in-flight login code               |
| `twoFactorPendingSecret` / `twoFactorPendingBackupCodes` | scratch space during setup        |

Backup codes are bcrypt-hashed; the plaintext is only ever returned
once (during enrolment or regeneration). Email codes are 6 digits with
a 10-minute TTL. TOTP secrets are AES-256-GCM-encrypted at rest using
`CREDENTIALS_ENCRYPTION_KEY` (with `NEXTAUTH_SECRET` fallback) — the
same envelope used by SabFlow credentials.
