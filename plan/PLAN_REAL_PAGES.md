# Plan: Replace 44 demo placeholder pages with real, fully-featured implementations + Rust backends

Date: 2026-05-11
Owner: shaktisingh204
Status: DRAFT — awaiting approval

---

## 1. Context

44 dashboard pages currently render `WorkingFeaturePage` (`src/components/dashboard/working-feature-page.tsx`) — a localStorage-only placeholder with a static stats grid, a single table, an "add record" form, and toggleable settings. The component never calls a backend.

Goal: deliver **fully working pages with every feature the underlying platform supports** (Telegram Bot API, Telegram Ad Platform, Meta Graph API for FB/IG, etc.), persisted in MongoDB, multi-tenant by `projectId`, wired through the existing Rust API and `rust-client/*` typed clients.

User decisions captured:
- **Order**: dependency order (Telegram → Facebook → Instagram → SabFlow/SabChat → HRM → CRM extras).
- **Depth**: full feature parity per page — no MVP cut.
- **Tenancy**: keep existing `require_project(user, mongo, projectId)` pattern from `telegram-ads`.

---

## 2. Inventory — what exists vs. what's missing

### 2.1 Demo pages (44 confirmed using `WorkingFeaturePage`)

| Module       | Pages                                                                                                                                                                                            |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Telegram (18)| ads, settings, bots, stickers, broadcasts, chat, payments, contacts, mini-apps, stories, business-inbox, commands, webhooks, flows, auto-reply, api-credentials, analytics, channels             |
| Facebook (13)| commerce/shop, insights, leads, flow-builder, visitor-posts, agents, knowledge, events, messenger-settings, audience, pages, competitors, moderation                                              |
| Instagram (6)| messages, discovery, setup, reels, stories, hashtag-search                                                                                                                                       |
| SabFlow (2)  | settings, docs                                                                                                                                                                                   |
| SabChat (1)  | settings                                                                                                                                                                                         |
| HRM (1)      | payroll/settings                                                                                                                                                                                 |
| CRM (2)      | purchases/hire, time-tracking                                                                                                                                                                    |
| WaChat (1)   | whatsapp-ads                                                                                                                                                                                     |

### 2.2 Rust crate coverage

Existing crates per module:

- **Telegram** — 14 crates exist: `telegram-{ads, analytics, auto-reply, bot-profile, bots, broadcasts, channels, chats, commands, flows, mini-apps, payments, stickers, stories}`. Sizes range 197–1235 LOC, mostly basic list/upsert/delete shape (same as `telegram-ads` reference).
- **Facebook** — 12 crates: `wachat-facebook-{agents, automation, business, comments, content, crm, events, lead-gen, messaging, messenger-profile, misc, pages}` plus `facebook-flow`.
- **Instagram** — only `wachat-instagram`.
- **SabFlow** — `sabflow-engine`, `sabflow-engine-runtime`, `sabflow-nodes`, `sabflow-webhooks`.
- **SabChat** — none yet (admin/UI lives in Next.js).
- **HRM/CRM** — extensive `crm-*` and `hrm-*-types` crates already.

### 2.3 Missing crates to create

5 Telegram crates:
- `telegram-settings` — bot defaults, language, privacy mode, notifications.
- `telegram-business-inbox` — business chat shared inbox + assignment.
- `telegram-webhooks` — per-bot webhook config + delivery log.
- `telegram-api-credentials` — MTProto api_id/api_hash store (encrypted).
- `telegram-contacts` — synced contacts, tagging, segments.

1 Instagram crate (everything below shares it):
- `wachat-instagram` already exists — extend it OR split into: `instagram-discovery`, `instagram-reels`, `instagram-stories`, `instagram-hashtag-search`, `instagram-messages`. Decision: **extend `wachat-instagram` with submodules**; do not fragment.

SabChat:
- `sabchat-settings` (new) — workspace preferences, business hours, routing rules.

SabFlow settings/docs are config + static content — `sabflow-engine` already has a settings router we can extend; docs is a static + searchable runbook surface (no new crate, just an MDX-driven page).

HRM payroll settings: extend existing `hrm-payroll-types` with a settings handler crate `hrm-payroll-settings`.

CRM extras:
- `crm-time-tracking` (new).
- `crm-purchase-hires` (subcontractor hires) — extend `crm-purchases-types`.

WaChat whatsapp-ads: extend existing `wachat-ads-accounts` / `wachat-ads-pixels`.

---

## 3. Shared scaffolding (build once, reuse across all 44 pages)

Before page work begins, land these reusable pieces so each subsequent page is 30–60 min of glue, not bespoke wiring.

### 3.1 Rust shared crate additions

In `sabnode-common`:
- `project_scope::require_project(user, mongo, project_id) -> ObjectId` — generalize the local copy each crate has.
- `pagination::{ListParams, ListResult<T>}` — `page`, `pageSize`, `cursor`, plus `total`, `nextCursor`.
- `filters::{SearchParams, StatusFilter, DateRange}` — common query types.
- `csv::stream_csv<T: Serialize>(rows) -> Response` — used by every list endpoint for export parity with current "Export CSV" button.
- `webhook_log::record_delivery(...)` — for Telegram/Meta webhook crates.

### 3.2 Next.js shared scaffolding

In `src/components/dashboard/`:
- `feature-shell.tsx` — replaces the visual frame of `WorkingFeaturePage` (header + stats grid + 2-column layout). Pure presentational; accepts children and a stats array.
- `feature-table.tsx` — typed list table with search, status filter, column visibility, sticky header, infinite scroll / paginate, row selection, bulk actions, CSV export.
- `feature-create-drawer.tsx` — replaces the inline "add record" form with a side drawer driven by a Zod schema.
- `feature-detail-drawer.tsx` — drill-in for any row.
- `feature-settings-panel.tsx` — replaces the localStorage settings toggles with a server-backed settings form.
- `use-feature-resource.ts` — generic hook (`useFeatureResource<T>({api, projectId})`) that wraps list / create / update / delete with optimistic mutations, `useSWR` cache, and toast plumbing.

In `src/lib/rust-client/`:
- Extend each existing client (`telegram-bots.ts`, etc.) with the new endpoints listed per page below. Keep the `*Api = { list, get, upsert, delete, ... }` object pattern.
- Add 7 new clients matching the 7 new crates.

### 3.3 Routing

Mount the 7 new crates in `rust/crates/api/src/router.rs`. Pattern matches existing telegram nests.

Once 3.1–3.3 ship, every page below is roughly: extend Rust handlers → extend rust-client → swap `WorkingFeaturePage` for `<FeatureShell>` + typed hooks.

---

## 4. Phase plan (dependency order)

Phases run sequentially because later phases reuse scaffolding refined in earlier ones.

### Phase 0 — Scaffolding (Section 3)
Effort: 2–3 days.
Deliverables: shared Rust types, 5 new React components, generic feature hook, smoke tests. **Blocking** all other phases.

### Phase 1 — Telegram (18 pages)

**1.1 Extend existing 14 crates** — flesh out from basic CRUD to full feature parity. Per crate:
- `telegram-bots` (1235 LOC, already deepest) — add: getBotInfo, setMyCommands, setMyName, setMyDescription, setMyShortDescription, getChatMenuButton/set, log webhook deliveries, bot health ping job.
- `telegram-broadcasts` — add: media broadcast (photo/video/document via `sendMediaGroup`), inline keyboard builder, scheduled send (Redis ZSET + worker), per-recipient delivery log, retry, audience builder from `telegram_contacts`.
- `telegram-payments` — Telegram Payments API: `sendInvoice`, `createInvoiceLink`, `answerPreCheckoutQuery`, `answerShippingQuery`; webhook handlers; refund flow; provider tokens per project.
- `telegram-flows` — full flow CRUD with node graph (reuse SabFlow node schema), publish, version history, test-runner endpoint.
- `telegram-stickers` — `createNewStickerSet`, `addStickerToSet`, `deleteStickerFromSet`, `setStickerSetTitle`, `setStickerEmojiList`, R2 upload via SabFiles, mask position editor.
- `telegram-channels` — channel admin: `getChat`, `getChatAdministrators`, `promoteChatMember`, post scheduling, channel stats poll.
- `telegram-chats` (628 LOC) — extend: typing/read indicators relay, pinned messages, chat history paginate via `getUpdates` + DB cache, message edit/delete, forward, reply, message search index.
- `telegram-analytics` — counters: messages in/out, broadcasts delivered, click-through on inline keyboards, payments, daily aggregation job, ECharts-ready response.
- `telegram-auto-reply` — rules engine: triggers (keyword/regex/intent/business-hours), actions (reply/forward/tag/assign/run-flow), cooldown, per-bot scope, conflict resolution.
- `telegram-commands` — slash command registry per bot, scope (private/group/admin), description, `setMyCommands` push, run history.
- `telegram-mini-apps` — Mini App registry: web_app_url, init data validator, `sendWebApp` button, theme params, user data signed verification.
- `telegram-bot-profile` — already wired by `telegram-bots`; add avatar upload via SabFiles, about/short description, business connection.
- `telegram-stories` — story API (Bot API 7.0+): `postStory`, story list, expiry, archive.
- `telegram-ads` — already minimal CRUD; add: cost analytics (impressions/clicks/CTR/CPM/CPC computed), CSV import for stats pasted from ads.telegram.org, UTM link builder + redirect via existing `url-shortener` crate.

**1.2 Build 5 new crates**:
- `telegram-settings` — per-bot config doc (language, privacy mode, group_admin_only_flag, signature line), notification routing, business connection toggle, GDPR data export endpoint.
- `telegram-business-inbox` — shared inbox over all bots in a project: thread list, assignment, tags, internal notes, SLA timer, auto-assign rules, presence; reuses `wachat`-style inbox patterns where possible.
- `telegram-webhooks` — per-bot webhook config (URL secret, allowed_updates, max_connections), delivery log, replay, DLQ retry.
- `telegram-api-credentials` — encrypted at rest (`sabnode-common::encryption::seal`), one per project per user, validation via test call.
- `telegram-contacts` — contact upsert from incoming updates, manual add, tagging, segments, CSV import/export, dedupe by chat_id, sync from `telegram-chats`.

**1.3 Frontend** — one `page.tsx` per route. Pattern:

```tsx
'use client';
import { telegramAdsApi } from '@/lib/rust-client/telegram-ads';
import { FeatureShell, FeatureTable, FeatureCreateDrawer, useFeatureResource } from '@/components/dashboard/feature-shell';

export default function Page() {
  const { activeProject } = useProject();
  const { rows, stats, create, remove, update, isLoading } = useFeatureResource({
    api: telegramAdsApi,
    projectId: activeProject?.id,
  });
  return (
    <FeatureShell title="..." icon={Megaphone} stats={stats}>
      <FeatureTable rows={rows} columns={...} onDelete={remove} />
      <FeatureCreateDrawer schema={schema} onCreate={create} />
    </FeatureShell>
  );
}
```

Page-specific UI (where required):
- `bots/page.tsx` — connect bot wizard (paste token → validate via `getMe`), bot detail tab.
- `broadcasts/page.tsx` — broadcast composer with media picker (`<SabFilePickerButton>` only — no URL paste), audience builder, schedule picker.
- `flows/page.tsx` — embed the existing SabFlow editor scoped to telegram nodes.
- `chat/page.tsx` — full chat UI with `EventSource` stream from `/v1/telegram/chats/{chatId}/stream`.
- `business-inbox/page.tsx` — Wachat-style inbox layout.
- `analytics/page.tsx` — ECharts dashboard with date range picker.
- `mini-apps/page.tsx` — registry list + bot button wizard.
- `stickers/page.tsx` — sticker pack manager with drag-reorder.
- `stories/page.tsx` — story timeline + composer.

**1.4 Webhook plumbing**
- `/api/telegram/webhook/[botId]/route.ts` already exists. Verify it routes through new `telegram-webhooks` crate for logging and into `telegram-auto-reply` for rule matching.

Telegram phase deliverable count: 18 pages, 19 crates touched (14 extended, 5 new), ~3.5k LOC Rust delta, ~6k LOC TSX delta.

### Phase 2 — Facebook (13 pages)

Wire each page to its corresponding existing `wachat-facebook-*` crate. None of these need a new crate, but most need handler additions.

| Page                    | Crate                                | Handler work                                                                                                       |
| ----------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| pages                   | `wachat-facebook-pages`              | list pages, page-token refresh, default page selector                                                              |
| insights                | `wachat-facebook-pages` (+misc)      | Graph `/insights` for impressions, reach, engaged_users, ECharts response                                          |
| leads                   | `wachat-facebook-lead-gen`           | leadgen forms list, retrieve leads, push into `crm-leads`, webhook subscription                                    |
| flow-builder            | `facebook-flow`                      | full flow editor like telegram-flows; messenger profile auto-publish                                               |
| visitor-posts           | `wachat-facebook-content` (+pages)   | fetch page `tagged` + `feed`, filter by visitor authorship, moderate                                               |
| agents                  | `wachat-facebook-agents`             | agent (assignee) CRUD, routing rules                                                                               |
| knowledge               | `wachat-facebook-agents` (+misc)     | knowledge base (Q&A pairs) feeding bot replies                                                                     |
| events                  | `wachat-facebook-events`             | page events list, RSVPs, create-event                                                                              |
| messenger-settings      | `wachat-facebook-messenger-profile`  | persistent menu, greeting, ice breakers, get-started payload                                                       |
| audience                | `wachat-facebook-business` (+pages)  | custom-audience CRUD via Marketing API (already has token), interest targeting                                     |
| competitors             | `wachat-facebook-misc`               | competitor page tracking (public posts + likes count), poll job, comparison chart                                  |
| moderation              | `wachat-facebook-comments`           | comment moderation queue, blocked words, auto-hide rules                                                           |
| commerce/shop           | `wachat-facebook-business`           | catalog list, product browse, sync with Sabnode shop module                                                        |

Frontend: same `<FeatureShell>` pattern; pages that need richer UI (flow-builder, audience) embed existing editors/wizards.

Facebook phase deliverable: 13 pages, 8 crates extended, ~2.5k LOC delta, ~4.5k LOC TSX delta.

### Phase 3 — Instagram (6 pages)

Extend `wachat-instagram` into modules under `src/{messages,discovery,reels,stories,hashtag_search,setup}.rs`. Reuse `wachat-meta-client` for Graph API calls.

| Page             | Module                              | Notes                                                                                              |
| ---------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------- |
| setup            | `wachat-instagram::setup`           | IG Business account linking via FB Page, permissions check, webhook subscribe                      |
| messages         | `wachat-instagram::messages`        | Direct Messages: list threads, send, media, story-reply context; live via webhooks                 |
| stories          | `wachat-instagram::stories`         | published stories list, insights, reply automations                                                |
| reels            | `wachat-instagram::reels`           | reels list + insights, comment surface                                                             |
| discovery        | `wachat-instagram::discovery`       | IG Graph `/business_discovery` for public account research                                         |
| hashtag-search   | `wachat-instagram::hashtag_search`  | hashtag id resolve + top/recent media                                                              |

Frontend: 6 pages, all `<FeatureShell>` pattern except `messages` (chat surface like telegram chat).

Instagram phase deliverable: 6 pages, 1 crate restructured + 6 submodules, ~2k LOC Rust delta, ~3k LOC TSX delta.

### Phase 4 — SabFlow settings + docs (2 pages)

- `dashboard/sabflow/settings/page.tsx` — workspace-level flow defaults: default trigger timeouts, retry policy, log retention days, secret store, allowed node types, billing/credit caps. Backend: extend `sabflow-engine` with `/v1/sabflow/settings` (get/upsert) doc per project.
- `dashboard/sabflow/docs/page.tsx` — MDX-driven runbook. Static content under `src/app/dashboard/sabflow/docs/_content/*.mdx`, server-rendered, with search via `flexsearch` index built at build time. No backend.

### Phase 5 — SabChat settings (1 page)

New crate `sabchat-settings`: project-scoped widget config (theme, position, off-hours auto-reply, routing to agents, pre-chat form), embed snippet generator, allow-list domains, GDPR data export.

### Phase 6 — HRM payroll settings (1 page)

New crate `hrm-payroll-settings`: org-level payroll config (pay frequency, currency, tax regime, PF/ESI thresholds, statutory deduction toggles, payslip template, approval workflow chain). Reuses `hrm-payroll-types`.

### Phase 7 — CRM extras (2 pages) + WaChat ads (1)

- `crm/purchases/hire/page.tsx` — subcontractor / agency hires: extend `crm-purchases-types`, add `crm-purchase-hires` handler crate with hire CRUD, milestone schedule, payments hook into `crm-payouts`.
- `crm/time-tracking/page.tsx` — new crate `crm-time-tracking`: timer start/stop, manual entry, approval, project/task linkage, export.
- `wachat/whatsapp-ads/page.tsx` — extend `wachat-ads-accounts` + `wachat-ads-pixels`: click-to-WhatsApp ad creation, audience sync, performance dashboard.

---

## 5. Acceptance criteria per page

Every "fully working" page must satisfy:

1. **Persistence** — server round-trip on every mutation; no localStorage state for shared data. Per-user UI prefs (column visibility, density) may stay in localStorage.
2. **Multi-tenant** — `projectId` always required; ownership enforced server-side via `require_project`.
3. **List view** — search, filters (status + date range + module-specific), pagination, sort by ≥ 2 columns, bulk select + bulk delete/update, CSV export, empty state, loading skeleton, error state.
4. **Create + Edit** — Zod-validated drawer form, optimistic insert with rollback, server-returned canonical record refresh.
5. **Detail** — drawer or `[id]/page.tsx` route with full record, activity log, related entities, audit fields (`createdAt`, `updatedAt`, `createdBy`).
6. **Live integration** — wherever the platform supports it (Telegram Bot API, FB Graph, IG Graph), the page either reflects live state (e.g., webhook deliveries) or issues live actions (send, post, schedule, push commands).
7. **Settings** — module-level settings persisted server-side, not localStorage.
8. **Analytics** — every list page exposes ≥ 3 KPIs computed server-side (not client-counted).
9. **Permissions** — RBAC respected via existing `AuthUser` + role helpers; UI hides unauthorized actions.
10. **Files** — every media input uses `<SabFilePickerButton>` / `<SabFileUrlInput>` (no free-text URL paste, per CLAUDE.md).
11. **Observability** — Rust handlers emit `tracing::info_span!` with `project_id`, `user_id`, `route`; failures use `?` with `anyhow::Context`.
12. **Tests** — at minimum: 1 handler integration test per CRUD endpoint using `mongodb`-memory; 1 RTL render test per page; 1 e2e smoke (Playwright) per module hitting list + create.

---

## 6. Estimated effort

| Phase                 | Pages | New crates | Crates extended | Rust LOC | TSX LOC | Days |
| --------------------- | ----- | ---------- | --------------- | -------- | ------- | ---- |
| 0 — Scaffolding       | —     | 0          | 1 (`common`)    | ~600     | ~1200   | 2–3  |
| 1 — Telegram          | 18    | 5          | 14              | ~3500    | ~6000   | 10   |
| 2 — Facebook          | 13    | 0          | 8               | ~2500    | ~4500   | 7    |
| 3 — Instagram         | 6     | 0 (restruct)| 1              | ~2000    | ~3000   | 4    |
| 4 — SabFlow s+d       | 2     | 0          | 1               | ~300     | ~1000   | 1.5  |
| 5 — SabChat settings  | 1     | 1          | 0               | ~400     | ~600    | 1    |
| 6 — HRM payroll set.  | 1     | 1          | 0               | ~500     | ~700    | 1    |
| 7 — CRM + WaChat ads  | 3     | 2          | 3               | ~1200    | ~2000   | 3    |
| **Total**             | **44**| **9**      | **28**          | **~11k** | **~19k**| **~30** |

(Single dev, 6h/day, no surprises. Inflate 30 % for review + bugfix.)

---

## 7. Risks / open questions

1. **Telegram Bot API rate limits** — broadcasts/sticker bulk ops need per-bot leaky-bucket. Reuse `wachat-rate-limit` crate pattern.
2. **Webhook fan-out** — Telegram webhook deliveries currently land in `/api/telegram/webhook/[botId]`. Audit whether forwarding to Rust handlers is already in place or needs implementing.
3. **Encryption** — `telegram-api-credentials` stores api_id/api_hash. Confirm KMS / `sabnode-common::encryption` exists or add one (AES-256-GCM with key from env).
4. **Instagram Graph API limits** — hashtag search has 30 unique tags / 7 days per user. Cache aggressively.
5. **MTProto** — Telegram api_id/api_hash implies MTProto client. The repo currently only handles Bot API. Decision: store credentials but do not run MTProto session server-side in this round; ship surface only with a "MTProto sessions are coming next" notice. Document this in `telegram/api-credentials/page.tsx`.
6. **`crm/purchases/hire` semantics** — confirm whether "hire" means hiring a vendor (subcontract) or HR hiring a candidate; CRM grouping suggests vendor. **Open question for user.**
7. **Pagination cursor format** — Mongo `_id`-based cursor vs offset. Default to `_id` cursor; spec lives in `sabnode-common::pagination`.

---

## 8. Definition of done for the whole effort

- Zero pages remaining that import `WorkingFeaturePage`.
- `WorkingFeaturePage` deleted, `src/components/dashboard/` documented with `feature-shell.tsx` + friends.
- 9 new Rust crates added to `rust/crates/` and wired into `rust/crates/api/src/router.rs`.
- `src/lib/rust-client/index.ts` re-exports 9 new typed clients.
- `cargo check --workspace` and `cargo test --workspace` green.
- `pnpm typecheck && pnpm test` green.
- `graphify update .` run; `graphify-out/GRAPH_REPORT.md` regenerated.
- One PR per phase, each independently mergeable behind a feature flag if needed.
