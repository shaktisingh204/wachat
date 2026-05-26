# SabNode — Master Feature & Page Map

> **Purpose:** A single source of truth that maps every public site page, dashboard module, sub‑module, and API surface area inside SabNode. This is the canvas we will plan against — every future work item should reference a route from this file.
>
> **Stack:** Next.js 16 (App Router) · Multi-tenant SaaS · Mongo + Firebase + Redis · PM2 workers · Dual auth (user + admin) · Plan-gated, credit-metered, RBAC-guarded
>
> **Route roots:**
> - `/` — marketing / public site
> - `/dashboard` — authenticated tenant workspace (37+ modules)
> - `/wachat` — WhatsApp Cloud API workspace (top-level, 76+ feature pages)
> - `/admin` — staff console
> - `/sign`, `/share`, `/s`, `/p`, `/web`, `/embed` — public / shareable surfaces
>
> **Legend:** ✅ exists in repo · 🟡 partial · ⬜ planned · 🔒 RBAC/plan-gated

---

## Table of Contents

1. [Public / Marketing Site](#1-public--marketing-site)
2. [Auth & Onboarding](#2-auth--onboarding)
3. [Dashboard Home & Shell](#3-dashboard-home--shell)
4. [WaChat — WhatsApp Cloud API](#4-wachat--whatsapp-cloud-api-wachat)
5. [SabWa — Personal WhatsApp](#5-sabwa--personal-whatsapp-planned)
6. [SabFlow — Visual Automation](#6-sabflow--visual-automation)
7. [SabChat — Live Chat Widget](#7-sabchat--live-chat-widget)
8. [SabFiles — File Manager](#8-sabfiles--file-manager)
9. [CRM Suite](#9-crm-suite)
10. [HRM Suite](#10-hrm-suite)
11. [Sales CRM](#11-sales-crm)
12. [Accounting & Inventory](#12-accounting--inventory)
13. [Email Marketing](#13-email-marketing)
14. [SMS Module](#14-sms-module)
15. [Meta Suite — Facebook · Instagram · Ad Manager](#15-meta-suite--facebook--instagram--ad-manager)
16. [Telegram Module](#16-telegram-module)
17. [SEO Module](#17-seo-module)
18. [Website Builder](#18-website-builder)
19. [Custom eCommerce / Shop](#19-custom-ecommerce--shop)
20. [Portfolio Builder](#20-portfolio-builder)
21. [URL Shortener](#21-url-shortener)
22. [QR Code Maker](#22-qr-code-maker)
23. [n8n Integration](#23-n8n-integration)
24. [Marketplace](#24-marketplace)
25. [Team & Collaboration](#25-team--collaboration)
26. [Settings, Billing, Plans, API Keys](#26-settings-billing-plans-api-keys)
27. [Public / Embed / Share Surfaces](#27-public--embed--share-surfaces)
28. [Admin Console](#28-admin-console)
29. [API Surface (REST)](#29-api-surface-rest)
30. [Workers, Crons & Background Services](#30-workers-crons--background-services)
31. [Cross-cutting Concerns](#31-cross-cutting-concerns)
32. [Planning Conventions](#32-planning-conventions)

---

## 1. Public / Marketing Site

Route root: `/`

| Route | Purpose |
|---|---|
| `/` ✅ | Landing page |
| `/about-us` ✅ | Company story |
| `/pricing` ✅ | Plans & price grid |
| `/products` ✅ | Product index |
| `/features/[slug]` ✅ | Per-feature deep-dive (dynamic) |
| `/customers` ✅ | Customer logos / case studies |
| `/enterprise` ✅ | Enterprise pitch page |
| `/partners` ✅ | Partner program |
| `/careers` ✅ | Jobs board |
| `/contact` ✅ | Contact form |
| `/blog` ✅ | Blog index |
| `/resources` ✅ | Guides / downloads |
| `/clay-showcase` ✅ | Design showcase |
| `/privacy-policy` ✅ | Legal |
| `/terms-and-conditions` ✅ | Legal |
| `/status/[shareId]` ✅ | Public status page (shareable) |
| `/sitemap.xml`, `/robots.txt` ✅ | SEO |
| `/_domain/[host]` ✅ | Custom-domain landing (for tenants) |

**Open items:** changelog, security page, compare‑vs‑competitor pages, integration directory.

---

## 2. Auth & Onboarding

| Route | Purpose |
|---|---|
| `/login` ✅ | User login |
| `/signup` ✅ | Self-serve signup |
| `/forgot-password` ✅ | Password reset |
| `/admin-login` ✅ | Staff login (separate cookie) |
| `/invite` ✅ | Team invite accept |
| `/pending-approval` ✅ | Awaiting admin/manager approval |
| `/logout` ✅ | Session teardown |
| `/onboarding` ✅ | First-run wizard (workspace, plan, modules) |
| `/setup` ✅ | Per-module setup hub |
| `/auth/*` ✅ | OAuth callbacks (Meta, Google, Telegram, etc.) |

---

## 3. Dashboard Home & Shell

Route root: `/dashboard`

- `/dashboard` ✅ — universal workspace home (module switcher, KPIs, recent activity)
- `/dashboard/layout.tsx` ✅ — global rail + topbar shell, plan/credit/role guards
- `/dashboard/loading.tsx` ✅ — skeleton
- `/dashboard/notifications` ✅ — inbox
- `/dashboard/notification-preferences` ✅ — channel matrix
- `/dashboard/information` ✅ — broadcast banner / system messages
- `/dashboard/credit-usage` ✅ — credit ledger by module
- `/dashboard/profile` ✅ — quick profile view
- `/dashboard/user/{profile,billing,settings}` ✅ — legacy user surfaces
- `/dashboard/setup/{,docs}` ✅ — wizard + docs

---

## 4. WaChat — WhatsApp Cloud API (`/wachat`)

77 top-level feature pages. Group them by role:

### 4.1 Messaging core
`overview` · `chat` · `chat-export` · `chat-labels` · `chat-ratings` · `chat-transfer` · `conversation-filters` · `conversation-kanban` · `conversation-search` · `conversation-summary` · `saved-replies` · `canned-messages` · `quick-reply-categories` · `interactive-messages` · `scheduled-messages`

### 4.2 Broadcasts & Campaigns
`broadcasts` · `broadcast-cron` · `broadcast-history` · `broadcast-scheduler` · `broadcast-segments` · `bulk` · `bulk-messaging` · `campaign-ab-test` · `delivery-reports` · `link-tracking`

### 4.3 Templates
`templates` · `template-builder` · `template-analytics` · `message-templates-library`

### 4.4 Contacts & Audiences
`contacts` · `contact-blacklist` · `contact-groups` · `contact-import-history` · `contact-merge` · `contact-notes` · `contact-timeline` · `blocked-contacts` · `opt-out`

### 4.5 Automation
`automation` · `auto-reply` · `auto-reply-rules` · `away-messages` · `greeting-messages` · `chatbot` · `flow-builder` · `flows`

### 4.6 Numbers, Settings & Health
`numbers` · `phone-number-settings` · `two-line` · `business-hours` · `agent-availability` · `settings` · `health`

### 4.7 Team Operations
`assignments` · `team-performance` · `customer-satisfaction` · `response-time-tracker` · `message-tags`

### 4.8 Catalog, Pay & Ads
`catalog` · `whatsapp-pay` · `whatsapp-ads` · `whatsapp-link-generator` · `qr-codes` · `post-generator`

### 4.9 Analytics & Reporting
`analytics` · `message-analytics` · `message-statistics`

### 4.10 Integrations & Dev
`integrations` · `media-library` · `webhooks` · `webhook-logs` · `calls`

### 4.11 Backing dashboard surface
`/dashboard/wachat/{page.tsx,contacts}` ✅ — embed of selected wachat surfaces inside the dashboard rail (sync the duplicate routes during this plan).

---

## 5. SabWa — Personal WhatsApp (planned)

Detailed plan already lives in `SABWA_PLAN.md`. Route root `/sabwa` (⬜ not yet scaffolded). 30 pages slated. Coordinate with §4 to share contact, label, broadcast scheduling, and AI infra.

---

## 6. SabFlow — Visual Automation

Route root: `/dashboard/sabflow`

| Route | Purpose |
|---|---|
| `/dashboard/sabflow` ✅ | Workflow list |
| `/dashboard/sabflow/[flowId]` ✅ | Editor / run logs |
| `/dashboard/sabflow/flow-builder` ✅ | Visual builder |
| `/dashboard/sabflow/connections` ✅ | OAuth + credential vault |
| `/dashboard/sabflow/workspaces` ✅ | Multi-workspace |
| `/dashboard/sabflow/invites` ✅ | Collaborator invites |
| `/dashboard/sabflow/logs` ✅ | Execution logs |
| `/dashboard/sabflow/settings` ✅ | Org defaults |
| `/dashboard/sabflow/docs` ✅ | Inline docs |
| `/flow/[flowId]` ✅ | Public-shareable flow viewer |
| API: `/api/sabflow/*` ✅ | Trigger / run / connect |

---

## 7. SabChat — Live Chat Widget

Route root: `/dashboard/sabchat`

`page.tsx` ✅ · `inbox` ✅ · `visitors` ✅ · `analytics` ✅ · `widget` ✅ · `settings` ✅ · `ai-replies` ✅ · `auto-reply` ✅ · `quick-replies` ✅ · `faq` ✅ · `_components` ✅

Public surface: `/embed/chat` ✅ (iframe widget loader)

---

## 8. SabFiles — File Manager

Route root: `/dashboard/sabfiles`

`page.tsx` ✅ · `folder` ✅ · `recent` ✅ · `shared` ✅ · `starred` ✅ · `storage` ✅ · `trash` ✅

Public link: `/share/[token]` ✅

**Rule (from `CLAUDE.md`):** every file input across SabNode sources from `<SabFilePicker>` / `<SabFileUrlInput>` / `<SabFilePickerButton>` / `<SabFileToFileButton>`. No free‑text URL paste anywhere. Picker has **Library + Upload** only.

---

## 9. CRM Suite

Route root: `/dashboard/crm`

### 9.1 Core records
`contacts` · `accounts` · `leads` (+ `[id]` + `new`) · `deals` · `tasks` · `tickets` · `bookings` · `contracts` · `service-contracts` · `purchases` · `sales`

### 9.2 Workspace & ops
`page.tsx` (CRM home) · `workspace` · `activity` · `mentions` · `messages` · `notifications` · `pinned` · `search` · `email` · `files` · `team`

### 9.3 Projects & Tasks
`projects` (+ `[projectId]`, `kanban`, `gantt`, `issues`, `milestones`, `subtasks`, `labels`, `categories`, `task-categories`, `task-labels`, `task-tags`, `taskboard-columns`, `activity`, `new`)

### 9.4 Automation, Forms, Setup
`automations` (+ `docs`) · `auto-leads-setup` · `audit-log` · `analytics` · `dashboards` · `reports` · `conversions` · `time-tracking` · `integrations` · `settings` · `setup` · `portal` · `products`

### 9.5 Subsystems (separate sections below)
`hr` · `hr-payroll` · `sales-crm` · `accounting` · `inventory` · `banking` · `loans` · `budgets` · `fixed-assets` · `petty-cash`

---

## 10. HRM Suite

Two roots — keep them in sync (legacy under `/dashboard/hrm`, primary under `/dashboard/crm/hr*`).

### 10.1 HR core — `/dashboard/crm/hr`
`page.tsx` · `directory` · `org-chart` · `jobs` · `candidates` · `interviews` · `offers` · `onboarding` · `welcome-kit` · `probation` · `exits` · `documents` · `document-templates` · `policies` · `announcements` · `recognition` · `feedback-360` · `surveys` · `one-on-ones` · `okrs` · `goal-setting` (via payroll) · `learning-paths` · `training` · `certifications` · `succession` · `careers-page` · `compensation-bands` · `expense-claims` · `assets` · `asset-assignments` · `timesheets` · `travel`

### 10.2 Payroll & compliance — `/dashboard/crm/hr-payroll`
`page.tsx` · `employees` · `departments` · `designations` · `salary-structure` · `payroll` · `payslips` · `attendance` · `leave` · `shifts` · `shift-rotations` · `shift-change-requests` · `holidays` · `appraisal-reviews` · `kpi-tracking` · `goal-setting` · `pf-esi` · `professional-tax` · `tds` · `form-16` · `reports` · `settings`

### 10.3 Legacy `/dashboard/hrm/{,hr,payroll}` ✅
Plan: redirect/alias into the CRM-namespaced routes.

---

## 11. Sales CRM

Route root: `/dashboard/crm/sales-crm`

`page.tsx` · `leads` · `all-leads` · `leads-summary` · `pipelines` · `all-pipelines` · `pipeline-stages` · `deals` · `contacts` · `agents` · `forms` · `custom-forms` · `categories` · `sources` · `statuses` · `notes` · `tasks` · `products` · `automations` · `consent` · `client-performance-report` · `lead-source-report` · `team-sales-report` · `settings`

---

## 12. Accounting & Inventory

### 12.1 Accounting — `/dashboard/crm/accounting`
`page.tsx` · `vouchers` · `day-book` · `groups` · `charts` · `pnl` · `income-statement` · `balance-sheet` · `cash-flow` · `trial-balance`

### 12.2 Inventory — `/dashboard/crm/inventory`
`page.tsx` · `items` · `warehouses` · `vendors` · `adjustments` · `all-transactions` · `party-transactions` · `purchase-orders` · `grn` · `production-orders` · `bom` · `batch-expiry` · `stock-value` · `pnl`

### 12.3 Treasury — `/dashboard/crm/{banking,loans,budgets,fixed-assets,petty-cash}` ✅

---

## 13. Email Marketing

Route root: `/dashboard/email`

`page.tsx` · `inbox` · `campaigns` · `contacts` · `templates` · `analytics` · `verification` · `settings`

---

## 14. SMS Module

Route root: `/dashboard/sms`

`page.tsx` · `campaigns` · `templates` · `logs` · `config` · `developer` · `quick-send-dialog.tsx`

API: `/api/sms/*` ✅

---

## 15. Meta Suite — Facebook · Instagram · Ad Manager

### 15.1 Meta Suite hub — `/dashboard/meta-suite` ✅

### 15.2 Facebook — `/dashboard/facebook`
`page.tsx` · `setup` · `pages` · `all` · `all-projects` · `page-roles` · `messenger-settings` · `webhooks` · `auto-reply` · `agents` · `flow-builder` · `knowledge` · `kanban` · `messages` · `subscribers` · `visitor-posts` · `comments` · `moderation` · `reviews` · `competitors` · `audience` · `insights` · `leads` · `events` · `commerce` · `catalog` · `custom-ecommerce` · `create-post` · `posts` · `scheduled` · `bulk-create` · `post-randomizer` · `calendar` · `albums` · `media` · `reels` · `stories` · `live-studio` · `ads` · `broadcasts` · `roadmap` · `settings`

### 15.3 Instagram — `/dashboard/instagram`
`page.tsx` · `setup` · `connections` · `messages` · `feed` · `create-post` · `media` · `reels` · `stories` · `hashtag-search` · `discovery`

### 15.4 Ad Manager — `/dashboard/ad-manager`
`page.tsx` · `ad-accounts` · `campaigns` · `ad-sets` · `ads` · `ad-previews` · `creative-library` · `audiences` · `customer-lists` · `lead-forms` · `pixels` · `capi` · `events-manager` · `custom-conversions` · `conversion-funnel` · `catalogs` · `automated-rules` · `budget-optimizer` · `bulk-editor` · `split-tests` · `compare` · `calendar` · `create` · `insights` · `reports` · `ai-lab` · `billing` · `settings`

---

## 16. Telegram Module

Route root: `/dashboard/telegram`

`page.tsx` · `connections` · `api-credentials` · `bots` · `commands` · `webhooks` · `channels` · `chat` · `business-inbox` · `contacts` · `broadcasts` · `auto-reply` · `flows` · `ads` · `payments` · `stories` · `stickers` · `mini-apps` · `projects` · `analytics` · `settings`

API: `/api/telegram/*` ✅

---

## 17. SEO Module

Route root: `/dashboard/seo`

`page.tsx` · `[projectId]` (per-project workspace) · `site-explorer` · `brand-radar` · `tools` · `experts` · `callback`

API: `/api/seo-tools/*` + `/api/indexnow-key/*` ✅

---

## 18. Website Builder

Route root: `/dashboard/website-builder`

`page.tsx` · `manage`

Public render: `/web/[slug]` ✅
Builder canvas: `/builder/[id]` ✅ (also `/builder/page.tsx`)

API: `/api/builder/*` ✅

---

## 19. Custom eCommerce / Shop

- `/dashboard/shop` ✅ — owner console (stub – expand)
- `/dashboard/custom-ecommerce/flow-builder` ✅ — funnel/flow editor
- `/shop/[slug]` ✅ — public storefront

---

## 20. Portfolio Builder

- `/dashboard/portfolio` ✅ · `/dashboard/portfolio/manage` ✅
- `/portfolio/[slug]` ✅ — public site

---

## 21. URL Shortener

- `/dashboard/url-shortener` ✅ · `[id]` ✅ · `settings` ✅
- `/s/[shortCode]` ✅ — redirect surface
- `/[shortCode]` ✅ — root-level short link (verify priority vs marketing routes)

---

## 22. QR Code Maker

- `/dashboard/qr-code-maker` ✅ · `settings` ✅

---

## 23. n8n Integration

- `/dashboard/n8n` ✅ · `[workflowId]` ✅
- External self-hosted n8n in `/n8n-master` of repo

---

## 24. Marketplace

- `/dashboard/marketplace` ✅ · `installed` ✅
- API: `/api/marketplace/*` ✅

---

## 25. Team & Collaboration

Route root: `/dashboard/team`

`page.tsx` · `manage-users` · `manage-roles` · `invites` · `activity` · `tasks` · `team-chat` · `notifications` · `settings`

---

## 26. Settings, Billing, Plans, API Keys

### 26.1 Settings — `/dashboard/settings`
`page.tsx` · `profile` · `appearance` · `ui` · `security` · `notifications` · `billing` · `invoices` · `credits` · `integrations` · `whatsapp` · `api-keys` · `webhooks`

### 26.2 Billing — `/dashboard/billing`
`page.tsx` · `history`

### 26.3 Plans — `/dashboard/plans`
`page.tsx` · `[planId]`

### 26.4 API keys (top-level) — `/dashboard/api-keys` ✅

---

## 27. Public / Embed / Share Surfaces

| Route | Purpose |
|---|---|
| `/p/lead-form` ✅ | Public CRM lead form |
| `/p/ticket-form` ✅ | Public support form |
| `/p/contract` ✅ | Public contract view |
| `/p/proposal` ✅ | Public proposal |
| `/p/estimate` ✅ | Public estimate |
| `/p/invoice` ✅ | Public invoice |
| `/p/gdpr` ✅ | GDPR consent form |
| `/p/thanks` ✅ | Thank-you page |
| `/sign/[contractId]` ✅ | E-signature flow |
| `/share/[token]` ✅ | SabFiles public link |
| `/s/[shortCode]` ✅ | URL shortener redirect |
| `/web/[slug]` ✅ | Website builder render |
| `/shop/[slug]` ✅ | Storefront |
| `/portfolio/[slug]` ✅ | Portfolio |
| `/status/[shareId]` ✅ | Status page |
| `/embed/chat` ✅ | Chat widget iframe |
| `/embed/crm-form` ✅ | CRM form iframe |
| `/_domain/[host]` ✅ | Custom domain entry |

---

## 28. Admin Console

Route root: `/admin/dashboard`

`page.tsx` · `users` · `plans` · `whatsapp-projects` · `template-library` · `broadcast-log` · `flow-logs` · `audit` · `system`

> Architecture (per memory): httpOnly server-side cookie, dark zinc/amber UI, server-guarded layout.

**Gaps to add:** marketplace approvals, refunds, credit-grant ledger, abuse / banlist, SLA dashboard.

---

## 29. API Surface (REST)

Route root: `/api`

`auth` · `builder` · `calls` · `crm` (+ `auth`, `automations`, `forms`) · `cron` · `docs` · `embed` · `indexnow-key` · `marketplace` · `partners` · `payments` · `sabchat` · `sabfiles` · `sabflow` · `scim` · `seo-tools` · `sign` · `sms` · `status` · `telegram` · `v1` · `wachat` (+ `flows`) · `webhooks` · `widget`

> `/api/v1/*` is the public-stable surface. Everything else is internal — flag any external consumer in tickets.

---

## 30. Workers, Crons & Background Services

- `worker.js`, `server.js`, `workers/`, `ecosystem.config.js` ✅ — PM2 fleet
- `scripts/` ✅ — ops scripts
- `rust/` ✅ — native acceleration (broadcast worker cutover per `BROADCAST_WORKER_CUTOVER.md`)
- `/api/cron/*` ✅ — Vercel cron entry points
- Redis queues power: WaChat broadcasts, SabFlow runs, Email/SMS sends, scheduled posts, analytics rollups

---

## 31. Cross-cutting Concerns

Each module plan must answer all eight, even briefly:

1. **Multi-tenancy** — projectId scoping (every query, every cache key)
2. **Plan gating** — which plan tier unlocks the feature; soft / hard limits
3. **Credit metering** — what action burns credits, ledger entry shape
4. **RBAC** — owner / admin / manager / agent / viewer; per-action permission key
5. **Audit log** — write events (who, what, when, before/after)
6. **Notifications** — in-app, email, push, webhook channels
7. **SabFiles compliance** — all file inputs via picker components (no URL paste)
8. **Observability** — structured logs, metrics, error surfacing in admin console

---

## 32. Planning Conventions

When we open the next plan file (per module or per feature):

1. **Filename:** `PLAN_<module>_<topic>.md` at repo root (e.g. `PLAN_wachat_broadcast_v2.md`).
2. **Front-matter table:** route, owner, status, plan tier, credits cost, RBAC keys.
3. **Page-by-page UI breakdown** — list of states (empty, loading, error, paginated, mobile).
4. **Server actions inventory** — one bullet per action with input/output types.
5. **Data model diff** — Mongo collections touched, indexes added.
6. **Worker / cron impact** — new queues, schedule, idempotency keys.
7. **Migration plan** — backfills, dual-write windows, kill switches.
8. **Rollout** — flag name, ramp %, success metric, rollback steps.
9. **Test plan** — unit + integration + manual checklist.
10. **Open questions** — list, do not bury.

> Track all module plans from this index. When a plan ships, mark the corresponding ✅ in this file and link the PR.

---

## Appendix A — Quick counts

| Surface | Count |
|---|---|
| Dashboard modules (top-level under `/dashboard`) | 37 |
| WaChat feature pages | 77 |
| CRM sub-pages (incl. HR, payroll, sales, accounting, inventory) | 150+ |
| Public marketing pages | 15 |
| Public / share / embed surfaces | 18 |
| API route trees under `/api` | 24 |

## Appendix B — Source-of-truth files already in repo

- `README.md` — repo overview
- `SERVER-SETUP.md` — infra
- `SABWA_PLAN.md` — SabWa module plan (30 pages)
- `SABNODE_ECOSYSTEM_1000.md`, `SABNODE_ECOSYSTEM_30K` — long-form ecosystem notes
- `META_SUITE_ZORUUI_TASKS.md`, `WACHAT_ZORUUI_TASKS.md`, `ZORUUI_TASKS.md` — UI work tracks
- `PLAN_REAL_PAGES.md` — earlier page inventory (supersede with this file)
- `CHANGELOG-wachat-J1-J2.md` — WaChat changelog
- `BROADCAST_WORKER_CUTOVER.md` — worker migration
- `crm_function_plan.md`, `facebook_function_plan.md` — feature plans
- `graphify-out/GRAPH_REPORT.md` — code graph (read first for cross-module questions)

---

**Next step:** pick the module you want to plan first. Reply with the section number (e.g. "§4 WaChat broadcasts" or "§10 HRM onboarding") and I'll open a dedicated `PLAN_<module>_<topic>.md` using the conventions in §32.
