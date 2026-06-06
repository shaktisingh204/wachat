# MASTER CRATE-CREATION PLAN — WaChat Backend Coverage

Workspace: `rust/` (axum 0.8 + mongodb 3). Shared crates: `sabnode-common`, `sabnode-auth`, `sabnode-db`. Each crate exposes `pub fn router::<S>()` and is mounted in `rust/crates/api/src/router.rs`. Wiring chain validated against the live tree (`wachat-contacts` = CRUD reference, `wachat-features` = multi-resource umbrella reference).

---

## 1. Summary

| Metric | Count |
|---|---|
| Pages audited | **97** |
| `worksToday: true` | 84 |
| `worksToday: false` | 13 |
| `frontendWired: true` | 78 |
| `frontendWired: false` | 19 |
| Pages flagging `needsNewCrate: true` | **35** |
| Pages fully covered (reuse-only / no new crate) | 62 |

**`worksToday:false` pages (13):** `/wachat/campaign-ab-test`, `/wachat/catalog/new`, `/wachat/integrations`, `/wachat/numbers`, `/wachat/setup`, `/wachat/setup/docs`, `/wachat/template-builder`, `/wachat/templates/interactive-message-builder`, `/wachat/two-line`, `/wachat/webhooks`, `/wachat/whatsapp-ads/roadmap`, `/wachat/whatsapp-ads/setup` (stub), `/wachat/message-analytics` (redirect stub — fine).

**By priority (page-level):** P0 ×11 · P1 ×34 · P2 ×42 · P3 ×10.

**Crate-creation pages by priority:** P1 ×16 · P2 ×17 · P3 ×2. (No P0 page needs a new crate — every P0 gap is frontend-wiring-only.)

---

## 2. NEW CRATES TO CREATE (deduplicated)

35 pages raised `needsNewCrate`, but many name the **same** crate or say "add to existing `wachat-features`". After dedup: **18 net-new crates** + **5 "extend existing crate" additions** (not new crates). Each marked `[NEW]` (brand-new backing collection) or `[MIGRATE]` (native-mongo → rust, logic already exists in TS).

### A. Extend EXISTING crates (NOT new crates — fold in)

| Target crate | Mount | Add | For pages |
|---|---|---|---|
| **wachat-features** | `/v1/wachat/features` | `DELETE /projects/{id}/analytics/link-clicks`; `PATCH /message-tags/{id}`; `POST /projects/{id}/message-tags/bulk-apply`; `GET /projects/{id}/message-tags/{id}/analytics`; `GET /projects/{id}/analytics/agents/{agentId}/hourly`; `POST /projects/{id}/scheduled-reports` (+GET/DELETE); `POST /projects/{id}/media/presign-upload` | link-tracking, message-tags, response-time-tracker, media-library |
| **wachat-analytics** | `/v1/wachat/analytics` | `GET /projects/{id}/dashboard-summary` (totals + 30-day series + campaign count) | overview |
| **wachat-config** | `/v1/wachat/config` | `POST .../phone-numbers/{pnid}/verify-code` (wire existing logic); add-number `POST`; remove-number `DELETE`; flows-encryption `generate`/`upload`; `PATCH /projects/{id}/attributes`; `PATCH /projects/{id}/settings` (general settings); per-phone display-name `POST .../display-name` + status | numbers, settings/attributes, settings/general, phone-number-settings |
| **wachat-templates-actions** | `/v1/wachat/templates-actions` | `POST /multilang/clone`; `POST /library/{id}/rate` | templates/create, templates/library |
| **wachat-flows** | `/v1/flows` | `POST /{id}/clone`; `DELETE /bulk-delete`; `PATCH /bulk-status`; `GET /{id}/metrics` (reads `wa_flow_events`) | flow-builder, flow-builder/[flowId] |

> These avoid crate sprawl. The audit's `wachat-flow-ops` / `wachat-flow-metrics` / `wachat-quality-history` / `wachat-project-attributes` / `wachat-project-config` / `wachat-phone-display-name` / `wachat-opt-out-settings` proposals all collapse into the rows above **except** `wa_flow_events` (new collection) and `wa_phone_quality_history` (new collection) which justify a thin dedicated crate each below.

### B. Net-new crates

1. **wachat-auto-reply-settings** `[MIGRATE]` — `/v1/wachat/auto-reply-settings`
   - Pages: `/wachat/auto-reply`
   - Collections: `projects` (`$set` patches only — no new collection)
   - Endpoints: `GET /{project_id}`; `PATCH /{id}/master-switch`; `PUT /{id}/welcome-message`; `PUT /{id}/inactive-hours`; `PUT /{id}/general`; `PUT /{id}/ai-assistant`; `PUT /{id}/opt-in-out`
   - Mirror: **wachat-config** (project-doc `$set` shape). Must call `invalidateProjectCache` equivalent after write.
   - Migrates `project.actions.ts` native-mongo writes.

2. **wachat-ai-training** `[NEW]` — `/v1/wachat/ai-training`
   - Pages: `/wachat/automation`, `/wachat/chatbot` (Train modal), `/wachat/saved-replies` (AI suggest)
   - Collections: `wa_ai_training_samples`, `wa_automation_model_config`
   - Endpoints: `GET/POST /model-config/{project_id}/{phone_id}`; `GET/POST /samples/{project_id}/{phone_id}`; `DELETE /samples/{project_id}/{phone_id}/{sample_id}`
   - Mirror: **wachat-contacts** (simple CRUD). Meta-native conversational-automation stays in `wachat-features` — do NOT duplicate.

3. **wachat-ab-testing** `[NEW]` — `/v1/wachat/ab-tests`
   - Pages: `/wachat/campaign-ab-test`
   - Collections: `wa_ab_tests`, `wa_ab_test_results`
   - Endpoints: `POST /`; `GET /`; `GET /:id`; `POST /:id/stop`; `POST /:id/promote-winner`; `DELETE /:id`
   - Mirror: **wachat-broadcast** (dispatches via `bulk-start` internally; results updated from broadcast webhook callbacks).

4. **wachat-contact-merge** `[NEW]` — `/v1/wachat/contact-merge`
   - Pages: `/wachat/contact-merge`
   - Collections: `wa_contacts`, `wa_conversations`, `wa_messages`
   - Endpoints: `POST /` (field-level merge, re-point conversation/message FKs from secondary→primary, delete secondary)
   - Mirror: **wachat-contacts**. Orchestration transaction; reuses tag-union from `wachat-contacts::update_contact_tags`.

5. **wachat-contacts-export-sync** `[NEW + external]` — `/v1/wachat/contacts`
   - Pages: `/wachat/contacts`
   - Collections: `wa_contacts`, `wa_projects`
   - Endpoints: `GET /export` (stream CSV, `Content-Disposition: attachment`); `POST /sync/google`; `POST /sync/shopify`; `POST /sync/vcard`
   - Mirror: **wachat-contacts** (reuses its import upsert). Export is pure; sync endpoints have external seams (see §5).

6. **wachat-flow-events** `[NEW]` — `/v1/wachat/flow-events` (thin; the bulk-ops fold into `wachat-flows`)
   - Pages: `/wachat/flow-builder`, `/wachat/flow-builder/[flowId]`
   - Collections: `wa_flow_events`
   - Endpoints: `GET /{flowId}/metrics`; `GET /?projectId=` (batch)
   - Mirror: **wachat-analytics** (aggregation read). `wa_flow_events` is written by the flow executor on trigger.

7. **wachat-integrations-hub** `[MIGRATE]` — `/v1/wachat/integrations`
   - Pages: `/wachat/integrations`, `/wachat/integrations/whatsapp-widget-generator`
   - Collections: `wa_link_clicks`, `wa_razorpay_settings`/`projects`, `wa_oauth_connections`
   - Endpoints: `GET/POST /link-clicks`; `GET/POST /razorpay`; `GET /razorpay/logs`; `GET /oauth`; `POST /oauth/{provider}/connect`; `DELETE /oauth/{provider}`; `GET /widget-stats`; `POST /widget-stats/increment`
   - Mirror: **wachat-features** (multi-resource). NOTE: webhook-CRUD + API-key tabs reuse existing `developer-webhooks` + `wachat-api-keys-admin` — frontend wiring only, no Rust here.

8. **wachat-razorpay** `[MIGRATE + external]` — `/v1/wachat/razorpay`
   - Pages: `/wachat/integrations/razorpay` (overlaps #7 — pick ONE owner; recommend razorpay lives here, integrations-hub proxies)
   - Collections: `projects`
   - Endpoints: `GET/PUT /projects/{id}/settings`; `GET /projects/{id}/logs/transactions`; `GET /projects/{id}/logs/payment-links`; `POST /projects/{id}/payment-links`
   - Mirror: **wachat-pay**. Razorpay REST via reqwest; send-link delegates to `wachat-send /messages/send`. External seam = Razorpay API.

9. **wachat-link-generator** `[MIGRATE]` — `/v1/wachat/link-generator`
   - Pages: `/wachat/whatsapp-link-generator`, `/wachat/integrations/whatsapp-link-generator`
   - Collections: `wa_link_clicks`, `wa_short_links`
   - Endpoints: `POST /projects/{id}/links`; `POST /shorten` (internal, replaces TinyURL); `GET /qr` (server PNG, replaces api.qrserver.com)
   - Mirror: **wachat-contacts**. Removes two external CDN dependencies (privacy: stops leaking phone numbers).

10. **wachat-quality-history** `[NEW]` — `/v1/wachat/quality-history`
    - Pages: `/wachat/health`
    - Collections: `wa_phone_quality_history`
    - Endpoints: `GET /{phone_number_id}`; `POST /{phone_number_id}/snapshot`
    - Mirror: **wachat-analytics**. Snapshot written by webhook on `quality_rating` change (Meta exposes no time-series).

11. **wachat-canned-messages** `[MIGRATE]` — `/v1/wachat/canned-messages`
    - Pages: `/wachat/settings/canned`, `/wachat/chat` (read path)
    - Collections: `wa_canned_messages`
    - Endpoints: `GET/POST /{project_id}`; `PUT /{project_id}/{message_id}`; `DELETE /{message_id}`; `GET/PUT /{project_id}/settings`
    - Mirror: **wachat-contacts**. Distinct from `wachat-features` saved_replies (rich typed media vs shortcut+body). Migrates `canned_messages` native-mongo.

12. **wachat-project-agents** `[MIGRATE]` — `/v1/wachat/project-agents`
    - Pages: `/wachat/settings/agents`
    - Collections: `projects`
    - Endpoints: `GET /projects/{id}/agents`; `POST .../invite`; `GET .../{agentId}/open-tickets`; `DELETE .../{agentId}` (reassign-then-pull); `PATCH /projects/{id}/routing`; `PUT .../{agentId}/skills`
    - Mirror: **wachat-features**. Distinct from `sabchat-teams`/`sabchat-routing`.

13. **wachat-interactive-builder** `[NEW]` — `/v1/wachat/interactive-builder`
    - Pages: `/wachat/templates/interactive-message-builder`
    - Collections: `wa_interactive_templates`
    - Endpoints: `GET/POST /templates`; `DELETE /templates/:id`; `POST /send-test` (delegates to `wachat-send`)
    - Mirror: **wachat-contacts**. Replaces localStorage; project-scoped.

14. **wachat-number-routing** `[NEW]` — `/v1/wachat/number-routing`
    - Pages: `/wachat/two-line`
    - Collections: `wa_number_team_bindings`
    - Endpoints: `GET /`; `POST /`; `PUT /{id}`; `DELETE /{id}`
    - Mirror: **wachat-contacts**. Teams list reuses `wachat-features` agent-statuses.

15. **wachat-post-generator** `[NEW + external AI]` — `/v1/wachat/post-generator`
    - Pages: `/wachat/post-generator`
    - Collections: `wa_post_drafts`, `wa_post_publish_log`
    - Endpoints: `GET/POST /drafts`; `DELETE /drafts/:id`; `POST /publish/facebook`; `POST /publish/whatsapp-status`; `GET /publish-log`
    - Mirror: **wachat-features**. AI generation STAYS in Next streaming route; publish reuses `wachat-facebook-*` OAuth token. External seam = Meta Graph publish + AI Gateway (see §5).

16. **wachat-setup-kb** `[NEW]` — `/v1/wachat/setup-kb`
    - Pages: `/wachat/setup/docs`
    - Collections: `wa_setup_kb_articles`
    - Endpoints: `GET/POST /articles`; `PUT /articles/{id}`; `DELETE /articles/{id}`
    - Mirror: **wachat-contacts**. Seed from `mockApi.ts MOCK_ARTICLES`. Diagnostics reuse existing `wachat-features` health + `wachat-send`.

17. **wachat-ai-ad-copy** `[NEW + external AI]` — `/v1/wachat/ai-ad-copy`
    - Pages: `/wachat/whatsapp-ads`
    - Collections: none (ephemeral)
    - Endpoints: `POST /generate` → `{primary_text, headline, description, creative_idea}`
    - Mirror: thin handler crate. External seam = AI Gateway (§5).

18. **wachat-ads-roadmap** `[NEW]` — `/v1/wachat/ads-roadmap`
    - Pages: `/wachat/whatsapp-ads/roadmap`
    - Collections: `wa_ads_roadmap_phases`, `wa_ads_roadmap_votes` (unique idx `userId+phaseSlug+projectId`)
    - Endpoints: `GET /phases`; `POST /phases/:phase/vote`; `POST /sync` (no-op until Linear creds)
    - Mirror: **wachat-contacts**. Lowest priority (P3).

---

## 3. REUSE-ONLY PAGES (no new crate — frontend wiring only)

These are the highest-ROI fixes: the Rust endpoint already exists, the UI just isn't calling it.

| Route | Wire to existing endpoint |
|---|---|
| `/wachat/broadcast-history` (replay) | `POST /v1/wachat/broadcast/{id}/requeue` (dialog only toasts today) |
| `/wachat/broadcast-segments` (edit) | thread `_id` into existing `broadcast-segments save` (always creates new today) |
| `/wachat/chat/kanban` | swap native-mongo `getKanbanData`/`saveKanbanStatuses` → `GET/POST /v1/facebook/crm/projects/{id}/kanban[/statuses]` (already exists) |
| `/wachat/conversation-kanban` | drag-move → `POST /v1/wachat/features/assign-conversation` (exists, uncalled) |
| `/wachat/conversation-filters` (apply) | route to conversations with serialized filter; tag field → `chat-labels get` |
| `/wachat/chat-ratings`, `/wachat/customer-satisfaction` (submit) | expose existing `POST /v1/wachat/features/.../chat-ratings/submit` |
| `/wachat/setup`, `/wachat/setup/docs` | `GET /v1/projects?type=whatsapp` + `wachat-features` health + `wachat-send` (UIs use mocks today) |
| `/wachat/templates` (bulk submit) | no real Meta bulk endpoint — keep as documented limitation |
| `/wachat/message-statistics`, `/wachat/template-analytics`, `/wachat/delivery-reports`, `/wachat/team-performance` | already on `wachat-features` analytics; remaining gaps are CSAT join (→ §2.A response-time / agent-performance) |

Plus all P0 dashboards/features (`/wachat`, `/wachat/analytics`, `/wachat/broadcasts*`, `/wachat/chat`, `/wachat/contacts` core, `/wachat/templates*`) which already work against Rust.

---

## 4. BUILD WAVES (ordered by priority + dependency)

**Per-crate wiring steps (identical 8-step recipe for every crate):**
1. `rust/Cargo.toml` → add `"crates/<name>"` to `members`
2. `rust/crates/api/Cargo.toml` → add `<name> = { path = "../<name>" }`
3. `rust/crates/api/src/router.rs` → add `let <name>_r = <crate>::router::<AppState>();` + `.nest("<mount>", <name>_r)`
4. `rust/crates/api/src/state.rs` → `use <crate>::<State>;`, add field to `AppState`, add to constructor, add `impl FromRef<AppState> for <State>`
5. `tools/api-manifest/modules/wachat.ts` (or new module file) → manifest entry; run codegen (`tools/api-codegen/generate.ts`)
6. `src/lib/rust-client/<name>.ts` → new client module (mirror `wachat-features.ts`: `BASE`, `rustFetch`, `import 'server-only'`)
7. `src/lib/rust-client/index.ts` → `import { <name>Api }` + register in barrel
8. Frontend page → replace mock/native-mongo call with `rustClient.<name>.*`

---

### Wave 0 — REUSE-ONLY wiring (no Rust, ship first)
**Unblocks:** broadcast-history, broadcast-segments, chat/kanban, conversation-kanban, conversation-filters, chat-ratings, customer-satisfaction, setup, setup/docs, all P0 dashboards' loose ends.
**Steps:** step 8 only (frontend rewire to existing endpoints). Zero crate risk. Do this concurrently with Wave 1.

### Wave 1 — P1 "extend existing crate" (no new crates, fast)
**Crates touched:** `wachat-flows` (clone/bulk/metrics + `wa_flow_events`), `wachat-analytics` (dashboard-summary), `wachat-config` (verify-code/add/remove/flows-enc/attributes/settings/display-name), `wachat-features` (link-clicks DELETE, message-tags PATCH/bulk/analytics, agent hourly, scheduled-reports, media presign).
**Pages unblocked:** flow-builder, flow-builder/[flowId], overview, numbers, settings/attributes, settings/general, phone-number-settings, link-tracking, message-tags, response-time-tracker, media-library, team-performance, health (partial).
**Steps:** steps 3–8 (no new member/dep for the extend cases — only `wa_flow_events`/`wa_phone_quality_history` add collections). Add `wachat-quality-history` (full 8 steps).

### Wave 2 — P1 net-new crates
**Crates:** wachat-auto-reply-settings, wachat-ai-training, wachat-canned-messages, wachat-project-agents, wachat-contact-merge, wachat-interactive-builder, wachat-flow-events, wachat-ab-testing.
**Pages:** auto-reply, automation, chatbot, saved-replies, settings/canned, chat (canned read), settings/agents, contact-merge, templates/interactive-message-builder, campaign-ab-test.
**Dependency:** wachat-ab-testing depends on `wachat-broadcast bulk-start` (exists); wachat-interactive-builder depends on `wachat-send` (exists). All full 8 steps.

### Wave 3 — P1/P2 migrations + external-seam crates
**Crates:** wachat-contacts-export-sync, wachat-integrations-hub, wachat-razorpay, wachat-link-generator, wachat-number-routing, wachat-post-generator, wachat-setup-kb, wachat-ai-ad-copy, templates multilang/library-rate (in `wachat-templates-actions`).
**Pages:** contacts (export/sync), integrations, integrations/razorpay, integrations/whatsapp-widget-generator, whatsapp-link-generator, two-line, post-generator, whatsapp-ads, templates/create, templates/library, webhooks (frontend wiring to existing developer-webhooks + api-keys crates).
**Note:** resolve the razorpay ownership overlap (#7 vs #8) **before** building — recommend `wachat-razorpay` owns settings+proxy, integrations-hub references it.

### Wave 4 — P3 / low priority
**Crates:** wachat-ads-roadmap.
**Pages:** whatsapp-ads/roadmap, and any remaining docs/redirect stubs (no backend needed).

---

## 5. RISKS / EXTERNAL DEPENDENCIES

External-seam crates must isolate the third-party call behind a single trait/module so the crate compiles and routes without live creds, returning a typed 502/`ApiError::Upstream` when the seam is unconfigured.

| Crate | External seam | Build strategy |
|---|---|---|
| **wachat-ai-ad-copy**, **wachat-post-generator** | LLM (Anthropic/OpenAI) | Route through **Vercel AI Gateway** (`ai-gateway.vercel.sh`). Fetch current model IDs at build time (newest `claude-*` / `gpt-*`); never hardcode from memory. Keep AI *generation* in the Next streaming route where it already lives; Rust only persists drafts + does Graph publish. Seam = `mod llm { async fn generate(prompt) -> Copy }`. |
| **wachat-post-generator** (publish) | Meta Graph API (`/{page}/feed`, status media) | Reuse OAuth token already stored by `wachat-facebook-*`. Seam = `mod graph_publish`. Returns `Upstream` if token missing — never panics. |
| **wachat-razorpay** | Razorpay REST (`payments.all`, `paymentLink.*`) | reqwest with stored `keyId/keySecret` from `projects.razorpaySettings`. Seam = `mod razorpay_client`. Provider refund in `wachat-pay` is also a stub — flag for same treatment. |
| **wachat-contacts-export-sync** | Google Contacts OAuth, Shopify Admin API | Sync endpoints behind `mod sync::{google,shopify,vcard}`; vCard parse is local (no external), ship it first; Google/Shopify gated on stored integration creds. |
| **wachat-link-generator** | (removes externals) | `/shorten` + `/qr` replace TinyURL + api.qrserver.com — **reduces** external surface; QR via a Rust `qrcode` crate → PNG. Privacy win: stops leaking phone numbers to third parties. |
| **wachat-quality-history**, **wachat-flow-events** | none direct | Depend on **webhook/executor writing the collection**. Build read endpoints now; coordinate the write-side with `wachat-webhook-*` (quality) and the flow executor (events) — until those write, GET returns empty (honest empty-state, not mock). |
| **wachat-ai-training**, **wachat-ab-testing** | none (results via internal broadcast webhook callback) | Pure Mongo + internal `wachat-broadcast` reuse. No external risk. |

**Cross-cutting risks:**
- **Two-store gotcha:** all migrations (`[MIGRATE]`) must point at the SAME collection the Rust-owned reads use, or pickers/counts silently vanish. Verify `canned_messages`→`wa_canned_messages`, `razorpaySettings` on `projects`, `wa_link_clicks` single-owner.
- **Razorpay double-ownership** (#7/#8) — must be deduped before Wave 3.
- **`tsc` OOMs <12GB** on the WaChat tree — typecheck rewired pages with 16GB heap, grep-scoped to `src/app/wachat`.
- **AppState bloat:** ~18 new `FromRef` impls + fields. Batch state.rs edits per wave to avoid merge churn; the file already carries 100+ states so the pattern is proven.