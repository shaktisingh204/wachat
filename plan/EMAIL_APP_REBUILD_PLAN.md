# Email App Rebuild — Mailchimp-Parity, ZoruUI-Native

**Owner:** SabNode Email Suite
**Scope target:** Mailchimp feature parity (campaigns, automations, journeys, templates, audiences, reports, deliverability, inbox)
**UI system:** 100% ZoruUI (`@/components/zoruui`) — no shadcn / no raw HTML form controls
**Status:** Planning — implementation has NOT started

---

## 1. Why rebuild

The current email app at `src/app/dashboard/email/` exists but is a thin shell:

- 8 pages, each a single `page.tsx` with no nested routes (`page`, `inbox`, `campaigns`, `contacts`, `templates`, `analytics`, `verification`, `settings`)
- ~12 supporting components in `src/components/wabasimplify/email-*` mixing Zoru and legacy primitives
- 182 API files under `/api/v1/email/**` — heavy on subscribers/lists/templates/suppressions plumbing, light on campaign engine, **no automation engine, no journey builder, no segment engine, no drag-and-drop template builder, no landing pages**
- `src/app/actions/email.actions.ts` has 21 actions — covers contacts, templates, conversations, settings; **missing**: segments, automations, journeys, A/B tests, send-time optimization, behavioral triggers
- Inbox is conversation-list only; no shared inbox, no assignment, no SLA, no reply templates
- No deliverability score, no warmup, no inbox-placement preview
- Verification page is DNS check only — no DKIM rotation, no DMARC enforcement, no domain reputation

We need a ground-up rebuild that matches the Mailchimp surface area but stays SabNode-native (multi-tenant, plan-gated, credit-metered, Mongo-backed, Vercel-deployed).

## 2. Target feature map (Mailchimp parity)

| Mailchimp pillar       | SabNode delivery                                     | Routes                                                              |
| ---------------------- | ---------------------------------------------------- | ------------------------------------------------------------------- |
| Audience               | Lists + segments + tags + custom fields + GDPR       | `/dashboard/email/audience/{lists,segments,tags,fields,signup}`     |
| Campaigns              | Regular, A/B, RSS, plain-text, transactional         | `/dashboard/email/campaigns/{new,[id]/{edit,preview,report}}`       |
| Automations / Journeys | Visual journey builder (drip, behavioral, lifecycle) | `/dashboard/email/journeys/{new,[id]/{canvas,settings,report}}`     |
| Templates              | Drag-drop builder, HTML, code, library, AMP          | `/dashboard/email/templates/{builder,[id],library,blocks}`          |
| Content                | Brand kit, asset library, AI subject lines           | `/dashboard/email/content/{brand,assets,ai-assistant}`              |
| Reports                | Per-campaign, per-journey, comparative, revenue      | `/dashboard/email/reports/{campaigns,journeys,compare,revenue}`     |
| Inbox                  | Unified inbox, replies, assign, SLA, tags            | `/dashboard/email/inbox/{[threadId],filters,assignments}`           |
| Forms                  | Embedded, popup, landing pages, signup forms         | `/dashboard/email/forms/{[id],landing,popup}`                       |
| Deliverability         | SPF/DKIM/DMARC, warmup, placement, reputation        | `/dashboard/email/deliverability/{domains,warmup,placement,score}`  |
| Integrations           | Mailchimp/Brevo/Sendgrid sync, webhooks, API keys    | `/dashboard/email/integrations/{providers,webhooks,api,oauth}`      |
| Settings               | Senders, branding, compliance, team, plan            | `/dashboard/email/settings/{senders,branding,compliance,team,plan}` |

## 3. Information architecture

```
/dashboard/email
├─ page.tsx                          → Overview dashboard (KPI strip, recent activity, account picker)
├─ layout.tsx                        → EmailSuiteLayout (Zoru sidebar + top context bar + account switcher)
│
├─ audience/
│  ├─ page.tsx                       → Audience home (all lists + segment shortcuts)
│  ├─ lists/{,new,[listId]/{,edit,subscribers,signup-form,settings}}
│  ├─ segments/{,new,[segmentId]/{,edit,members}}
│  ├─ tags/page.tsx
│  ├─ fields/page.tsx                → Custom field schema editor
│  └─ signup/{forms,landing,popup}
│
├─ campaigns/
│  ├─ page.tsx                       → Campaign list (filter: status, type, list, date)
│  ├─ new/page.tsx                   → Campaign type picker (regular, A/B, RSS, plain-text)
│  └─ [campaignId]/
│     ├─ page.tsx                    → Wizard: setup → recipients → design → confirm
│     ├─ edit/page.tsx
│     ├─ preview/page.tsx            → Multi-client preview (Gmail, Outlook, iOS, Android, dark mode)
│     ├─ ab/page.tsx                 → Variant editor (subject, from, content, send-time)
│     ├─ schedule/page.tsx           → Send-time optimization
│     └─ report/page.tsx             → Opens, clicks, geo, device, e-commerce
│
├─ journeys/
│  ├─ page.tsx                       → Journey list
│  ├─ templates/page.tsx             → Prebuilt journey templates
│  └─ [journeyId]/
│     ├─ canvas/page.tsx             → React-flow visual builder
│     ├─ settings/page.tsx
│     ├─ activity/page.tsx           → Live contact movement
│     └─ report/page.tsx
│
├─ templates/
│  ├─ page.tsx                       → Saved templates + library
│  ├─ library/page.tsx               → Curated Mailchimp-style gallery
│  ├─ blocks/page.tsx                → Saved content blocks
│  └─ [templateId]/
│     ├─ page.tsx                    → Preview
│     ├─ builder/page.tsx            → Drag-and-drop editor
│     └─ code/page.tsx               → HTML/AMP code editor
│
├─ inbox/
│  ├─ page.tsx                       → Three-pane: filters | conversation list | thread
│  ├─ [threadId]/page.tsx
│  └─ assignments/page.tsx
│
├─ reports/
│  ├─ page.tsx                       → Cross-campaign dashboard
│  ├─ campaigns/[campaignId]/page.tsx
│  ├─ journeys/[journeyId]/page.tsx
│  ├─ compare/page.tsx
│  ├─ revenue/page.tsx               → Ties to CRM orders
│  └─ exports/page.tsx
│
├─ deliverability/
│  ├─ page.tsx                       → Score + summary
│  ├─ domains/page.tsx               → DNS records, DKIM rotation
│  ├─ warmup/page.tsx                → Sender warmup schedule
│  ├─ placement/page.tsx             → Inbox-placement preview
│  └─ suppressions/page.tsx
│
├─ integrations/
│  ├─ page.tsx
│  ├─ providers/page.tsx             → Mailgun/Sendgrid/SES/Postmark/Brevo
│  ├─ webhooks/page.tsx              → Outbound webhook config
│  ├─ api/page.tsx                   → API key + docs
│  └─ oauth/page.tsx
│
└─ settings/
   ├─ page.tsx
   ├─ senders/page.tsx
   ├─ branding/page.tsx              → Brand kit (logo, colors, fonts)
   ├─ compliance/page.tsx            → GDPR, CAN-SPAM, unsubscribe footer
   ├─ team/page.tsx                  → Members + RBAC
   └─ plan/page.tsx                  → Credits + plan gating
```

## 4. API surface

All routes under `src/app/api/v1/email/**`. New additions in **bold**, existing folders kept and refactored where noted.

```
api/v1/email/
├─ campaigns/                  (KEEP + extend)
│  ├─ route.ts                 GET list, POST create
│  ├─ [id]/route.ts            GET / PATCH / DELETE
│  ├─ [id]/send/route.ts       **NEW** trigger send
│  ├─ [id]/schedule/route.ts   **NEW**
│  ├─ [id]/test-send/route.ts  **NEW**
│  ├─ [id]/preview/route.ts    **NEW** rendered HTML
│  └─ [id]/report/route.ts     **NEW**
│
├─ **journeys/**               NEW
│  ├─ route.ts
│  ├─ [id]/{,activate,pause,clone,report}/route.ts
│  └─ [id]/contacts/route.ts   → contacts currently inside journey
│
├─ **segments/**               NEW
│  ├─ route.ts
│  ├─ [id]/route.ts
│  ├─ [id]/preview/route.ts    → live count + sample
│  └─ evaluate/route.ts        → run segment against arbitrary filter
│
├─ lists/                      (KEEP)
├─ subscribers/                (KEEP, add /activity, /journeys-in)
├─ suppressions/               (KEEP)
├─ templates/                  (KEEP + builder save)
├─ **template-blocks/**        NEW    saved content blocks
├─ **forms/**                  NEW    signup forms, popups, landing pages
├─ **brand/**                  NEW    brand kit
├─ **inbox/**                  NEW    threads, replies, assignments
├─ **deliverability/**         NEW    score, dns check, warmup, placement
├─ **integrations/**           NEW    providers, oauth tokens
├─ **webhooks/**               NEW    outbound webhook config (inbound stays at /api/webhooks/email-inbound)
├─ **reports/**                NEW    aggregates, compare, revenue
├─ send/                       (KEEP) transactional
├─ send-bulk/                  (KEEP) one-shot bulk
└─ **events/**                 NEW    open / click / bounce / complaint ingest
```

## 5. Data model (Mongo collections)

Existing kept and extended; new collections in **bold**.

| Collection                  | Purpose                                                       |
| --------------------------- | ------------------------------------------------------------- |
| `email_settings`            | Per-tenant sender + provider config (existing)                |
| `email_campaigns`           | Campaign records (existing — add `variants`, `abConfig`)      |
| `email_subscribers`         | Contacts (existing — add `engagement`, `predictedSendTime`)   |
| `email_lists`               | Lists (existing)                                              |
| `email_suppressions`        | Bounces, complaints, unsubs (existing)                        |
| `email_templates`           | Templates (existing — add `mjml`, `builderJson`, `version`)   |
| **`email_segments`**        | Saved dynamic segments — filter tree + cached count           |
| **`email_journeys`**        | Journey definitions — nodes, edges, triggers                  |
| **`email_journey_runs`**    | Per-contact journey state, current node, next-step-at        |
| **`email_template_blocks`** | Reusable content blocks                                       |
| **`email_forms`**           | Signup forms, popups, landing pages                           |
| **`email_brand_kits`**      | Per-tenant brand (logo, palette, fonts, footer)               |
| **`email_threads`**         | Inbox conversations (replaces conversation/thread blend)      |
| **`email_messages`**        | Individual inbox messages (parsed inbound + outbound replies) |
| **`email_assignments`**     | Inbox thread → user/team assignment                           |
| **`email_events`**          | Raw send/open/click/bounce/complaint ledger (sharded by day)  |
| **`email_warmup_runs`**     | Per-domain warmup schedule + daily caps                       |
| **`email_dns_snapshots`**   | Historical DNS verification results                           |
| **`email_api_keys`**        | Tenant-scoped API keys                                        |
| **`email_webhook_configs`** | Outbound webhook destinations + secrets                       |
| **`email_reports_cache`**   | Pre-aggregated daily metrics per campaign / journey           |

Indexes: `tenantId+createdAt`, `tenantId+status`, `tenantId+listId`, `tenantId+segmentId`, `tenantId+ownerEmail`, `journeyId+nextStepAt`, `subscriberId+email`, plus TTL on `email_events` for raw rows older than 90 d (aggregates kept indefinitely in `email_reports_cache`).

## 6. Engines & runtime (Rust + self-hosted)

**Backend is Rust.** All new HTTP surfaces, workers, renderers, segment evaluators, and journey engines live in the `rust/` workspace following the established crate pattern (axum router + DTO + handlers + state) — see `rust/crates/wachat-broadcast/` for the canonical shape. Next.js routes become thin shims that delegate to the Rust HTTP surface.

| Engine                     | Crate                          | Role                                                                                                       |
| -------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| **Common DTOs**            | `email-types`                  | Shared serde-derived structs for all collections (segments, journeys, threads, events, …).                 |
| **Audience HTTP**          | `email-audience`               | `/v1/email/lists`, `/segments`, `/subscribers`, `/tags`, `/fields`, `/forms`.                              |
| **Campaign HTTP + send**   | `email-campaigns` + `email-sender` (worker) | Campaign CRUD, A/B variant management, pre-flight, then drains BullMQ `email-send` queue. Provider adapters: Mailgun, Sendgrid, SES, Postmark, Brevo, raw SMTP. |
| **Journey engine**         | `email-journeys` + `email-journey-worker`   | Visual journey CRUD + per-contact state machine. Worker consumes delayed BullMQ jobs and ticks `email_journey_runs`. |
| **Inbox HTTP**             | `email-inbox`                  | Threads, messages, assignments, reply send.                                                                |
| **Templates + renderer**   | `email-templates`              | Template CRUD + builder JSON → MJML → HTML server-side render (uses `mrml` crate). Merge tags + brand kit. |
| **Event ingest**           | `email-events`                 | Receives provider webhooks (Sendgrid/Mailgun/SES SNS), normalises into `email_events`, fans to suppressions. |
| **Deliverability**         | `email-deliverability`         | DNS verification (SPF/DKIM/DMARC/MX/BIMI), DKIM key generation + rotation, warmup scheduling, placement preview. |
| **Inbound parser**         | `email-inbound`                | Parses MIME from Mailgun/SES SNS webhooks; threads into `email_threads` + `email_messages`.                |
| **Reports aggregator**     | `email-reports` + worker       | Reads `email_events`, rolls up into `email_reports_cache` (hour/day/lifetime buckets per campaign/journey). |
| **API keys + webhooks**    | `email-api` + `email-webhooks` | Tenant API keys (hash+verify, scopes) and outbound webhook config + delivery worker.                       |
| **Forms + landing**        | `email-forms`                  | Form CRUD + public landing page render at `/p/[slug]`.                                                     |

**Cross-cutting:**

- All Rust HTTP routes mount under `/v1/email/*` in the `api` crate.
- Next.js `src/app/api/v1/email/**` routes are deleted and replaced by a single proxy / direct fetch to the Rust API (Next.js server actions in `src/app/actions/email/*.actions.ts` call the Rust API and return typed results to client components).
- All queues use Redis via the existing BullMQ producer pattern (`wachat-queue` is the reference; we add a sibling `email-queue` crate exposing `EmailQueueProducer`).
- Workers run under PM2 / systemd as Rust binaries (`email-sender-worker`, `email-journey-worker`, `email-reports-worker`, `email-webhook-worker`).
- node-cron / agenda / Bull are **not** used.
- Scheduler ticks live inside each worker (tokio interval) — no separate cron daemon.
- Asset storage stays on SabFiles (Cloudflare R2).

## 7. Component plan — ZoruUI only

All new email components live in `src/components/email/` (fresh tree; current `src/components/wabasimplify/email-*` will be deleted in the final cutover step). Every primitive is Zoru.

```
src/components/email/
├─ layout/
│  ├─ email-suite-layout.tsx        Zoru sidebar + topbar + account switcher
│  ├─ email-sidebar.tsx             Nav: Overview, Audience, Campaigns, Journeys, Templates, Inbox, Reports, Deliverability, Integrations, Settings
│  ├─ email-account-switcher.tsx
│  ├─ email-context-bar.tsx         Breadcrumbs + quick filters
│  └─ email-empty-state.tsx
│
├─ overview/
│  ├─ kpi-strip.tsx                 Sends · Open · Click · Bounce · Unsub · Revenue
│  ├─ activity-feed.tsx
│  ├─ quick-actions.tsx
│  └─ account-list.tsx              (replaces email-account-list.tsx)
│
├─ audience/
│  ├─ list-table.tsx
│  ├─ list-form.tsx
│  ├─ subscriber-table.tsx
│  ├─ subscriber-drawer.tsx
│  ├─ segment-builder.tsx           Filter-tree UI (and/or, nested groups)
│  ├─ segment-preview.tsx
│  ├─ tag-manager.tsx
│  ├─ field-schema-editor.tsx
│  └─ import-wizard.tsx             CSV map → validate → import
│
├─ campaigns/
│  ├─ campaign-table.tsx
│  ├─ campaign-type-picker.tsx
│  ├─ wizard/
│  │  ├─ step-setup.tsx
│  │  ├─ step-recipients.tsx        (list + segment + suppression preview)
│  │  ├─ step-design.tsx            (template picker → builder embed)
│  │  ├─ step-confirm.tsx           (pre-flight checks)
│  │  └─ wizard-shell.tsx           Zoru stepper
│  ├─ ab-variant-editor.tsx
│  ├─ preview-client-frame.tsx      Gmail/Outlook/iOS frames
│  └─ schedule-picker.tsx
│
├─ journeys/
│  ├─ journey-list.tsx
│  ├─ journey-template-gallery.tsx
│  ├─ canvas/
│  │  ├─ canvas-shell.tsx           react-flow + Zoru panels
│  │  ├─ node-trigger.tsx
│  │  ├─ node-email.tsx
│  │  ├─ node-wait.tsx
│  │  ├─ node-condition.tsx
│  │  ├─ node-action.tsx            (tag, webhook, list-move)
│  │  ├─ node-split.tsx             (A/B split)
│  │  ├─ inspector-panel.tsx        Right rail config
│  │  └─ run-debug-panel.tsx
│  └─ journey-activity-feed.tsx
│
├─ templates/
│  ├─ template-grid.tsx
│  ├─ library-gallery.tsx
│  ├─ builder/
│  │  ├─ builder-canvas.tsx         Drag-and-drop drop zones
│  │  ├─ block-palette.tsx          Text, image, button, columns, divider, spacer, social, video, footer, AMP
│  │  ├─ block-inspector.tsx        Style + content props
│  │  ├─ device-preview.tsx         Desktop / mobile / dark
│  │  ├─ merge-tag-picker.tsx
│  │  ├─ brand-kit-injector.tsx
│  │  └─ ai-subject-suggester.tsx
│  ├─ code-editor.tsx               (Zoru-themed Monaco)
│  └─ saved-block-manager.tsx
│
├─ inbox/
│  ├─ inbox-shell.tsx               Three-pane Zoru layout
│  ├─ filter-rail.tsx
│  ├─ conversation-list.tsx
│  ├─ thread-view.tsx
│  ├─ reply-composer.tsx
│  ├─ assignment-popover.tsx
│  ├─ sla-badge.tsx
│  └─ canned-reply-picker.tsx
│
├─ reports/
│  ├─ kpi-tiles.tsx
│  ├─ open-click-chart.tsx
│  ├─ engagement-heatmap.tsx
│  ├─ geo-map.tsx
│  ├─ device-breakdown.tsx
│  ├─ click-map-overlay.tsx
│  ├─ revenue-attribution.tsx
│  └─ compare-table.tsx
│
├─ deliverability/
│  ├─ score-gauge.tsx
│  ├─ dns-record-row.tsx
│  ├─ dkim-rotator.tsx
│  ├─ dmarc-policy-form.tsx
│  ├─ warmup-schedule.tsx
│  ├─ placement-preview.tsx
│  └─ reputation-timeline.tsx
│
├─ integrations/
│  ├─ provider-grid.tsx
│  ├─ provider-connect-drawer.tsx
│  ├─ webhook-form.tsx
│  ├─ api-key-table.tsx
│  └─ oauth-callback-panel.tsx
│
└─ settings/
   ├─ sender-form.tsx
   ├─ brand-kit-editor.tsx
   ├─ compliance-form.tsx
   ├─ team-table.tsx
   └─ plan-summary.tsx
```

**Hard rules:**

- Every primitive imports from `@/components/zoruui` — `ZoruButton`, `ZoruCard`, `ZoruInput`, `ZoruSelect`, `ZoruTable`, `ZoruDialog`, `ZoruDrawer`, `ZoruTabs`, `ZoruStepper`, `ZoruBadge`, `ZoruSwitch`, `ZoruCheckbox`, `ZoruTextarea`, `ZoruDropdown`, `ZoruPopover`, `ZoruTooltip`, `ZoruSkeleton`, `ZoruPageHeader`, `ZoruEmptyState`, `ZoruChart`. If a missing primitive blocks a screen, add it to `src/components/zoruui/` first and export through `index.ts` — never reach for shadcn.
- Tailwind tokens: `text-zoru-ink`, `text-zoru-ink-muted`, `bg-zoru-surface`, `border-zoru-line`, `bg-zoru-surface-raised` — no raw hex.
- File inputs: `<SabFilePickerButton>` / `<SabFileUrlInput>` only.
- All client components declare `'use client'` only when interactivity demands it; otherwise stay server components for streaming + cache.

## 8. RBAC + plan gating

Reuse SabNode's tenancy plumbing. Register these RBAC keys (additions on top of any already present):

```
email:overview:view
email:audience:{view,manage,import,export}
email:campaigns:{view,create,send,schedule,delete}
email:journeys:{view,create,activate,delete}
email:templates:{view,create,delete}
email:inbox:{view,reply,assign}
email:reports:{view,export}
email:deliverability:{view,configure,rotate-dkim}
email:integrations:{view,connect,disconnect}
email:settings:{view,edit,billing}
```

Plan tiers (mirrored from Mailchimp Free / Essentials / Standard / Premium):

| Capability                | Free      | Essentials | Standard | Premium    |
| ------------------------- | --------- | ---------- | -------- | ---------- |
| Contacts                  | 500       | 5k         | 100k     | unlimited  |
| Monthly sends             | 1k        | 50k        | 1.2M     | 15M        |
| Journeys                  | 1 active  | 5          | unlimited | unlimited |
| A/B testing               | —         | subj only  | full     | full       |
| Send-time optimization    | —         | —          | yes      | yes        |
| Multivariate              | —         | —          | —        | yes        |
| Phone support             | —         | —          | —        | yes        |
| Advanced segmentation     | basic     | basic      | advanced | advanced   |
| Predictive segments       | —         | —          | yes      | yes        |
| Brand kit + custom domain | —         | yes        | yes      | yes        |

Credit metering: every send debits credits; bulk schedule pre-reserves; failures refund. Hook into existing credit ledger.

## 9. Deliverability stack

- DNS verification (SPF / DKIM / DMARC / MX / BIMI) via Vercel Function, cached 15 min.
- DKIM key rotation (1024 → 2048) with dual-key roll period.
- DMARC policy wizard: `none → quarantine → reject` with aggregate report ingestion to `email_dns_snapshots`.
- Warmup: progressive volume schedule (50 → 100 → 250 → 500 → 1k → …) per new sending domain, throttled by send engine.
- Inbox placement: scheduled seed sends to public seedlist mailboxes, scored against `inbox / spam / missing`.
- Reputation timeline: rolling 30-day open / complaint / bounce graph; alert thresholds.
- Bounce + complaint feedback loop wired from each provider's webhook to suppression list.

## 10. Build phases

Each phase ships independently behind a feature gate. No half-shipped UI.

### Phase 0 — Foundations (1 week)

- Create `src/components/email/` tree with empty exports + Storybook-less manual screen.
- Extend `@/components/zoruui` with missing primitives (`ZoruStepper`, `ZoruDrawer`, `ZoruTable` v2, `ZoruChart`, `ZoruEmptyState`).
- Define Mongo schemas + Zod types in `src/lib/email/types.ts`.
- Wire RBAC keys + plan-gate hooks (`canEmail()` helper).
- Stand up `EmailSuiteLayout` shell + sidebar + account switcher.

### Phase 1 — Audience (1 week)

- Lists CRUD, subscribers table + drawer, import wizard with CSV mapping + duplicate detection.
- Segment builder with live count.
- Tags + custom fields + GDPR consent capture.
- Signup forms + landing page generator.
- APIs: `lists`, `subscribers`, `segments`, `forms`.

### Phase 2 — Templates + Builder (1.5 weeks)

- Drag-and-drop builder backed by MJML.
- Block palette + inspector + device preview + dark-mode preview.
- Brand kit + saved blocks + merge-tag system.
- HTML / AMP code editor with linting.
- Template library gallery (seed 25 templates).

### Phase 3 — Campaigns + Send Engine (1.5 weeks)

- 4-step wizard (setup → recipients → design → confirm).
- A/B variant editor.
- Schedule + send-time optimization.
- Send engine via Vercel Queues + provider adapters.
- Pre-flight: spam-score, link check, broken-merge-tag detection, suppression preview.
- Test-send.

### Phase 4 — Reports + Events (1 week)

- Event ingest from providers (Sendgrid/Mailgun/SES/Postmark/Brevo).
- Per-campaign report: KPIs, geo, device, click-map, timeline.
- Cross-campaign dashboard, compare view, revenue (CRM join).
- CSV / PDF export via Node API route.

### Phase 5 — Journeys (2 weeks)

- React-flow canvas with Zoru-themed nodes.
- Node types: trigger, email, wait, condition, action, A/B split, exit.
- Trigger sources: list-join, tag-added, segment-enter, behavior (open/click/site), date-based, webhook.
- Engine via PM2 worker + BullMQ delayed jobs — durable per-contact runs with Mongo-persisted state.
- Journey activity feed + per-contact debug.
- Prebuilt templates: welcome, abandoned cart, re-engagement, birthday, trial-nudge, post-purchase.

### Phase 6 — Inbox (1 week)

- Three-pane shell, threads from `email_inbound`.
- Reply composer (Zoru rich text + SabFiles attachments).
- Assignment + SLA + canned replies + filters.
- Linking: thread → CRM contact + campaign.

### Phase 7 — Deliverability + Integrations (1 week)

- Domain page: DNS records, DKIM rotation, DMARC wizard.
- Warmup scheduler.
- Inbox-placement preview.
- Provider connect drawers + OAuth flows.
- Outbound webhooks + API keys + docs page.

### Phase 8 — Polish + cutover (0.5 week)

- Delete `src/components/wabasimplify/email-*` legacy files.
- Delete legacy `src/app/dashboard/email/{inbox,campaigns,contacts,templates,analytics,verification,settings}/page.tsx` shells (already replaced by nested routes).
- Migrate any old `email_conversation` records into new `email_threads` / `email_messages` shape.
- Update navigation, search registry, lookup registry.
- E2E pass: send → open → click → bounce → unsubscribe → suppression → journey re-entry blocked.

**Total: ~9 weeks single-track. Phases 1-2 and 4-5 can parallelize across two devs to ~6 weeks.**

## 11. Migrations

| From                                                                                      | To                                                                |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `email_conversation` (current)                                                            | `email_threads` + `email_messages` (split header/body)            |
| `email_campaigns.htmlBody`                                                                | `email_campaigns.builderJson` + rendered `htmlBody` cache         |
| Legacy `email-account-list.tsx`                                                           | `components/email/overview/account-list.tsx`                      |
| Old action `email.actions.ts` (21 funcs)                                                  | Split into `email/audience.actions.ts`, `campaigns.actions.ts`, `journeys.actions.ts`, `templates.actions.ts`, `inbox.actions.ts`, `settings.actions.ts`, `deliverability.actions.ts` |
| Verification page (DNS only)                                                              | Full deliverability section                                       |

Migration scripts live in `scripts/email/` and are idempotent. No data dropped — old collections renamed `_legacy_*` and kept for 30 d.

## 12. Acceptance criteria (Mailchimp-parity definition of done)

- ✅ Create a list, import 10k contacts via CSV with field mapping, validate, dedupe.
- ✅ Build a 6-block email in the drag-and-drop builder with brand kit + merge tags + dark-mode preview.
- ✅ Run a 3-variant A/B campaign with winner auto-selected by open rate after 4 h.
- ✅ Build a 7-node welcome journey (trigger → email → wait 2d → condition → split → email → exit) and watch a contact traverse it in the activity feed.
- ✅ Open a contact's profile and see complete event timeline (sends, opens, clicks, journeys, replies, revenue).
- ✅ Reply to an inbound email from the inbox and have it threaded against the original campaign.
- ✅ Verify SPF / DKIM / DMARC for a custom domain, rotate DKIM, see DMARC aggregate reports.
- ✅ View revenue attribution joining CRM orders to campaign clicks.
- ✅ Hit a monthly-send plan cap and see graceful upgrade prompt.
- ✅ Every screen renders only ZoruUI primitives — zero `Button`/`Card`/`Input` imports from `@/components/ui`.

## 13. Open questions

1. **Provider default** — Mailgun, Sendgrid, or SES? Affects warmup tuning + bounce parsing. Recommend SES (cheapest at scale) with Mailgun fallback.
2. **Template builder engine** — MJML (server-render) vs Unlayer-style JSON-only. Recommend MJML for AMP support + cleaner email-client output.
3. **Journey persistence** — picked: BullMQ delayed jobs + Mongo state, run under PM2.
4. **Inbound parsing** — keep current Mailgun route handler or move to SES SNS? Decide before Phase 6.
5. **Landing page hosting** — under `/share/[token]` (existing SabFiles pattern) or fresh `/p/[slug]`? Recommend fresh `/p/[slug]` to avoid token semantics.
6. **AI features** — subject-line suggester + send-time optimization use the existing Anthropic/OpenAI client wiring; recommend `claude-haiku-4-5` for cost.

## 14. Out of scope (explicitly)

- SMS / MMS (lives in Wachat / sabwa).
- Push notifications.
- Social posting (lives in sabflow).
- Survey tool (separate module).
- Postcards / direct mail.

## 15. File-level deliverables checklist

Tracked in `plan/EMAIL_APP_REBUILD_CHECKLIST.md` (to be created at start of Phase 0). Each phase closes only when:

- All routes + APIs respond with typed contracts.
- Server actions documented in `src/app/actions/email/*.actions.ts`.
- ZoruUI audit passes (`grep -r "from '@/components/ui'" src/components/email | wc -l` == 0).
- RBAC + plan gates enforced on every server action.
- Vercel deploy preview shows the screen end-to-end with seeded data.
