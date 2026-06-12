# SabSMS v2 — Beyond World-Class SMS Platform

## Context

SabSMS exists today as a wide but shallow build: ~74k LOC of 20ui pages across 37 route groups in `src/app/sabsms/`, a 1,647-LOC Rust/Axum engine at `services/sabsms-engine/` (Phase 1 of the old `plans/sabsms-world-class-plan.md`), and 13 Mongo collections + 15 RBAC keys + credit rates already registered. But the "real-looking" pages (campaigns/create, routing, health, api-keys, analytics) are **mock-data shells with zero fetch calls**, and the engine has three trust-critical lies:

- `worker.rs` hardcodes `TwilioProvider` + env-level creds — the per-workspace encrypted creds collection is ignored (verified at `worker.rs:35`).
- `handlers/webhook.rs` rejects every provider but Twilio and assigns ALL inbound to `SABSMS_DEFAULT_WORKSPACE` (verified at lines 30, 88).
- `src/app/api/sabsms/credits/route.ts` **always approves** — credits are not actually metered (verified, `approved: true` unconditionally).
- A vestigial Node send path (`src/lib/sabsms/engine/send.ts`) pushes to a BullMQ queue nothing consumes.

**Goal:** make SabSMS the most advanced SMS platform in the world. Web R&D (June 2026, sourced) identified 10 differentiators **no competitor fully nails**, which this plan layers on top of the table-stakes core:

1. AI sales agent (Postscript Shopper / Attentive Concierge class) + compliance + CPaaS API in ONE product
2. **Cross-provider** failover routing (every vendor only routes within its own network)
3. India DLT compliance automation (scrub simulator, suffix prediction, template sync — unowned territory)
4. Unified SMS+RCS composer with per-recipient capability fallback (RCS live on iOS 18.1+, 3.8B users forecast 2026)
5. OTP conversion-rate optimization loop (auto-reroute when conversion drops per carrier prefix)
6. Reseller pricing/margin engine (structural fit — SabNode is already credit-metered)
7. Conversation analytics (topic mining + intent trends over the whole inbox)
8. Journey orchestration for AWS Pinpoint refugees (Pinpoint journeys EOL Oct 30 2026)
9. Phone-number-keyed identity graph (Attentive Signal pattern)
10. Fraud guard default-on, not premium (SMS-pumping detection, zero-conversion prefix blocking)

**User decision:** India (MSG91/Gupshup/DLT) and US (Telnyx/10DLC/OTP) tracks run **in parallel** after the core.

This plan supersedes `plans/sabsms-world-class-plan.md` (write the new version there). It builds on the Rust engine (extend, never rewrite to Node), uses 20ui (the old plan's ZoruUI references are obsolete), and wires the existing UI shells rather than redesigning them.

---

## Architecture decisions (locked)

1. **Engine owns the hot path** (send, DLR, routing, compliance checks, OTP); Next.js owns CRUD, auth, UI, and **all LLM calls** (engine stays deterministic — no model calls in Rust, ever). Bridge = Redis Stream `sabsms:events` (engine XADDs inbound/DLR/send events; a Next-side PM2 consumer `sabsms-events` powers AI, analytics, identity graph, webhooks-out).
2. **Provider adapters**: extend the existing `SmsProvider` trait in `services/sabsms-engine/src/providers/mod.rs` with `caps()`, `SendOptions` (media_urls/dlt/rcs/callback_url), `health_probe()`, and `ProviderError::{Throttled, PermanentDestinationError}`. New `providers/registry.rs` (static map). Ship **4 adapters total**: Twilio, Telnyx, MSG91, Gupshup. Every DTO `#[serde(rename_all = "camelCase")]`.
3. **Creds resolution** (`creds.rs`): explicit providerAccountId → workspace default per (provider, country) → env fallback only when `SABSMS_ALLOW_ENV_CREDS=true`. AES-256-GCM decrypt (verify the exact cipher format the Next-side providers page writes BEFORE coding), moka 60s cache + `/v1/internal/creds/invalidate`.
4. **Routing engine** (`routing/{policy,health,circuit}.rs`): per-workspace ordered rules → weighted route candidates; per-(account, destCountry) rolling health in Redis written on every DLR; circuit breaker with hysteresis; failover ONLY on synchronous rejection (never on timeout — double-send risk); sticky sender via Redis `sabsms:sticky:{ws}:{e164}` 30-day TTL.
5. **Compliance kernel in the engine** (`compliance/mod.rs`): each pre-send check returns `Allow | Block(reason) | Reschedule(at)`; rescheduled → Redis ZSET delayed queue `sabsms:delayed` + ticker. Per-message `complianceTrace` array (audit-grade differentiator, cheap).
6. **DLT simulator** (`compliance/dlt.rs`): pure-logic, fixture-tested — `{#var#}` validation, template-match simulation, header binding, -P/-S/-T/-G suffix prediction, PE-TM chain (max 2). Exposed as `POST /v1/dlt/scrub-preview` for live editor feedback.
7. **RCS via aggregators**, not direct Google RBM (per-brand verification takes months — wrong for multi-tenant): Gupshup RBM (India) + Twilio Content API (US/EU) inside the existing adapters. Capability lookups cached 7 days in the identity graph.
8. **OTP/Verify engine-native** (`otp/`): hashed codes in Redis, conversion tracked per (account, country, carrier prefix) → router uses **conversion rate, not DLR rate**, for the OTP category. Fraud guard default-on in front.
9. **Identity graph**: `sabsms_identities` keyed `{workspaceId, e164Hash}` — consent snapshot, carrier, RCS capability, engagement aggregates, 24-bucket send-time histogram, channel affinity. Written by the events consumer; read by smart-send, channel selection, AI agent.
10. **Credits real + fail-closed**: keep the engine↔Next reserve/finalise contract (it's correct); rewrite the Next side with reservation docs + atomic holds + TTL auto-release + **batch reservation** (`op=reserve-batch`) so campaigns don't make 100k HTTP calls. Price is rate-card data from day one (enables the reseller engine later).

**Cuts (honest):** Vonage/Bird/Sinch/Infobip/AWS-SNS/Kaleyra adapters (enum reserves them); Zapier; `src/app/sabsms/email/` route group (SabMail's job); SabNode-managed shared number pool (legal/ops heavy); voice-fallback OTP (interface stub only); silent network auth + built-in SIM-swap (v3 — ship Lookup-API pass-through instead); Brazil/Canada/Australia compliance packs. Fold `rate-limits`, `idempotency`, `pool` pages into settings/numbers.

---

## Phases

```
V2.0 engine truth ──► V2.1 templates/send ──► V2.2 inbox+events ──┬─► V2.9 journeys+Pinpoint
                 │                        └─► V2.3 campaigns ─────┘
                 ├─► V2.4 compliance kernel + links + MMS
                 ├─► V2.5 four adapters + numbers ──► V2.6 cross-provider routing
                 │       US TRACK (parallel): V2.7 OTP + fraud guard
                 │       INDIA TRACK (parallel): V2.8 DLT automation
                 ├─► V2.10 analytics + identity graph ──► V2.12 AI agent + conv. analytics
                 ├─► V2.11 RCS unified composer
                 └─► V2.13 developer API + reseller engine
```

### V2.0 — Engine truth (blocks everything; nothing user-visible, everything trust-critical)
- `services/sabsms-engine/src/creds.rs` (new ~250 LOC): per-workspace cred resolution + AES-GCM + cache + invalidate endpoint. Replace env reads in `worker.rs` and `handlers/webhook.rs`.
- `handlers/webhook.rs`: workspace resolution via `sabsms_numbers` lookup on the `to` number (kill `SABSMS_DEFAULT_WORKSPACE`); upsert `sabsms_conversations` on inbound (currently missing).
- Retry/backoff in `worker.rs`: `Network/Throttled` → ZADD `sabsms:delayed` exponential backoff (max 3) → dead-letter `failed/max_retries`; new `delayed.rs` ticker.
- Real credits: rewrite `src/app/api/sabsms/credits/route.ts` + `src/lib/sabsms/credits/{ledger,rates}.ts` (reservations collection, atomic holds, TTL release, batch op).
- Delete dead path: `src/lib/sabsms/engine/send.ts`, `src/lib/sabsms/providers/twilio/`, fix imports.
- Suppression check moves engine-side (`compliance/mod.rs` skeleton).
- **Accept:** workspace-A creds never leak to B; zero-balance → `credit_rejected`; inbound lands in the right workspace; provider kill → retry → dead-letter. **Verify:** `cargo test` fixtures + new `scripts/sabsms-e2e.mjs` (pattern: `scripts/sabpay-e2e.mjs`; add `SABSMS_PROVIDER_MOCK=true` engine test mode).

### V2.1 — Templates + real send UI
- `src/app/sabsms/templates/actions.ts` CRUD; variables (`{{name}}` + DLT `{#var#}` styles); renderer `src/lib/sabsms/render.ts`.
- **Segments parity**: port engine GSM-7/UCS-2 counter to `src/lib/sabsms/segments.ts` with a shared test-vector JSON consumed by BOTH `cargo test` and vitest (the anti-drift artifact).
- Wire `send` (37-line shell), `quick-send`, `logs` pages; recipient picker = SabCRM contacts (SabFlow resourceLocator pattern); live counter + credit estimate.
- **Accept:** templated send from UI; counter matches engine-billed segments (GSM-7/UCS-2/emoji/161-char). **Verify:** vitest + Playwright send flow.

### V2.2 — Two-way inbox + STOP/HELP + event stream
- Engine: keyword interceptor (STOP/UNSUB/CANCEL/QUIT/END + per-workspace custom) → suppression + consent log + TCPA confirmation; HELP → help text; `events.rs` XADD on inbound/DLR/send.
- Next: events consumer `src/lib/sabsms/events/consumer.ts` + `scripts/sabsms-events-worker.mjs` (PM2 app `sabsms-events`); first handlers: unread counters, identity stub.
- Wire `inbox` (90-line shell): conversation list, thread view, reply (through engine-client = full compliance path), assignment, internal notes; realtime per wachat inbox pattern. Wire `suppressions` + `consent` pages.
- "Any reasonable method" opt-out: regex/phrase badge now; AI classifier closes it in V2.12.
- **Accept:** STOP → suppressed + confirmed <5s → next marketing send blocked; agent reply round-trips. **Verify:** signed inbound fixture e2e + Playwright.

### V2.3 — Campaigns that actually send
- Engine `campaigns.rs`: Next pre-renders recipients into `sabsms_campaign_recipients` chunks → `POST /v1/campaigns/{id}/launch` → engine claims chunks atomically, token-bucket throttle, pause/resume/cancel, batch credit reservation. Per-recipient idempotency key `campaignId:contactId` (unique index = double-send proof).
- Wire `campaigns/page.tsx` (582) + `campaigns/create` (replace `MOCK_SEGMENTS`); audience = SabCRM segment (existing evaluate actions have tests) / list / CSV import (existing `api/sabsms/imports/*`); `scheduled` page = future-dated campaigns.
- **Accept:** 5k-recipient campaign @10 msg/s, zero duplicates, pause <2s, accurate stats. **Verify:** `cargo test` token bucket + chunk claiming; 200-recipient mock e2e.

### V2.4 — Compliance kernel v1 + link shortener + MMS (two tracks)
- A: quiet hours (recipient-local; India promo 10:00–21:00 IST, US 8am–9pm) → `Reschedule`; consent gating for marketing; **10DLC gating** (block US marketing on accounts without verified registration — carriers drop it anyway since Feb 2025); wire `compliance` page (319) + 10dlc page to real state; `complianceTrace` in logs detail.
- B: shortener `sabsms_short_links` + `src/app/s/[slug]/route.ts` 302 + click event to stream; auto-shorten + branded domain in settings; MMS via `<SabFilePicker>` ONLY → R2 URL → `SendOptions.media_urls`.
- **Accept:** IN marketing at 22:00 IST rescheduled to 10:00 with trace; non-10DLC US marketing blocked; click attributed; MMS delivered. **Verify:** table-driven quiet-hours `cargo test` (highest-value suite).

### V2.5 — Four adapters + numbers + provider UI
- `providers/{telnyx,msg91,gupshup}.rs` + `registry.rs` + `errors_map.rs` (normalized error codes — health + analytics key on these; do it properly now).
- Generic webhook dispatch: `/webhook/{provider}/{accountId}/{direction}` (additive; keep Twilio legacy route). MSG91/Gupshup weak signatures → per-account webhook secrets in URL.
- Wire `providers` + `providers/[id]` (placeholder) — encrypted cred entry, test-connection button; wire `numbers` + `numbers/buy` (Twilio/Telnyx search/purchase via engine endpoints so creds stay engine-side); MSG91/Gupshup alphanumeric sender IDs manual + DLT header linkage.
- **Accept:** live sandbox send + DLR round-trip per provider. **Verify:** wiremock-rs + signed-payload fixtures per provider.

### V2.6 — Cross-provider failover routing + health (differentiator #2, the headline)
- `routing/{mod,policy,health,circuit}.rs`; replace hardcoded `TwilioProvider` in `worker.rs:35` with `routing::select(...)`; failover on synchronous rejection only; sticky sender; circuit hysteresis + min-volume.
- Wire `routing` page (595-line shell): rule builder + live health badges; wire `health` page (600) to `GET /v1/health/providers`.
- **Accept:** killing account A's creds shifts US traffic to B within one circuit window, zero lost messages; sticky contact keeps same `from` across 10 sends. **Verify:** circuit state-machine `cargo test` + chaos e2e (mock 500s → assert failover counts).

### V2.7 — OTP/Verify + fraud guard default-on (US track, parallel with V2.8; differentiators #5, #10)
- Engine `otp/{mod,store,fraud}.rs`: `POST /v1/otp/send|verify`, hashed codes in Redis, attempt/resend limits; conversion per (account, country, prefix) feeds router (OTP category routes on conversion, not DLR).
- Fraud guard ON by default: destination velocity, prefix-burst detection, zero-conversion prefix auto-blocklist (`sabsms_fraud_blocks`); ship in monitor-mode 2 weeks (env flag) before enforcing. Lookup pass-through (Telnyx/Twilio) plan-gated.
- New `src/app/sabsms/otp/` route group: config, conversion analytics, fraud review queue. Drop-in widget deferred to V2.13 (needs public keys).
- **Accept:** OTP p50 <150ms engine-side; simulated pumping (1k sends, contiguous prefix, 0 conversions) auto-blocks + alerts; conversion-based reroute fires in chaos test.

### V2.8 — India DLT automation (India track, parallel with V2.7; differentiator #3, the moat)
- `compliance/dlt.rs` (~600 LOC pure logic + fixture corpus): var validation, template-match simulation, header binding, suffix prediction, PE-TM chain. Enforce for IN destinations; verdicts marked advisory vs enforcing per check, promoted as confidence grows.
- Scrub-preview endpoint → live "Will this pass DLT?" panel in template editor (red/green per check + suffix explanation).
- Wire `compliance/dlt` placeholder: entity/header/template registries, CSV import from operator portals (Airtel/Jio/VIL/BSNL formats, versioned parsers), TM chain config. MSG91/Gupshup adapters attach `{entityId, templateId}` automatically.
- **Accept:** simulator agrees with a corpus of 50+ known operator pass/fail templates; IN send without registered template blocked with the failing check named.

### V2.9 — Journeys/drips + A/B + Pinpoint lifeboat (differentiator #8)
- **Next-side** journey executor on the event stream (minutes/days latency + branching churn + SabFlow synergy = TS, not Rust): `src/lib/sabsms/journeys/{executor,state,conditions}.ts`, `sabsms_journey_runs`; steps = send/wait/branch(replied|clicked|attribute)/exit/goal; idempotent step execution keyed `runId:stepId`.
- Wire `drips` (210) + `drips/create` placeholder (spike: reuse SabFlow canvas vs linear 20ui builder — decide in PR 1); A/B variants + deterministic hash assignment + auto-winner; wire `ab-tests` page.
- Pinpoint importer `src/lib/sabsms/import/pinpoint.ts` (~300 LOC + fixtures) — journeys EOL Oct 30 2026; must be marketing-ready well before.
- SabFlow forge blocks `sabsms_send`, `sabsms_wait_for_reply` (existing block pattern + `api/sabsms/blocks` route).
- **Accept:** 3-step reply-branch drip survives worker restarts; A/B winner matches hand-computed stats; sample Pinpoint export imports + runs. **Verify:** vitest state machine (injectable clock).

### V2.10 — Analytics + identity graph (differentiator #9; data for #7)
- Rollups `sabsms_stats_daily` written by events consumer (never aggregate 10M docs per page load) + backfill script + nightly reconciliation job.
- Wire `analytics` (618) + `analytics/cost`: funnel by provider/country/campaign, error-code Pareto, cost-vs-price margin, OTP conversion, click attribution.
- Identity graph `sabsms_identities` + nightly histogram/affinity cron; **smart send** = per-contact best-hour window via delayed queue (pure stats — no LLM; histograms beat it).
- **Accept:** analytics <500ms on 1M-message workspace; click reflected in identity doc <30s.

### V2.11 — RCS + unified composer (differentiator #4)
- `RcsPayload` in `SendOptions`; RCS paths in `gupshup.rs` (RBM) + `twilio.rs` (Content API); batch capability endpoint cached to identity graph; `channel=rcs_preferred` dispatch picks RCS or SMS-fallback at send time, records `channelUsed`.
- Unified composer in send/campaign/template: SMS text + optional rich card (image via SabFilePicker, suggested replies/actions), dual live preview, audience capability estimate ("~62% RCS-capable").
- Inbox renders RCS replies + suggested-reply postbacks. Plan-gated `sabsms.rcs_enabled`; **start aggregator RBM onboarding paperwork during V2.5** (lead time); ships dark until an agent is live.
- **Accept:** one campaign → rich card on RCS Android, SMS on iOS-17/landline; fallback rate in analytics.

### V2.12 — AI sales agent + conversation analytics (differentiators #1, #7; all LLM Next-side)
- Agent runtime `src/lib/sabsms/agent/{runtime,tools,guardrails}.ts` on the events consumer: persona/knowledge config, tools (CRM lookup, knowledge base, human handoff, CRM task), replies through engine-client = **full compliance/credits/routing stack** (the structural guarantee competitors lack).
- Guardrails FIRST: opt-out intent classifier runs before the agent on every inbound (closes V2.2's "any reasonable method" gap — classified opt-out → suppress, agent never sees it); quiet-hours-aware reply scheduling; max-turns; full audit `sabsms_agent_turns`; agent turns metered as a credit charge type.
- Rollout: suggested replies (one-click) → opt-in full-auto per conversation/segment, behind plan gate.
- Conversation analytics: batch topic/intent mining (LLM map-reduce → `sabsms_conversation_insights`), trends UI, per-campaign reply sentiment. Composer copy assistant w/ DLT-safe mode (emits `{#var#}`).
- Reuse the existing LLM gateway exclusively (`api/sabsms/imports/ai-mapping` is prior art).
- **Accept:** "please don't text me anymore" → suppressed, no agent reply; agent answers product question in auto-mode within quiet hours; every turn audited. **Verify:** golden-set eval harness `scripts/sabsms-agent-eval.mjs` (50 scripted conversations incl. adversarial opt-outs/jailbreaks) gates the PR.

### V2.13 — Developer platform + reseller engine (differentiator #6)
- Wire `api-keys` (595-line shell): hashed scoped keys, per-key rate limits (reuse SabFlow `apiRateLimit`); public API `src/app/api/v1/sms/*` as thin engine-client wrappers; OpenAPI → wire `api-docs`/`sdk-reference`.
- Outbound webhooks (`sabsms_webhooks_out` + deliveries — schemas exist): HMAC, retries, replay UI; V2.4 click events connect here. OTP drop-in widget (hosted JS + iframe on public verify API).
- Reseller engine: `sabsms_rate_cards` (per-tenant price per country/channel/category + carrier-fee pass-through line items), child-workspace wallets on existing hierarchy, margin report (price − cost), white-label toggles. Credits route consults rate cards (architected as data since V2.0 — mostly UI + admin here).
- **Accept:** external script sends + verifies OTP with only a public key; reseller sells child tenant at 2× cost and margin report matches ledger to the cent.

---

## Effort & sequencing

~44 PRs total; ~7.5k LOC Rust + ~21k LOC TS net-new. Table stakes complete after V2.5; first differentiator (cross-provider routing) live at V2.6; US and India compliance tracks (V2.7 ∥ V2.8) run in parallel per user decision. Pinpoint importer must land before late summer 2026.

## Critical files

- `services/sabsms-engine/src/providers/mod.rs` — trait extension; everything multi-provider hangs off it
- `services/sabsms-engine/src/worker.rs` — hardcoded Twilio + env creds + no retries; V2.0/V2.6 surgery site
- `services/sabsms-engine/src/handlers/webhook.rs` — workspace hardcode, Twilio-only guard, missing conversation upsert
- `src/app/api/sabsms/credits/route.ts` — always-approve stub → real metering
- `src/lib/sabsms/db/collections.ts` — all schemas; new collections extend it
- `src/lib/sabsms/engine-client.ts` — the only door to the engine (delete the vestigial `engine/send.ts` path)
- `plans/sabsms-world-class-plan.md` — replace with this plan (mark v1 superseded)

## Verification strategy

- **Rust:** `cargo test` pure-logic fixtures (segments, quiet hours, DLT corpus, circuit state machine, fraud heuristics); wiremock-rs for provider HTTP; `SABSMS_PROVIDER_MOCK=true` test-mode provider.
- **E2E:** `scripts/sabsms-e2e.mjs` patterned on `scripts/sabpay-e2e.mjs` (service token via `X-Sabsms-Service-Token`), grown per phase; chaos variants for routing.
- **TS:** vitest (segments parity via shared vector JSON with Rust — the #1 anti-drift artifact; render; journey state machine; rate cards); Playwright per wired UI slice.
- After each phase: `graphify update .` per project CLAUDE.md.
