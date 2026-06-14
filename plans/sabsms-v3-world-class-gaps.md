# SabSMS v3 — Closing the World-Class Gap (Omnichannel Orchestration · Verify · Enterprise)

> **For agentic workers:** this is a **program plan** (~12 independent subsystems). Each phase (V3.0–V3.11) warrants its own detailed task-by-task execution plan at build time, in the style of `plans/sabsms-v2-beyond-world-class.md`. Do NOT try to execute this file directly as one TDD checklist — split per phase. Steps below define goal, files, accept, and verify per phase.

**Goal:** Take SabSMS from "best-in-class SMS engine" to "world-class omnichannel CPaaS" by closing the feature gaps the global leaders (Twilio, Vonage, Sinch, Infobip, Bird, Plivo, Telnyx, Bandwidth, AWS, Gupshup, MSG91, Kaleyra) ship and SabSMS does not.

**Architecture:** SabSMS becomes the **orchestration brain** — a unified Messages + Verify + Journeys + Governance layer — that fans out to channels owned by sibling SabNode modules (WhatsApp → WaChat, Email → SabMail, Voice → SabCall, Live chat → SabChat) and its own SMS/MMS/RCS Rust engine. Every channel dispatch flows through SabSMS's compliance kernel first, so WhatsApp/email/voice inherit SMS-grade consent/suppression/quiet-hours/frequency governance — the structural guarantee competitors lack.

**Tech Stack:** Rust/Axum engine (`services/sabsms-engine`), Next.js 16 server actions + 20ui (`src/app/sabsms`, `src/lib/sabsms`), Redis Streams bridge, Mongo, existing module clients (`src/lib/rust-client/wachat-*`, `src/lib/sabmail`, `src/lib/calls`/`src/app/api/v1/calling`, `src/lib/sabchat`).

---

## Context

SabSMS v2 (per `plans/sabsms-v2-beyond-world-class.md`) shipped: the truthful SMS/MMS/RCS engine, cross-provider failover routing, India DLT automation, OTP + fraud guard, campaigns/journeys/segments, analytics + identity graph, AI sales agent, reseller/rate-card engine, link shortener, Pinpoint importer. **SabSMS already leads incumbents** on cross-provider routing, reseller/white-label/margin, DLT automation, and compliance-aware AI agent.

A June 2026 R&D pass against the 12 global providers surfaced the remaining gaps. **Verified against the actual codebase** (not the plan):

- Engine `Channel` enum = `Sms | Mms | Rcs` only (`services/sabsms-engine/src/types.rs:16`). No WhatsApp/voice/email/OTT.
- OTP is **single-channel SMS** (`engine-client.ts:483` `otpSend`); no cross-channel Verify fallback.
- `/v1/lookup` exists but **line-type only** (`engine-client.ts:556` `lookupNumber`); no SIM-swap/CNAM/identity/HLR/pumping-score.
- 10DLC is a **manual status-tracking form** — code comment: *"There is NO live TCR API integration"* (`src/app/sabsms/compliance/10dlc/actions.ts:11`). No toll-free verification.
- **No SMPP**, **no frequency capping**, **no geo-permissions product**, **no customer-facing event sinks**, **no published SDKs**, **no SNA/SIM-swap/flash-call** (anywhere in `src/lib/sabsms` or `services/sabsms-engine/src`).

### Two owner reframes (these shrink the build)

1. **Voice = SabCall** (sibling module being set up). SabSMS does **not** build voice — it orchestrates to SabCall via a thin client, exactly as email is SabMail's job. Seam: `src/lib/calls`, `src/app/api/v1/calling`, `src/app/dashboard/sabvoice`.
2. **WhatsApp = WaChat** (fully working, official WhatsApp Business API). SabSMS does **not** build WhatsApp — it orchestrates to WaChat. Seam: `src/lib/rust-client/wachat-broadcast.ts` (`wachatBroadcastApi`), `src/lib/rust-client/wachat-facebook-messaging.ts`, backed by `services/sabwa-node`.

So the headline is **orchestration, not channel-building**. The omnichannel + WhatsApp-OTP + email-OTP + voice-OTP gaps collapse into adapter/integration work.

---

## Architecture decisions (locked)

1. **Channel adapter layer** — `src/lib/sabsms/channels/dispatcher.ts` exposes one uniform `dispatch(channel, recipient, payload, ctx) → { channelUsed, providerMessageId, status, cost }`. Adapters in `src/lib/sabsms/channels/adapters/`:
   - `sms` / `mms` / `rcs` → SabSMS engine (`engineClient.enqueueSend`)
   - `whatsapp` → WaChat (`wachatBroadcastApi` + wachat-facebook-messaging) — **read the WaChat client, never re-implement WhatsApp**
   - `email` → SabMail (`sendSabmailOwnDomain` in `src/lib/sabmail/sending.ts:227`)
   - `voice` → **SabCall client** (`src/lib/sabsms/channels/adapters/voice.ts` calls `src/app/api/v1/calling` / a `sabcallClient`) — ship an **interface + stub now**, bind when SabCall lands
   - `chat` → SabChat (`src/lib/sabchat`)
2. **Compliance stays centralized & runs first.** Every `dispatch()` passes through the SabSMS compliance kernel (consent, suppression, quiet hours, **new** frequency cap, **new** geo-permissions) BEFORE fan-out. WhatsApp/email/voice inherit SMS governance. This is the moat — no competitor enforces one consent/suppression ledger across all channels.
3. **Verify orchestration is Next-side, OTP send stays engine-side.** Engine owns SMS-OTP hot path (`otp/mod.rs`); a new `src/lib/sabsms/verify/orchestrator.ts` drives cross-channel fallback ordering (SMS → voice[SabCall] → WhatsApp[WaChat] → email[SabMail] → TOTP/push) because those channels are Next-side modules. One `verifyStart` / `verifyCheck` public API.
4. **Lookup becomes a product, not a pass-through.** Extend `/v1/lookup` to return layered "packages": line-type (have), carrier, ported/MNP, **SIM-swap** (Twilio/Telnyx pass-through), **CNAM**, **reachability/HLR**, **SMS-pumping risk score**. Cached in Redis. Surfaced as a `src/app/sabsms/lookup/` UI + API + an optional pre-send gate.
5. **Governance products** — Geo Permissions (`compliance/geo.rs` + UI), global frequency capping (Redis counters keyed `{ws}:{e164}:{window}`), and a **cross-tenant SMS-pumping risk score** (SabNode is multi-tenant → the data moat incumbents gate-keep is available to us for free).
6. **Registration automation** — replace the manual 10DLC form with live **TCR brand/campaign registration** via provider APIs (Twilio/Telnyx/Bandwidth campaign-registry endpoints) + **toll-free verification** submission. DLT operator-portal sync where APIs exist; manual import elsewhere.
7. **Event Streams + Sinks (customer-facing)** — built on the existing `sabsms:events` Redis stream + `webhooks-out`: normalized, versioned event schema delivered to customer sinks (webhook [have] + HTTP-batch + Kafka/Redpanda + Kinesis + Segment), at-least-once with retry buffer.
8. **SDKs generated from the existing OpenAPI** (`src/lib/sabsms/apikeys/openapi.ts`): Node + Python first, then PHP/Java/Go/.NET.
9. **Network APIs (carrier-gated, last)** — SNA, SIM-swap-at-verify, Flash Call, CAMARA/Open Gateway (Number Verification, Quality-on-Demand) via an aggregator deal (Vonage/Twilio/Infobip). Ship the **interface + Lookup-based pass-through** now; deepen as carrier/aggregator contracts land. Mirrors v2's "v3 deferral" of exactly these.
10. **Platform track (parallel)** — data-residency regions, a certifications roadmap (HIPAA/PCI/SOC2/ISO), and a global regulatory-guidelines DB (per-country sender-ID rules) extending beyond today's US+India coverage.

---

## File structure (new + key modifications)

```
src/lib/sabsms/
  channels/
    dispatcher.ts            # uniform dispatch() + compliance pre-flight
    types.ts                 # Channel union incl. whatsapp/email/voice/chat
    adapters/{sms,whatsapp,email,voice,chat}.ts
    __tests__/dispatcher.test.ts
  verify/
    orchestrator.ts          # cross-channel OTP fallback + TOTP/push
    totp.ts
    __tests__/orchestrator.test.ts
  governance/
    frequency-cap.ts         # global per-contact cap across campaigns/journeys
    geo-permissions.ts
    pumping-risk.ts          # cross-tenant risk score
  lookup/
    packages.ts              # layered lookup result assembly + cache
  sinks/
    dispatch.ts              # event → customer sink fan-out
    sinks-core.ts            # webhook|http-batch|kafka|kinesis|segment
  registration/
    tcr.ts                   # 10DLC brand/campaign via provider APIs
    tollfree.ts

services/sabsms-engine/src/
  types.rs                   # MODIFY: Channel enum stays SMS/MMS/RCS (others are Next-side)
  otp/mod.rs                 # MODIFY: channel_order + fallback handoff signal
  handlers/lookup.rs         # NEW: layered lookup packages
  compliance/geo.rs          # NEW: geo-permissions kernel check
  compliance/frequency.rs    # NEW: frequency-cap kernel check
  smpp/                      # NEW: SMPP server (or services/sabsms-smpp/)

src/app/sabsms/
  lookup/                    # NEW UI: number intelligence
  verify/                    # NEW UI: multi-channel verify config + analytics
  compliance/geo/            # NEW UI: geo permissions
  compliance/registration/   # NEW UI: live 10DLC + TFN registration (replaces manual form)
  settings/sinks/            # NEW UI: event-stream sinks
  channels/                  # NEW UI: omnichannel composer + fallback rules

sdks/
  node/  python/             # NEW: generated clients
```

---

## Phases

```
V3.0 channel dispatcher + centralized compliance ──► V3.1 multi-channel Verify
                                                 ├─► V3.2 omnichannel send + unified inbox + fallback
                                                 ├─► V3.3 Lookup product
                                                 ├─► V3.4 governance (geo-perms + freq-cap + pumping score)
                                                 ├─► V3.5 registration automation (TCR + TFN + DLT sync)
                                                 ├─► V3.6 SMPP gateway
                                                 ├─► V3.7 event streams + sinks
                                                 ├─► V3.8 SDKs
                                                 ├─► V3.9 flash call + network APIs (carrier-gated)
                                                 ├─► V3.10 predictive ML + agent copilot + managed RAG
                                                 └─► V3.11 platform: residency + certs + regulatory DB
```

### V3.0 — Channel dispatcher + centralized compliance (foundation; blocks V3.1, V3.2)
**Goal:** one `dispatch()` seam that routes any channel through the compliance kernel before fan-out.
**Files:** create `src/lib/sabsms/channels/{dispatcher,types}.ts` + `adapters/{sms,whatsapp,email,voice,chat}.ts`; modify `src/lib/sabsms/engine-client.ts` (reuse `enqueueSend`); read-only bind to `wachatBroadcastApi`, `sendSabmailOwnDomain`; `voice.ts` = stubbed `SabCallClient` interface; tests `channels/__tests__/dispatcher.test.ts`.
**Accept:** `dispatch('whatsapp', …)` for a STOP-suppressed contact is **blocked by the SMS suppression ledger** (proves cross-channel governance); `dispatch('sms', …)` round-trips through the engine unchanged; `voice` adapter returns `not_configured` cleanly until SabCall lands.
**Verify:** vitest with mocked module clients; assert compliance kernel called before every adapter; assert normalized return shape.

### V3.1 — Multi-channel Verify orchestration (the #1 table-stakes win)
**Goal:** `verifyStart`/`verifyCheck` that auto-falls-back SMS → voice(SabCall) → WhatsApp(WaChat) → email(SabMail) → TOTP/push.
**Files:** create `src/lib/sabsms/verify/{orchestrator,totp}.ts`; modify `services/sabsms-engine/src/otp/mod.rs` (accept `channel_order`, emit `fallback_needed` when a channel yields no conversion); new `src/app/sabsms/verify/` UI (channel order, per-channel templates, conversion-by-channel analytics); modify `engine-client.ts` verify surface.
**Accept:** a number that fails SMS OTP escalates to voice within the configured window; WhatsApp-OTP path uses WaChat template; TOTP enroll+verify works offline; conversion tracked per channel.
**Verify:** vitest state machine with injectable clock + mocked channel adapters; golden fixtures for fallback ordering; engine `cargo test` for `channel_order` parsing.

### V3.2 — Omnichannel send + journeys + unified inbox + cross-channel fallback
**Goal:** one composer/journey step can target `channel = whatsapp_preferred | rcs_preferred | sms`, falling back WhatsApp→SMS and RCS→SMS at send time; one inbox renders all channels.
**Files:** new `src/app/sabsms/channels/` composer; modify journeys executor (`src/lib/sabsms/journeys/executor.ts`) to call `dispatch()`; modify campaigns to accept channel strategy; wire unified inbox (reuse `src/lib/sabchat` thread UI or extend `src/app/sabsms/inbox`); record `channelUsed` + fallback rate in analytics.
**Accept:** one campaign → WhatsApp template to WhatsApp-reachable contacts, SMS to the rest, with a fallback-rate metric; inbound WhatsApp reply lands in the same SabSMS inbox thread as SMS.
**Verify:** 200-recipient mixed-capability mock e2e; Playwright composer + inbox slice.

### V3.3 — Number Lookup product (layered intelligence + pre-send gate)
**Goal:** turn `/v1/lookup` into a real intelligence product.
**Files:** create `services/sabsms-engine/src/handlers/lookup.rs` + `src/lib/sabsms/lookup/packages.ts`; modify `engine-client.ts` `lookupNumber` to accept `fields[]`; new `src/app/sabsms/lookup/` UI; optional pre-send gate flag in settings.
**Accept:** lookup returns line-type + carrier + ported + SIM-swap (pass-through) + CNAM + reachability + pumping-risk in one call; results cached; pre-send gate blocks known-invalid/high-risk numbers when enabled.
**Verify:** wiremock-rs per provider lookup; vitest cache + package assembly; corpus of known numbers.

### V3.4 — Governance: Geo Permissions + frequency capping + cross-tenant pumping score
**Goal:** structured spend/fraud governance the leaders ship.
**Files:** create `services/sabsms-engine/src/compliance/{geo,frequency}.rs` (kernel checks) + `src/lib/sabsms/governance/{geo-permissions,frequency-cap,pumping-risk}.ts`; new `src/app/sabsms/compliance/geo/` UI; extend `compliance` page.
**Accept:** non-enabled country is blocked **without charging**; per-contact global cap (e.g. ≤N/day across all campaigns) enforced; a prefix burst with zero conversion across **multiple tenants** raises the shared risk score and auto-throttles.
**Verify:** table-driven `cargo test` (geo + frequency); cross-tenant pumping scenario in `scripts/sabsms-e2e.mjs`.

### V3.5 — Registration automation (TCR 10DLC + toll-free verification + DLT operator sync)
**Goal:** replace the manual status form with live registration.
**Files:** create `src/lib/sabsms/registration/{tcr,tollfree}.ts`; rewrite `src/app/sabsms/compliance/10dlc/actions.ts` (kill the "no live TCR" stub) + page; add toll-free verification flow; DLT operator-portal sync where APIs exist (extend `compliance/dlt`).
**Accept:** submit a brand + campaign through a provider's TCR API from the UI, poll status to `registered`, and have the routing/compliance gate read live status; TFN verification submitted + tracked.
**Verify:** wiremock provider registration endpoints; status-machine `cargo test`/vitest; manual sandbox submission documented.

### V3.6 — SMPP gateway (enterprise connectivity)
**Goal:** let enterprise/aggregator customers bind via SMPP.
**Files:** create `services/sabsms-engine/src/smpp/` (or new `services/sabsms-smpp/`) — SMPP 3.4 server translating `submit_sm` → `enqueueSend`, DLRs → `deliver_sm`; per-account bind credentials reuse the api-keys store; PM2 app `sabsms-smpp`.
**Accept:** an SMPP client binds, submits, receives a DLR; throughput honors the account's MPS; auth rejects bad credentials.
**Verify:** SMPP integration test with an open-source client lib; load test for MPS throttle.

### V3.7 — Event Streams + managed sinks (customer-facing)
**Goal:** customers stream normalized events to their own data infra.
**Files:** create `src/lib/sabsms/sinks/{dispatch,sinks-core}.ts` (webhook|http-batch|kafka|kinesis|segment); versioned event schema; new `src/app/sabsms/settings/sinks/` UI; consume the existing `sabsms:events` stream + reuse `webhooks-out` retry machinery.
**Accept:** every send/DLR/inbound/click event reaches a configured sink at-least-once with retry; schema is versioned; replay works.
**Verify:** vitest fan-out + retry; e2e: configure a webhook sink, send, assert delivery + replay.

### V3.8 — Published SDKs (Node/Python → others)
**Goal:** real client libraries, not just a docs page.
**Files:** create `sdks/node` + `sdks/python` generated from `src/lib/sabsms/apikeys/openapi.ts`; CI to publish; wire `api-docs`/`sdk-reference` to the real packages.
**Accept:** `npm i @sabnode/sabsms` (or equivalent) → send an SMS + start a verify in <10 lines; Python parity; generated from the live OpenAPI so they never drift.
**Verify:** SDK smoke tests in CI against a sandbox key; OpenAPI-diff gate.

### V3.9 — Flash Call + Network APIs (SNA / SIM-swap / CAMARA) — carrier-gated
**Goal:** the modern frictionless-auth tier; interface now, depth as deals land.
**Files:** extend `src/lib/sabsms/verify/orchestrator.ts` with `flashcall` + `sna` rungs; `network-apis.ts` adapter (aggregator pass-through: Vonage/Twilio/Infobip CAMARA); SIM-swap consumed by Verify + Lookup + fraud.
**Accept:** Flash Call verification works via a provider that offers it (big in India); SNA/Number-Verification pass-through returns a verdict; SIM-swap signal gates high-risk OTP.
**Verify:** mocked aggregator endpoints; document the carrier/aggregator onboarding prerequisites (the real blocker, not code).

### V3.10 — Predictive ML + agent copilot + managed RAG
**Goal:** close the AI gap beyond the existing autonomous agent.
**Files:** `src/lib/sabsms/ml/{send-time,traits}.ts` (predictive send-time/churn-convert scoring layered on the identity graph); agent **copilot** mode (suggested replies / auto wrap-up / topic tagging) in the inbox; managed RAG over a knowledge base for `src/lib/sabsms/agent/tools.ts`.
**Accept:** predictive send-time beats the histogram baseline on a holdout; human agent gets one-click suggested replies + auto-summary; agent answers from a KB via RAG with citations.
**Verify:** offline eval harness (extend `scripts/sabsms-agent-eval.mjs`); A/B send-time backtest.

### V3.11 — Platform: data residency + certifications + global regulatory DB (parallel track)
**Goal:** enterprise/"big provider" credibility.
**Files:** region pinning for data (Mongo/Redis/R2 region config + per-workspace residency flag); certifications roadmap doc + control implementations (audit log completeness, encryption, access reviews); `src/lib/sabsms/compliance/regulatory-db.ts` (per-country sender-ID rules, continuously updatable) + admin UI.
**Accept:** a workspace pinned to EU keeps message data in EU; regulatory DB drives sender-ID validation for ≥10 countries beyond US+India; audit log covers every state change.
**Verify:** residency e2e (assert no cross-region writes); regulatory-rule fixtures; SOC2-style control checklist.

---

## Cuts (honest)

- **Do not build voice / WhatsApp / email channels** — SabCall / WaChat / SabMail own them. SabSMS ships only thin adapters. (Voice adapter is a stub until SabCall is live.)
- **Direct-to-carrier connections / owning a carrier network** — structural; SabSMS stays a smart aggregator-of-aggregators. Out of scope.
- **Segment-class CDP from scratch** — reuse the identity graph + SabCRM; do not build a separate CDP.
- **OTT breadth** (LINE / KakaoTalk / Zalo / Viber / Instagram / Apple Messages for Business) — the dispatcher's `Channel` union reserves them; defer adapters until there's demand. WhatsApp (via WaChat) covers the highest-value OTT case for the India market.
- **ML adaptive routing** — keep v2's rule+health routing; revisit only after the pumping-risk data moat (V3.4) matures.
- **Certifications themselves** (the audits) are an ops/legal effort; V3.11 implements the *controls*, not the paperwork.

---

## Effort & sequencing

V3.0 is the keystone (everything omnichannel hangs off the dispatcher). V3.1 (multi-channel Verify) is the highest-ROI single win and should follow immediately. V3.2–V3.8 are largely independent and parallelizable. V3.9 is gated on external carrier/aggregator deals — start that paperwork during V3.3. V3.11 runs as a parallel platform track. Estimate ~40–50 PRs; the heaviest net-new code is V3.6 (SMPP, Rust) and V3.7 (sinks); most other phases are wiring + UI over existing engines.

## Critical files

- `src/lib/sabsms/channels/dispatcher.ts` — the new omnichannel seam; everything fans out through it
- `src/lib/sabsms/engine-client.ts` — the door to the SMS engine (already has `enqueueSend`, `otpSend`, `lookupNumber`)
- `src/lib/rust-client/wachat-broadcast.ts` (`wachatBroadcastApi`) — WhatsApp seam (read, never re-implement)
- `src/lib/sabmail/sending.ts:227` (`sendSabmailOwnDomain`) — email seam
- `src/app/api/v1/calling` / `src/lib/calls` — voice seam → SabCall (bind when it lands)
- `services/sabsms-engine/src/types.rs:16` — `Channel` enum stays SMS/MMS/RCS (omnichannel is a Next-side concern)
- `src/app/sabsms/compliance/10dlc/actions.ts` — the manual-stub file V3.5 replaces with live TCR
- `src/lib/sabsms/apikeys/openapi.ts` — source of truth the SDKs (V3.8) generate from

## Verification strategy

- **Rust:** `cargo test` pure-logic fixtures (geo, frequency, lookup packages, SMPP framing, OTP channel_order); wiremock-rs for provider HTTP.
- **TS:** vitest for dispatcher governance pre-flight, verify state machine (injectable clock), sink fan-out/retry, regulatory rules; the segments parity vector stays the anti-drift artifact.
- **E2E:** grow `scripts/sabsms-e2e.mjs` per phase — cross-channel suppression, mixed-capability campaign, cross-tenant pumping, sink delivery+replay, live TCR sandbox submission.
- **Anti-drift:** the channel-adapter return shape and the public Verify/Lookup API are contract-tested so SDKs (V3.8) and sinks (V3.7) never diverge.
- After each phase: `graphify update .` per project CLAUDE.md.
```

---

## Progress log

- **2026-06-14 — Batch 1 (V3.0) DONE & verified.** Channel dispatcher + centralized compliance pre-flight shipped:
  - `src/lib/sabsms/channels/{types,dispatcher,compliance-preflight,index}.ts` + `adapters/{sms,whatsapp,email,voice,chat}.ts`.
  - SMS/MMS/RCS adapter wired for real to `sabsmsEngine.enqueueSend`. WhatsApp/email/voice/chat are typed **deferred bindings** returning `not_configured` (whatsapp→WaChat in V3.1, email→SabMail in V3.1, voice→SabCall when it lands, chat→SabChat in V3.2).
  - `phoneHash` matches the engine's `compliance::hash_phone` exactly (sha256 of raw E.164 incl. `+`). Cross-channel suppression proven: a STOP blocks WhatsApp/voice via the one gate.
  - Tests: `channels/__tests__/dispatcher.test.ts` — 9 passing (`npx tsx --test`).
- **2026-06-14 — Batch 2 (V3.4 geo permissions) DONE & verified.** `SabsmsGeoPermissions` type + `geoPermissions?` on `SabsmsSettings`; `src/lib/sabsms/governance/geo-permissions.ts` (`evaluateGeo` pure + `loadGeoConfig`); wired into the pre-flight (only acts on confidently-resolved countries; runs after suppression). Tests: `governance/__tests__/geo-permissions.test.ts` — 7 passing.
- **2026-06-14 — Batch 3 (V3.1 multi-channel Verify) DONE & verified.**
  - `verify/codes.ts` (numeric code / salt / `sha256(code+salt)` / constant-time compare / recipient hash) + `verify/orchestrator.ts` (`verifyStart` with SMS→WhatsApp→voice→email fallback via `dispatch()`; `verifyCheck` idempotent, attempt-capped, TTL-aware). New `sabsms_verifications` collection (+ unique index + TTL). All collaborators injected.
  - **Email adapter wired for real** → `sendSabmailOwnDomain`. **WhatsApp adapter wired for real** → `wachatBroadcastApi.apiStart`, gated on a new `SabsmsSettings.whatsapp` linkage ({wachatProjectId, phoneNumberId, tenantId?, otpTemplateId?}), tenant-scoped via `runWithRustTenant`; degrades to `not_configured` without the link.
  - Tests: `verify/__tests__/orchestrator.test.ts` — 12 passing.
- **2026-06-14 — Batch 4 (V3.4 governance, COMPLETE) DONE & verified.** Geo permissions (batch 2) + **frequency cap** (`governance/frequency-cap.ts`, per-contact global cap across campaigns/journeys; OTP/`allowSuppressed` bypasses) + **cross-tenant SMS-pumping risk score** (`governance/pumping-risk.ts`, the multi-tenant data-moat differentiator; opt-in guard in `verifyStart`). Tests: `frequency-cap.test.ts` (8) + `pumping-risk.test.ts` (4).
- **2026-06-14 — Batch 5 (V3.7 Event Streams + Sinks, core) DONE & verified.** `sinks/sinks-core.ts` (versioned envelope `v=1`, kind classification, sink matching — reuses `webhooks-out` event naming) + `sinks/dispatch.ts` (signed-HTTP for webhook/http_batch/segment reusing `webhooks-out` HMAC+backoff; injected transport for kafka/kinesis; retry classification 5xx/network=retryable, 4xx=terminal). Tests: `sinks/__tests__/sinks.test.ts` (10). **Remainder:** the `sabsms_event_sinks` collection + live consumer worker (read `sabsms:events` → fanOut → persist deliveries) + config UI.
- **2026-06-14 — Batch 6 (API + UI wiring) DONE (tsc-pattern-verified; needs running app for render/live verify).**
  - **Public API** for the multi-channel Verify orchestrator: `POST /api/v1/sms/verify/start` + `/verify/confirm` (new `src/app/api/v1/sms/verify/{start,confirm}/route.ts`), using the existing `withSabsmsApi('otp', …)` guard. Distinct from the legacy SMS-only `verify/send`+`verify/check` (engine OTP) — both coexist. `start` runs the cross-tenant `pumpingGuard`; status→HTTP mapping on `confirm`.
  - **Governance settings UI**: `settings/governance-actions.ts` (read/write `geoPermissions`+`frequencyCap`+`whatsapp` on `sabsms_settings`, RBAC `sabsms_settings`, normalized) + `settings/governance-card.tsx` (20ui card: geo mode/countries, frequency per-hour/day, WhatsApp→WaChat linkage) wired into `settings/page.tsx`. Mirrors the existing `short-links-card` pattern exactly.
- **Test status: 48/48 passing** (`npx tsx --test` across channels/governance/verify/sinks); API routes + settings card match proven repo patterns but need the running app (live Mongo + engine + render) to verify end-to-end.
- **Not committed** (no user request; pre-existing unrelated working-tree changes left untouched).
- **Remaining phases & what they need to finish + verify:**
  - **V3.2** omnichannel send UI + unified inbox + cross-channel fallback — large UI; needs the running app to verify.
  - **V3.3** Lookup product — engine-side (Rust `handlers/lookup.rs`) for SIM-swap/CNAM/HLR/pumping-score; needs `cargo` + provider creds.
  - **V3.5** TCR 10DLC + toll-free registration automation — external provider APIs/creds.
  - **V3.6** SMPP gateway — Rust; needs `cargo` + an SMPP client to test.
  - **V3.7 remainder** — sinks collection + consumer worker + UI (needs running stack).
  - **V3.9** Flash Call + SNA/SIM-swap/CAMARA — carrier/aggregator onboarding (the real blocker, not code).
  - **V3.10** predictive ML + agent copilot + managed RAG — needs data + LLM gateway wiring.
  - **V3.11** data residency + certifications + global regulatory DB — platform/ops.
  - **UI for shipped backends:** `src/app/sabsms/verify/`, `compliance/geo/`, settings for frequency-cap + WhatsApp linkage + sinks.
