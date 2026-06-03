# Twenty Server Review — Messaging, Calendar, Connected Accounts, Email & Domains

Read-only catalog of the vendored Twenty CRM backend (`twenty-server/src`) for the
slice covering email/calendar sync, connected accounts, OAuth token management,
transactional email, and domain/DNS provisioning. Descriptions are original
summaries — no source is reproduced verbatim.

This slice is overwhelmingly **runtime-heavy**: it is the part of Twenty that turns
the CRM into a live email/calendar sync engine. It depends on a BullMQ-style job
queue, multiple cron schedulers, OAuth2 token refresh against Google/Microsoft,
IMAP/SMTP/CalDAV network clients, and AWS SES + Cloudflare integrations. Almost
nothing here is a simple CRUD resolver.

Two location conventions matter:

- **`engine/core-modules/*`** — singleton, instance-level services (GraphQL
  resolvers, HTTP webhook controllers, driver factories, DNS/SES clients). These
  generally hold *core*-schema entities (one row per workspace or per domain).
- **`modules/*`** — per-workspace "standard object" logic: the sync pipelines,
  cron/job processors, listeners, and the workspace-schema entities (message,
  calendar event, participant, etc.) that live in each tenant's own DB schema.

---

## Cross-cutting data model

The "connected account" is the hub. A workspace member links a Google/Microsoft/
IMAP account; from that account Twenty derives one **message channel** (email
mailbox) and/or one **calendar channel**. Each channel runs an independent sync
state machine and produces workspace-schema rows.

```
ConnectedAccount (core schema, encrypted tokens)
   ├── MessageChannel  ──► Message / MessageThread / MessageParticipant / MessageFolder
   └── CalendarChannel ──► CalendarEvent / CalendarEventParticipant
Blocklist (workspace schema) gates both pipelines per workspace-member.
```

### ConnectedAccountEntity (`core.connectedAccount`)
Singleton per linked mailbox. Holds the OAuth/credential material and is the
anchor for all sync. Token columns are DB-checked to be encrypted (`enc:v2:` prefix).

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `handle` | varchar | Primary email address |
| `provider` | enum | GOOGLE / MICROSOFT / IMAP_SMTP_CALDAV / APP / OIDC / SAML / EMAIL_GROUP |
| `accessToken` | encrypted varchar | OAuth access token (nullable for IMAP) |
| `refreshToken` | encrypted varchar | OAuth refresh token |
| `lastCredentialsRefreshedAt` | timestamptz | Drives access-token validity check |
| `authFailedAt` | timestamptz | Set when auth breaks → reconnect banner |
| `handleAliases` | varchar[] | Send-as / alias addresses |
| `scopes` | varchar[] | Granted OAuth scopes |
| `connectionParameters` | jsonb | IMAP/SMTP/CALDAV host/port/encrypted-password blocks |
| `oidcTokenClaims` | jsonb | For OIDC-based connections |
| `userWorkspaceId` | uuid | Owning user-workspace |
| `connectionProviderId` / `applicationId` | uuid | App-connection plumbing |
| `visibility` | 'user' \| 'workspace' | Sharing scope |

Relations: one-to-many `MessageChannel`, one-to-many `CalendarChannel`. CASCADE
delete from application/connection-provider.

---

## Module: messaging (`modules/messaging`) — email sync engine

**Purpose.** Full bidirectional email sync: import messages from Gmail / Microsoft
Graph / IMAP into workspace objects, send outbound mail, manage folders, clean up
orphaned data, and enforce blocklists. The most complex module in the slice.

Sub-areas: `message-import-manager`, `message-outbound-manager`,
`message-folder-manager`, `message-cleaner`, `message-participant-manager`,
`blocklist-manager`, `monitoring`, plus `common` (entities, query-hooks, services).

### Entities (workspace schema)

**MessageWorkspaceEntity** — a single email.

| Field | Type | Notes |
|---|---|---|
| `headerMessageId` | string | RFC `Message-ID` header (dedup key) |
| `subject` / `text` | string | Body (searchable on subject) |
| `receivedAt` | Date | |
| `messageThreadId` | string | FK → thread |
| `messageParticipants` | relation[] | from/to/cc/bcc |
| `messageChannelMessageAssociations` | relation[] | links to channels/folders |

**MessageChannelWorkspaceEntity** — one mailbox + its sync state machine.

| Field | Type | Notes |
|---|---|---|
| `handle` / `type` / `visibility` | string/enum | Mailbox address, channel type, share-as-team flags |
| `isContactAutoCreationEnabled` / `contactAutoCreationPolicy` | bool/enum | Drives contact-creation pipeline |
| `messageFolderImportPolicy` | enum | All folders vs selected |
| `excludeNonProfessionalEmails` / `excludeGroupEmails` / `pendingGroupEmailsAction` | bool/enum | Import filters |
| `isSyncEnabled` | bool | Master on/off |
| `syncCursor` | string | Provider cursor (Gmail historyId / Graph deltaLink / IMAP UID) |
| `syncStatus` | enum | NOT_SYNCED / ONGOING / ACTIVE / FAILED_INSUFFICIENT_PERMISSIONS / FAILED_UNKNOWN |
| `syncStage` | enum | State machine (see below) |
| `syncStageStartedAt` / `syncedAt` | string | Staleness + scheduling |
| `throttleFailureCount` / `throttleRetryAfter` | number/string | Backoff after provider errors |
| `connectedAccountId` | string | FK |

**MessageChannelSyncStage** (the per-channel state machine, from `twenty-shared`):
`PENDING_CONFIGURATION → MESSAGE_LIST_FETCH_PENDING → ..._SCHEDULED → ..._ONGOING →
MESSAGES_IMPORT_PENDING → ..._SCHEDULED → ..._ONGOING → (loops)`, with `FAILED` as
the error sink. Cron jobs advance `PENDING → SCHEDULED` (and enqueue work jobs);
work jobs run `SCHEDULED → ONGOING` and back to the next `PENDING`.

**MessageParticipantWorkspaceEntity** — `role` (from/to/cc/bcc), `handle`,
`displayName`, FK to message, optional matched `person` / `workspaceMember`.

**MessageFolderWorkspaceEntity** — `name`, `externalId`, `syncCursor`,
`isSentFolder`, `isSynced`, `parentFolderId`, `pendingSyncAction`, FK to channel.

**MessageChannelMessageAssociationWorkspaceEntity** — join row carrying
`messageExternalId`, `messageThreadExternalId`, `direction` (INCOMING/OUTGOING),
and links to the message + its folders. This is what makes one message visible in
multiple channels/folders without duplication.

**MessageThreadWorkspaceEntity** — thread grouping (`message` collection).

### Sync pipelines

**Import (inbound).** Two-phase, driver-dispatched on `connectedAccount.provider`:
1. **Message-list fetch** — `messaging-message-list-fetch.service` →
   `messaging-get-message-list.service` switches to the Gmail / Microsoft / IMAP
   driver to pull the list of message IDs since the stored cursor.
   - Gmail: `gmail-get-message-list` + `gmail-get-history` (history-API delta).
   - Microsoft: `microsoft-get-message-list` + `microsoft-fetch-by-batch`
     (Graph `$batch`).
   - IMAP: `imap-get-message-list` + `imap-sync` (UID/SEARCH-based).
   New external IDs are cached for import (Redis-backed cursor cache).
2. **Messages import** — `messaging-messages-import.service` →
   `messaging-get-messages.service` fetches full bodies via the same per-provider
   drivers, then `messaging-save-messages-and-enqueue-contact-creation.service`
   persists messages/threads/participants/associations and enqueues
   contact-creation. Folder association handled by
   `messaging-message-folder-association.service`; group-email and folder-action
   processing handled by dedicated services.

**Inbound email (SES/relay).** `inbound-email-import.job` +
`inbound-email-import.service` / `inbound-email-parser` / `inbound-email-storage`
ingest raw MIME pushed in by the SES webhook (see messaging-webhooks), bypassing
provider polling.

**Outbound (send).** `messaging-message-outbound.service.sendMessage` switches on
provider: Gmail (`gmail-message-outbound`), Microsoft (`microsoft-message-outbound`),
IMAP/SMTP (`imap-smtp-message-outbound`), or email-group
(`email-group-message-outbound`). `send-email.service` + `sent-message-persistence`
persist the sent copy back into the channel.

**Folder management** (`message-folder-manager`) — per-provider drivers
(gmail/imap/microsoft) to list folders, find the Sent/Drafts folder, and reconcile
`pendingSyncAction` against the provider.

**Cleaning** (`message-cleaner`) — services + jobs to remove orphan messages,
delete data on channel/connected-account deletion, and a `reset-channel` command
to wipe + re-sync a channel.

**Participant matching** (`message-participant-manager`) — delegates to the
`match-participant` module to attach participants to existing People/Workspace
Members.

**Blocklist** (`blocklist-manager`) — listeners react to blocklist add/remove and
enqueue jobs to delete matching messages or re-import previously blocked senders.

### OAuth2 token management
Handled centrally by **connected-account** (below). The messaging drivers call
`ConnectedAccountRefreshTokensService.resolveTokens()` before each provider call to
get a guaranteed-valid (encrypted) access token.

### Background jobs

| Job / Cron | Type | Cadence | Role |
|---|---|---|---|
| `MessagingMessageListFetchCronJob` | cron | `2-59/5 * * * *` (every 5 min, offset 2) | Per active workspace: move sync-enabled channels in `MESSAGE_LIST_FETCH_PENDING` → `SCHEDULED` (skipping throttled), enqueue list-fetch jobs |
| `MessagingMessageListFetchJob` | worker | on-demand | Run one channel's list fetch; advance stage; route errors to exception handler |
| `MessagingMessagesImportCronJob` | cron | `*/1 * * * *` (every min) | Schedule channels in `MESSAGES_IMPORT_PENDING`, enqueue import jobs |
| `MessagingMessagesImportJob` | worker | on-demand | Fetch + persist full messages for one channel |
| `MessagingOngoingStaleCronJob` | cron | `0 * * * *` (hourly) | Reset channels stuck in `*_ONGOING` past a timeout back to pending |
| `MessagingRelaunchFailedMessageChannelsCronJob` | cron | `*/30 * * * *` | Retry channels in `FAILED` (transient) by re-pending them |
| `MessagingMessageChannelSyncStatusMonitoringCronJob` | cron | `2/10 * * * *` (every 10 min, offset 2) | Emit sync-health metrics/alerts |
| `MessagingAddSingleMessageToCacheForImportJob` | worker | on-demand | Inject one message into the import cache (manual/replay) |
| `MessagingInboundEmailImportJob` | worker | on-demand | Ingest an SES-delivered raw email |
| `MessagingBlocklistItemDeleteMessagesJob` | worker | on blocklist add | Delete messages from a blocked handle |
| `MessagingBlocklistReimportMessagesJob` | worker | on blocklist remove | Re-import messages from an unblocked handle |
| `MessagingConnectedAccountDeletionCleanupJob` | worker | on account delete | Cascade-delete messaging data |
| `MessagingMessageChannelDeletionCleanupJob` | worker | on channel delete | Cascade-delete channel data |
| `MessageParticipantMatchParticipantJob` | worker | on import | Match participants to People/Members |

CLI/admin commands (manual, not scheduled): single-message-import,
trigger-message-list-fetch, reset-channel, remove-orphans.

---

## Module: messaging-webhooks (`engine/core-modules/messaging-webhooks`)

**Purpose.** HTTP entry points for AWS SES inbound/outbound email notifications
delivered via SNS. This is the push side of email (vs. cron polling).

**HTTP endpoints** (`MessagingWebhooksController`, all POST):
- `POST /webhooks/messaging/ses/inbound` — incoming mail event.
- `POST /webhooks/messaging/ses/outbound` — delivery/bounce/complaint state for
  sent mail.
- (also registered under `webhooks/cloudflare`-style aliases per route arrays.)

**Services (all HTTP-triggered, not scheduled):**
- `sns-signature-verifier` — verifies the SNS message signature (security).
- `sns-subscription-confirmer` — auto-confirms SNS subscription handshakes.
- `ses-inbound-webhook-router` / `ses-inbound-mail-handler` — parse the inbound
  event, resolve the target workspace (via the SES resource ARN), and enqueue
  `MessagingInboundEmailImportJob`.
- `ses-outbound-webhook-router` / `ses-outbound-sending-state-handler` — update
  delivery state on sent messages.

Workspace resolution uses `parse-workspace-id-from-aws-ses-resource-arn.util`.
Exceptions are mapped to HTTP status via a dedicated filter.

---

## Module: messaging (`engine/core-modules/messaging`) — timeline read API

**Purpose.** GraphQL read API (NOT sync). `timeline-messaging.resolver` +
`timeline-messaging.service` + `get-messages.service` assemble threaded message
timelines for a record (person/company) for the UI, with participant
summarization and active-participant filtering. Pure read/formatting — **SIMPLE**.

---

## Module: calendar (`modules/calendar`) — calendar sync engine

**Purpose.** Mirror of the messaging engine for calendar events: import events
from Google Calendar / Microsoft Calendar / CalDAV, clean up, match participants,
and enforce blocklists. There is no outbound (event creation) pipeline here — it
is import-only.

Sub-areas: `calendar-event-import-manager`, `calendar-event-cleaner`,
`calendar-event-participant-manager`, `blocklist-manager`, `common`.

### Entities (workspace schema)

**CalendarEventWorkspaceEntity** — `title`, `isCanceled`, `isFullDay`,
`startsAt`/`endsAt`, `externalCreatedAt`/`externalUpdatedAt`, `description`,
`location`, `iCalUid`, `conferenceSolution`, `conferenceLink`. Relations:
channel-event associations + participants.

**CalendarChannelWorkspaceEntity** — same sync-machine shape as MessageChannel:
`handle`, `syncStatus`, `syncStage` (CalendarChannelSyncStage), `visibility`,
`isContactAutoCreationEnabled`/`contactAutoCreationPolicy`, `isSyncEnabled`,
`syncCursor`, `syncedAt`, `syncStageStartedAt`, `throttleFailureCount`,
`connectedAccountId`.

**CalendarEventParticipantWorkspaceEntity** — `handle`, `displayName`,
`isOrganizer`, `responseStatus` (NEEDS_ACTION / DECLINED / TENTATIVE / ACCEPTED),
FK to event, optional matched `person` / `workspaceMember`.

**CalendarChannelEventAssociationWorkspaceEntity** — join row linking channel ↔
event with external IDs (mirrors the message association pattern).

### Sync pipeline
Same two-phase model as messaging:
1. **Event-list fetch** — `calendar-event-list-fetch` enumerates event IDs since
   the cursor.
2. **Events import** — fetches full events + participants and persists them.

Driver dispatch on provider:
- **Google Calendar**: `google-calendar-get-events` (sync-token deltas).
- **Microsoft Calendar**: `microsoft-calendar-get-events` +
  `microsoft-calendar-import-events` (Graph deltaLink).
- **CalDAV**: `caldav-client` (DAV REPORT queries) → `caldav-fetch-events` /
  `caldav-get-events`, including its own auth helpers under `lib/auth`.

Cleaner deletes events on channel/connected-account deletion; participant manager
runs participant matching; blocklist manager deletes/re-imports events by handle.

### Background jobs

| Job / Cron | Type | Cadence | Role |
|---|---|---|---|
| `CalendarEventListFetchCronJob` | cron | `*/5 * * * *` | Schedule channels for event-list fetch, enqueue jobs |
| `CalendarEventListFetchJob` | worker | on-demand | Fetch event-id list for one channel |
| `CalendarEventsImportCronJob` | cron | `*/1 * * * *` | Schedule channels in import-pending, enqueue import jobs |
| `CalendarEventsImportJob` | worker | on-demand | Import full events for one channel |
| `CalendarOngoingStaleCronJob` | cron | `0 * * * *` | Reset stale `*_ONGOING` channels |
| `CalendarRelaunchFailedCalendarChannelsCronJob` | cron | `*/30 * * * *` | Retry FAILED channels |
| `CalendarEventParticipantMatchParticipantJob` | worker | on import | Match participants |
| `BlocklistItemDeleteCalendarEventsJob` | worker | on blocklist add | Delete events from blocked handle |
| `BlocklistReimportCalendarEventsJob` | worker | on blocklist remove | Re-import events |
| `CalendarChannelDeletionCleanupJob` | worker | on channel delete | Cascade cleanup |
| `DeleteConnectedAccountAssociatedCalendarDataJob` | worker | on account delete | Cascade cleanup |

Manual command: `calendar-trigger-event-list-fetch`.

---

## Module: calendar (`engine/core-modules/calendar`) — timeline read API
GraphQL read side: `timeline-calendar-event.resolver` + service + DTOs assemble
calendar-event timelines for a record. Pure read — **SIMPLE**.

---

## Module: connected-account (`modules/connected-account`) — OAuth & account lifecycle

**Purpose.** The shared credential/identity layer under both messaging and
calendar. Manages OAuth2 clients, access-token refresh, channel provisioning,
email aliases, the IMAP API client, and account deletion.

### Sub-areas & key services

**`refresh-tokens-manager`** — the heart of OAuth handling.
`ConnectedAccountRefreshTokensService.resolveTokens()`:
1. Checks `isAccessTokenStillValid` — for GOOGLE/MICROSOFT/APP a token is valid if
   `lastCredentialsRefreshedAt` is within ~1h minus a 5-min buffer; IMAP/OIDC/SAML/
   EMAIL_GROUP are always "valid" (no OAuth refresh).
2. If stale, decrypts the refresh token, calls the per-provider refresh service
   (`google-api-refresh-tokens` via google-auth-library /
   `microsoft-api-refresh-tokens` via MSAL / `app-oauth-refresh-tokens` for App
   connections), re-encrypts the new token pair, and writes it back with a fresh
   `lastCredentialsRefreshedAt`.
   Tokens are typed as encrypted-vs-plaintext branded strings to prevent mixing.
   Google/MSAL errors are normalized by dedicated parse-error utils (these set
   `authFailedAt` → reconnect banner).

**`oauth2-client-manager`** — builds provider OAuth2 clients (Google
`google-oauth2-client.provider`, Microsoft `microsoft-oauth2-client.provider` +
auth provider) used for token exchange and provider API calls.

**`channel-sync`** — `channel-sync.service` + resolver: provisions/refreshes the
message & calendar channels for an account and exposes GraphQL to trigger re-sync.

**`email-alias-manager`** — fetches send-as aliases from Google
(`gmail.settings.sendAs`) and Microsoft, populating `handleAliases`.

**`accounts-to-reconnect.service`** — tracks accounts whose auth failed so the UI
can prompt reconnection; tied to the dismiss-reconnect-banner DTO in core
messaging.

**`imap-api`** — IMAP client plumbing used by the IMAP message/folder drivers.

**Listeners** — `connected-account.listener` and
`connected-account-workspace-member.listener` react to account / workspace-member
events (e.g. deletion) and enqueue cleanup.

### Background jobs

| Job | Type | Trigger | Role |
|---|---|---|---|
| `DeleteWorkspaceMemberConnectedAccountsJob` | worker | workspace-member removed | Delete that member's connected accounts (cascades to messaging/calendar cleanup) |

Token refresh itself is **not** a scheduled job — it is lazy/on-demand inside
`resolveTokens()` at the start of each provider call.

---

## Module: contact-creation-manager (`modules/contact-creation-manager`)

**Purpose.** After messages/events import, auto-create Person + Company records
from participant email handles, honoring the channel's auto-creation policy and
non-professional/group-email exclusions.

`create-company-and-contact.service` derives companies from email domains and
people from handles; utils filter out generic/blocklisted domains.

### Background jobs

| Job | Type | Trigger | Role |
|---|---|---|---|
| `CreateCompanyAndContactJob` | worker | enqueued by import pipelines | Create/merge Company + Person from participants |

---

## Module: match-participant (`modules/match-participant`)

**Purpose.** Shared resolver that links message/calendar participants (by email
handle) to existing People and Workspace Members, and re-matches when a Person's
email changes. `MatchParticipantService` is generic over participant type and
exposes `matchParticipants`, `matchParticipantsForPeople`,
`matchParticipantsForWorkspaceMembers`. No own entities, no own jobs — invoked by
the participant-manager jobs of messaging/calendar. **MEDIUM** (pure logic, but
hot path).

---

## Module: imap-smtp-caldav-connection (`engine/core-modules`)

**Purpose.** GraphQL surface + validation for manually-configured IMAP/SMTP/CalDAV
accounts (non-OAuth). `imap-smtp-caldav-connection.resolver` saves connection
parameters; `ImapSmtpCaldavService` live-tests IMAP/SMTP/CalDAV connectivity
(`testImapConnection`, etc.) before persisting; the validator service +
Zod-style schemas validate host/port/credentials. Hosts are run through a
`secureHttpClientService.getValidatedHost` (SSRF protection). Passwords are
encrypted into `connectedAccount.connectionParameters`.

**MEDIUM-to-RUNTIME-HEAVY** — needs live IMAP/SMTP/CalDAV network clients and SSRF
guarding, but no background jobs of its own.

---

## Module: email (`engine/core-modules/email`) — transactional email

**Purpose.** App-level transactional/system email (verification, invites,
password reset) — distinct from user-mailbox messaging. Driver-based:
`email-driver.factory` selects `SmtpDriver` (nodemailer SMTP) or `LoggerDriver`
(logs instead of sending, for dev). `EmailService` / `EmailSenderService`
implement the driver interface (`send(SendMailOptions)`).

### Background jobs

| Job | Type | Trigger | Role |
|---|---|---|---|
| `EmailSenderJob` | worker (emailQueue) | enqueued by app flows | Send a templated transactional email asynchronously |

**MEDIUM** — needs an SMTP driver + queue, but small surface.

---

## Module: email-verification (`engine/core-modules/email-verification`)

**Purpose.** Email-address verification for signup. Generates a verification token
(via the auth email-verification-token service / app-token), builds a verification
link, and sends it through the email module. `resendEmailVerificationToken`
re-issues with rate limiting; throws if verification isn't required.
`sendVerificationEmail` + resolver expose the flow. **SIMPLE/MEDIUM** (token + one
email send).

---

## Module: emailing-domain (`engine/core-modules/emailing-domain`)

**Purpose.** Lets a workspace verify and send from its own sending domain via AWS
SES. Manages domain verification records (DKIM/SPF), status, and a multi-tenant
SES "tenant" status.

### Entity — EmailingDomainEntity (`core.emailingDomain`)

| Field | Type | Notes |
|---|---|---|
| `domain` | varchar (unique) | The sending domain |
| `driver` | enum | AWS_SES (only driver wired) |
| `status` | enum | PENDING → verified |
| `verificationRecords` | jsonb | DNS records the user must add (DKIM/SPF) |
| `verifiedAt` | timestamptz | |
| `tenantStatus` | enum | SES tenant state (ACTIVE default) |

**GraphQL mutations/queries** (`emailing-domain.resolver`): `createEmailingDomain`,
`verifyEmailingDomain`, `deleteEmailingDomain`, `sendEmailViaEmailingDomain`,
`getEmailingDomains`. Backed by `EmailingDomainDriverFactory` →
`AwsSesDriver` (creates SES identity, returns verification records, checks
verification, sends). `emailing-domain-tenant-status.service` manages SES tenancy.

### Background jobs

| Job | Type | Trigger | Role |
|---|---|---|---|
| `EmailingDomainWorkspaceCleanupJob` | worker (deleteCascadeQueue) | workspace deletion | Remove SES identities / domain rows for a deleted workspace |

**RUNTIME-HEAVY** — requires an AWS SES integration (identity + DKIM provisioning,
sending, tenant management) and the SES inbound/outbound webhook wiring above.

---

## Module: domain + dns-manager + cloudflare + public-domain — custom domains

These four modules together implement **custom/public domain provisioning** for
workspaces (white-label subdomains and customer-supplied custom domains), backed
by Cloudflare for Hostnames (SSL-for-SaaS).

### domain (`engine/core-modules/domain`)
Umbrella with four sub-modules: `subdomain-manager` (workspace `*.app` subdomains),
`custom-domain-manager` (customer domains), `workspace-domains` (resolve workspace
from hostname), `domain-server-config` (base URL / cookie domain config). Mostly
orchestration over dns-manager + cloudflare.

### dns-manager (`engine/core-modules/dns-manager`)
`DnsManagerService` wraps the Cloudflare SDK (Custom Hostnames API):
`registerHostname`, `getHostnameWithRecords`, `updateHostname`, `refreshHostname`,
`deleteHostname` / `deleteHostnameSilently`, `isHostnameWorking`, `getHostnameId`.
Returns the DNS records (CNAME / TXT) a customer must configure and reports SSL/
verification state. Validator guards that a Cloudflare client is configured.

### cloudflare (`engine/core-modules/cloudflare`)
**HTTP endpoint:** `DnsCloudflareController` →
`POST /cloudflare/custom-hostname-webhooks` (alias `webhooks/cloudflare`),
guarded by `CloudflareSecretGuard` (shared-secret header). `DnsCloudflareService`
(`checkHostname`) reacts to Cloudflare hostname status callbacks to mark a custom
domain validated/working.

### public-domain (`engine/core-modules/public-domain`)
Entity `core.publicDomain`: `domain` (unique), `isValidated`, optional
`applicationId`. Resolver/service let an application register a public domain;
validation status is updated from the Cloudflare webhook path. **MEDIUM** on its
own; **RUNTIME-HEAVY** because it depends on the Cloudflare integration to validate.

**Custom-domain modules verdict: RUNTIME-HEAVY** — require a live Cloudflare
account (Custom Hostnames / SSL-for-SaaS), an inbound webhook with secret
verification, and DNS-record orchestration.

---

## Parity notes

Tagging each module by port difficulty for a **Mongo + Rust + Next** stack.
"RUNTIME-HEAVY" = needs durable background workers, schedulers, and/or external
provider infra — not just a data port.

| Module | Tag | Why |
|---|---|---|
| messaging (modules) | RUNTIME-HEAVY | Two-phase sync state machine, 4 provider drivers (Gmail history API, Graph delta/$batch, IMAP UID sync, SES inbound), outbound send, folder reconciliation, cleaners, blocklist reactions — all driven by a job queue + 6 crons |
| messaging-webhooks | RUNTIME-HEAVY | SNS signature verification, subscription handshake, SES inbound/outbound routing → enqueue jobs (HTTP endpoints, but tied to AWS SES + queue) |
| messaging (core, timeline) | SIMPLE | Read-only GraphQL timeline assembly |
| calendar (modules) | RUNTIME-HEAVY | Same two-phase engine for Google/Microsoft/CalDAV; 4 crons + workers + cleaners |
| calendar (core, timeline) | SIMPLE | Read-only timeline assembly |
| connected-account | RUNTIME-HEAVY | OAuth2 client management + lazy token refresh (Google/MSAL/App), encrypted token storage with DB checks, alias fetch, channel provisioning, deletion cleanup job |
| contact-creation-manager | MEDIUM | Domain→Company / handle→Person derivation; one worker job, but logic-only |
| match-participant | MEDIUM | Pure matching logic; hot path, no jobs/entities of its own |
| imap-smtp-caldav-connection | MEDIUM→RUNTIME-HEAVY | Live IMAP/SMTP/CalDAV connection testing + SSRF-guarded host validation; no jobs |
| email (core) | MEDIUM | Driver-based transactional send (SMTP/logger) + one queue job |
| email-verification | SIMPLE/MEDIUM | Token issue + single email send |
| emailing-domain | RUNTIME-HEAVY | AWS SES identity/DKIM provisioning, verification polling, multi-tenant SES, cleanup job, inbound/outbound webhooks |
| domain / subdomain / custom-domain | RUNTIME-HEAVY | Cloudflare Custom Hostnames orchestration |
| dns-manager | RUNTIME-HEAVY | Direct Cloudflare SDK wrapper for hostname/SSL lifecycle |
| cloudflare | RUNTIME-HEAVY | Secret-guarded HTTP webhook reacting to Cloudflare hostname status |
| public-domain | MEDIUM (entity) / RUNTIME-HEAVY (validation) | Simple entity but validation depends on Cloudflare webhook |

### Build note for a Mongo + Rust + Next stack

To reach parity, the heavy lifting is **infrastructure, not schema**:

1. **Job queue + scheduler.** Twenty leans on BullMQ (Redis) for `messagingQueue`,
   `calendarQueue`, `cronQueue`, `emailQueue`, `contactCreationQueue`,
   `deleteCascadeQueue`. A Rust port needs an equivalent durable queue (e.g.
   Redis-backed `apalis`/`faktory`, or a Mongo-backed work queue) plus a cron
   scheduler honoring the patterns above. The state-machine pattern (cron flips
   `PENDING→SCHEDULED` and enqueues; worker runs `SCHEDULED→ONGOING→next PENDING`;
   separate "ongoing-stale" and "relaunch-failed" crons for recovery) should be
   reproduced verbatim — it is what makes sync resilient and idempotent.

2. **Per-tenant data isolation.** Twenty uses a Postgres schema per workspace.
   On Mongo this maps to a `workspaceId` discriminator on every messaging/calendar
   collection (message, message_channel, message_participant, message_folder,
   message_channel_message_association, message_thread, calendar_event,
   calendar_channel, calendar_event_participant, blocklist), with the connected
   account + emailing/public domain as core (shared-schema) collections.

3. **OAuth token store with encryption-at-rest.** Reproduce the `enc:v2:` encrypted
   access/refresh token columns and the lazy `resolveTokens()` refresh (validity =
   `lastRefreshedAt` within ~55 min). Rust has good Google/Microsoft OAuth +
   `aes-gcm` support; the Postgres CHECK constraints become app-level invariants
   in Mongo.

4. **Provider drivers.** Need Rust implementations (or a sidecar) for: Gmail API
   (history deltas), Microsoft Graph (`delta` + `$batch`), IMAP/SMTP
   (`async-imap` / `lettre`), and CalDAV (DAV REPORT). Each must support
   cursor-based incremental sync and throttle/backoff (the `throttleFailureCount` /
   `throttleRetryAfter` fields).

5. **External integrations.** AWS SES (identity/DKIM, send, inbound via SNS) and
   Cloudflare Custom Hostnames (SSL-for-SaaS) are required for the emailing-domain
   and custom-domain features; both expose secret-verified webhooks that must
   enqueue jobs. These are optional features — they can be deferred behind feature
   flags without blocking core mailbox/calendar sync.

6. **Next side.** The frontend only consumes the GraphQL read APIs
   (timeline-messaging, timeline-calendar) + channel-sync mutations + domain
   verification mutations. Those are thin and can be modeled as Next route handlers
   / server actions over the Rust/Mongo backend; the runtime weight stays in the
   worker tier.
