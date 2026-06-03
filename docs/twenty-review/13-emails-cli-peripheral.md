# 13 — Emails, Server CLI/Commands & Peripheral Packages

Read-only catalog of the vendored Twenty CRM (`services/sabcrm/packages`). Covers transactional
email templates (`twenty-emails`), server CLI / database commands & migration approach
(`twenty-server/src/command`, `twenty-server/src/database`), and a one-line triage of every
peripheral package. Descriptions are original; no source is reproduced verbatim.

---

## Emails

`twenty-emails` is a standalone package of React-Email templates. Templates are React components
(`.email.tsx`) that compose a small shared component kit and are localized with Lingui. They are
**not** sent from this package — the server (`twenty-server`) imports the component, calls
`render()` from `@react-email/render` to produce an HTML body (and a `plainText` variant), then
queues the message through the `emailQueue` → `EmailSenderService` → driver (SMTP or logger).

### Rendering approach
- **Library:** `@react-email/components` (`Html`, `Head`, `Body`, `Container`, `Img`, etc.) — email-safe primitives that compile to table-based inline-styled HTML.
- **Layout shell:** `BaseEmail` wraps every template — sets `<Html lang>`, injects `BaseHead`, renders the brand `Logo`, the body children, and a shared `Footer`, all inside a Lingui `I18nProvider`. Default container width 290px (templates override to 333px).
- **Shared component kit** (`src/components/`): `Title`, `SubTitle`, `MainText`, `Link`, `CallToAction` (button), `HighlightedContainer` / `HighlightedText` (the boxed workspace-logo block), `ShadowText`, `WhatIsTwenty` (brand blurb / footer promo), `Logo`, `BaseHead`, `Footer`.
- **i18n:** `createI18nInstance(locale)` builds a Lingui instance from `src/locales/generated/*.ts` (compiled from `.po` catalogs). ~30 locales supported. Strings use `i18n._()` / `<Trans>`; `serverUrl` + `getImageAbsoluteURI` resolve workspace-logo URLs to absolute. Each template exports `PreviewProps` for the React-Email dev preview server.
- **Theme:** `common-style.ts` (`emailTheme`) centralizes fonts/colors — the natural override point for the SabCRM B&W re-theme (already rebranded: titles, copy and preview URLs say "SabCRM" / `app.sabnode.com`).
- **Rich-text renderer:** `src/utils/email-renderer/` (`reactMarkupFromJSON`) converts TipTap `JSONContent` (nodes: paragraph, heading, bullet/ordered list, list-item, hard-break, variable-tag; marks: bold, italic, underline, strike, link) into React-Email markup. Used for **user-authored** emails (workflow "send email" action / compose), distinct from the fixed transactional templates below.

### Transactional templates

| Template (export) | File | When sent | Key props | Triggered by (server service) |
|---|---|---|---|---|
| `SendInviteLinkEmail` | `send-invite-link.email.tsx` | A workspace member invites someone to join a workspace | `link`, `workspace{name,logo}`, `sender`, `serverUrl`, `locale` | `workspace-invitation.service.ts` |
| `SendEmailVerificationLinkEmail` | `send-email-verification-link.email.tsx` | New signup must confirm email, **or** an existing user changes their email (`isEmailUpdate` toggles copy + CTA) | `link`, `locale`, `isEmailUpdate?` | `email-verification.service.ts` |
| `PasswordResetLinkEmail` | `password-reset-link.email.tsx` | User requests password reset / first-time password set (`hasPassword` toggles "Reset" vs "Set") | `duration`, `hasPassword`, `link`, `locale` | `reset-password.service.ts` |
| `PasswordUpdateNotifyEmail` | `password-update-notify.email.tsx` | Confirmation notice after a password is successfully changed | `userName`, `email`, `link`, `locale` | `reset-password.service.ts` |
| `SendApprovedAccessDomainValidation` | `validate-approved-access-domain.email.tsx` | Admin adds an approved/auto-join email domain and must validate ownership | `link`, `domain`, `workspace`, `sender`, `serverUrl`, `locale` | `approved-access-domain.service.ts` |
| `WarnSuspendedWorkspaceEmail` | `warn-suspended-workspace.email.tsx` | Subscription lapsed → workspace suspended; warns of pending deletion with a countdown | `daysSinceInactive`, `inactiveDaysBeforeDelete`, `userName`, `workspaceDisplayName`, `locale` | `cleaner.workspace-service.ts` (cron) |
| `CleanSuspendedWorkspaceEmail` | `clean-suspended-workspace.email.tsx` | Final notice — suspended workspace has now been permanently deleted | `daysSinceInactive`, `userName`, `workspaceDisplayName`, `locale` | `cleaner.workspace-service.ts` (cron) |
| `TestEmail` | `test.email.tsx` | Never in production — local dev / driver smoke-test only | `locale` | n/a |

---

## Server CLI / Commands

CLI is built on **`nest-commander`** (each command is a NestJS provider; `command.ts` bootstraps a
`CommandModule` that imports `AppModule` + `DatabaseCommandModule`). Commands run via
`nx run twenty-server:command:prod -- <name>`. Categories:

### Data seeding
| Command | What it does |
|---|---|
| `workspace:seed:dev` | Dev-only seed. Seeds Apple + YCombinator demo workspaces and two empty fixture workspaces (Empty3/Empty4) used by upgrade integration tests. `--light` seeds only Apple, skips demo custom objects, caps records at 5/object (for thin dev containers). Delegates to `DevSeederService`. |
| `generate:api-key` | Generates an API key for a workspace. |
| `install-pre-installed-apps` | Installs the bundled marketplace apps into the instance. |
| `application:rebuild-default-deps` | Rebuilds default dependency graph for applications/serverless functions. |

### Migrations & schema (database/upgrade)
| Command | What it does |
|---|---|
| `run-instance-commands` | Runs pending **legacy TypeORM migrations** (`dataSource.runMigrations`, transaction-per-migration) then all registered **fast** instance commands in version order; `--include-slow` also runs slow (data-migration) ones. Has a workspace-version safety gate (`--force` to bypass). The primary "apply schema" entrypoint. |
| `upgrade` | Runs the full **upgrade sequence** (instance + per-workspace commands) across all active/suspended workspaces. Flags: `--dry-run`, `--verbose`, `-w/--workspace-id` (repeatable), `--start-from-workspace-id`, `--workspace-count-limit`. |
| `generate:instance-command` | **Codegen** — diffs entity definitions vs DB (fast) or scaffolds a data-migration (slow) instance command file under `upgrade-version-command/<major-minor>/`, and auto-registers it in `instance-commands.constant.ts`. `--name`, `--type fast\|slow`, `--version`. |
| `upgrade:status` | Reports per-workspace upgrade progress/state. |
| `secret-encryption:rotate` | Re-encrypts stored secrets (connected-account tokens, application variables, connection params, sensitive config) under a new encryption key id. |
| `workspace:export` | Exports a workspace as SQL `INSERT` statements + schema DDL (backup / migration tooling). |
| `list-orphaned-workspace-entities` | Lists (and optionally deletes) core/metadata rows orphaned from deleted workspaces. |

### Cron
| Command | What it does |
|---|---|
| `cron:register:all` | One-shot registrar that enqueues **all** recurring background jobs into BullMQ. Registers ~25 crons: messaging sync (list-fetch, import, ongoing-stale, relaunch-failed), calendar sync (same set), workflow runner (cron-trigger, run-enqueue, handle-staled-runs, clean-runs), custom/public-domain DNS checks, workspace cleanup (suspended + onboarding), trash cleanup, event-log cleanup, marketplace catalog sync, application version check, enterprise key validation, signing-key rotation (config-gated), stale OAuth registration cleanup. Individual `*.cron.command.ts` files live next to their feature modules. |

### Command-runner base classes (`database/commands/command-runners/`)
- `MigrationCommandRunner` — abstract base adding `--dry-run`/`--verbose` and try/catch logging.
- `WorkspaceCommandRunner` — iterates over workspaces (filtered by activation status) via `WorkspaceIteratorService`; supports `-w`, `--start-from-workspace-id`, `--workspace-count-limit`, `--dry-run`. Base for per-workspace upgrade steps.
- `ActiveOrSuspendedWorkspaceCommandRunner` — preset filtering to active + suspended workspaces.

### Database / migration approach (`twenty-server/src/database`)
- **Two-tier schema migrations.** (1) **Legacy TypeORM migrations** — `database/typeorm/core/migrations/{common,billing}/*.ts` (~185 files: ~182 common + 3 billing), timestamp-prefixed, run against the `core` schema (`migrationsTableName: _typeorm_migrations`, `synchronize: false`). Datasource in `core.datasource.ts` reads `PG_DATABASE_URL`, conditionally includes billing entities/migrations only when `IS_BILLING_ENABLED`. (2) **Instance commands** — the newer, decorator-driven (`@RegisteredInstanceCommand(version, timestamp, {type})`) upgrade units under `database/commands/upgrade-version-command/<major-minor>/` (versions 1-21 … 2-9). Naming: `<ver>-instance-command-<fast|slow>-<ts>-<desc>.ts` and `<ver>-workspace-command-<ts>-<desc>.command.ts`. **fast** = schema/DDL changes; **slow** = DDL + data backfill (`runDataMigration`). Each declares `up`/`down`; committed up/down are never rewritten.
- **Per-workspace upgrade commands.** Workspace commands (extending `WorkspaceCommandRunner`) run the multi-tenant, per-workspace schema/metadata changes (one workspace = one Postgres schema). Examples in 1-21…2-9: backfilling `workspaceId` on indirect entities, migrating messaging/calendar to core, command-menu-item permission gating, AI-model-preference migration, billing-v2 migration.
- **PG helpers** (`database/pg/`): custom date-type OID parser. **Raw datasource** (`database/typeorm/raw/`): schemaless connection used by setup scripts. **Scripts** (`database/scripts/`): `setup-db.ts` (creates `public`/`core` schemas, `uuid-ossp`/`unaccent` extensions + immutable unaccent wrapper, optional FDW wrappers), `truncate-db.ts`, `setup-db-utils.ts`.
- **ClickHouse** (`database/clickHouse/`): separate analytics store — 6 SQL migrations (workspace-event, pageview, object-event, usage-event ×2, application-log tables), `run-migrations.ts`, seed fixtures. Optional/enterprise analytics; **not** required for core CRM.

---

## Peripheral packages

| Package | What it is | Relevant to CRM product? |
|---|---|---|
| `twenty-emails` | Transactional email templates (cataloged above) | **KEEP** — already ported to `src/lib/sabcrm/emails` |
| `twenty-server` | NestJS backend / API / worker (commands cataloged above) | **KEEP** (core; covered elsewhere) |
| `twenty-cli` | **Deprecated** CLI; README points users to `twenty-sdk` | SKIP (deprecated dev tooling) |
| `twenty-sdk` | Public TypeScript SDK for building Twenty apps/integrations against the API | SKIP for parity (external app-dev tooling); revisit only if exposing a public app platform |
| `twenty-client-sdk` | Generated typed GraphQL client (`core`, `metadata`, `generate`) for consuming the API | SKIP for parity (the front-end has its own Apollo client) |
| `create-twenty-app` | `npx` scaffolder that bootstraps a new Twenty app/integration project | SKIP (dev/build tooling) |
| `twenty-zapier` | Zapier integration ("sync with 3000+ apps") — triggers/actions over the REST API | SKIP for parity (SabNode has SabFlow for automation); optional future integration |
| `twenty-apps` | Bundled marketplace app definitions: `community`, `examples`, `internal`, `fixtures` | MOSTLY SKIP — `internal`/`fixtures` may matter if pre-installed apps ship by default; otherwise skip |
| `twenty-website` | Next.js marketing/docs site (twenty.com) | SKIP (replaced by SabNode marketing site) |
| `twenty-e2e-testing` | Playwright end-to-end test suite | SKIP (dev/QA tooling) |
| `twenty-utils` | Repo maintenance scripts (Danger, Crowdin translation QA, docs-tag fixes, `setup-dev-env.sh`) | SKIP (dev/build tooling) |
| `twenty-oxlint-rules` | Custom oxlint lint rules for the monorepo | SKIP (dev tooling) |
| `twenty-companion` | `twenty-desktop` — Electron desktop wrapper, explicitly a non-production POC | SKIP (POC) |
| `twenty-front-component-renderer` | Sandbox/host for rendering remote (3rd-party app) front-end components in isolation | SKIP for parity (only needed for the app-extension platform) |
| `twenty-docker` | Deployment assets: docker-compose (dev/prod), Helm, k8s, Grafana, OTel collector, podman | SKIP — SabNode is self-hosted PM2/Mongo/Redis/R2, not this stack |
| `twenty-docs` | Mintlify documentation site | SKIP (docs site) |
| `twenty-front` / `twenty-ui` / `twenty-shared` | Front-end app / UI lib / shared utils | (core — covered in other review docs) |

---

## Parity notes

A port of `twenty-emails` already exists at **`src/lib/sabcrm/emails/`** (full mirror: all 8
templates, the shared component kit, the TipTap email-renderer, i18n utils, `common-style`). It is
already rebranded to SabCRM. The rendering stack (React-Email + Lingui) is self-contained and
brand-themable via `common-style.ts`.

Triage of which transactional emails matter for a plan-based, multi-tenant SabNode:

- **SIMPLE — invites & auth notifications (port + wire up first).** `SendInviteLinkEmail`,
  `SendEmailVerificationLinkEmail`, `PasswordResetLinkEmail`, `PasswordUpdateNotifyEmail`. These are
  product-level transactional emails every SaaS needs; they map cleanly onto SabNode's existing
  auth + team-invite flows. Render with `@react-email/render`, send through SabNode's existing mail
  pipeline (do not stand up Twenty's BullMQ `emailQueue` separately).

- **SIMPLE/plan-gated — admin/workspace notices.** `SendApprovedAccessDomainValidation`
  (auto-join domain) and the suspension pair `WarnSuspendedWorkspaceEmail` /
  `CleanSuspendedWorkspaceEmail`. The suspension emails are **billing/plan-driven** and depend on a
  subscription-lifecycle + workspace-cleaner cron. In SabNode, drive these from the existing
  plan/billing + cron machinery rather than Twenty's `cleaner.workspace-service` + `cron:register:all`.
  MEDIUM only because of the lifecycle wiring, not the template.

- **RUNTIME-HEAVY — email *sync*, not transactional templates.** The heavy email surface in Twenty
  is **inbound/outbound mailbox sync** (messaging import/calendar crons, message-cleaner,
  connected-account token encryption) — entirely separate from `twenty-emails`. This is real
  infrastructure (IMAP/Gmail sync workers, BullMQ, ClickHouse usage events) and should be treated as
  a deferred, optional module, not part of the initial transactional-email parity.

- **SKIP outright:** `TestEmail` (dev smoke-test), the TipTap `email-renderer` unless/until the
  workflow "send email" action / compose feature is ported (it powers user-authored emails, not
  transactional ones), and the entire CLI/migration/cron command layer — SabNode supplies its own
  seeding, migrations (Mongo, not Postgres/TypeORM), and Vercel/PM2 cron scheduling, so Twenty's
  `nest-commander` commands, TypeORM/ClickHouse migrations and `cron:register:all` registrar are
  **reference-only**, not ported.
