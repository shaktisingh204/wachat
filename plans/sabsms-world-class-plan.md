# SabSMS — World-Class SMS / MMS / RCS Platform

> **Status:** SUPERSEDED 2026-06-12 by `plans/sabsms-v2-beyond-world-class.md`. Phase 0+1 of this plan shipped (with deviations: Rust engine at `services/sabsms-engine/` instead of Node/BullMQ worker; 20ui instead of ZoruUI). All further work follows the v2 plan.
> **Owner:** TBD. **Target tree:** `src/app/sabsms/`, `src/lib/sabsms/`, `services/sabsms-worker/`.
> **Sister modules:** SabWa (personal WhatsApp), Wachat (WhatsApp Cloud API), SabFlow (automation), SabCRM (contacts/segments). SabSMS reuses **Contacts**, **Segments**, **Templates**, **Credits**, **RBAC**, and **SabFiles** plumbing — do not duplicate any of those.
>
> **For agentic workers:** REQUIRED SUB-SKILL — `superpowers:writing-plans` to refine, `superpowers:executing-plans` or `superpowers:subagent-driven-development` to execute task-by-task. Steps use `- [ ]` checkboxes. Parallel agents are allowed (see memory entry `feedback_agent_limit.md`) but coordinate via the phase dependency graph below.

---

## Vision

A multi-provider, multi-country, compliance-first SMS platform that does for SMS what SabWa does for WhatsApp:

- **Transactional + promotional + conversational** in one product (OTP, alerts, marketing blasts, 2-way support inbox, drip sequences).
- **Multi-gateway** under a single abstraction (Twilio, Vonage / Nexmo, MessageBird / Bird, Plivo, Sinch, Infobip, AWS SNS, Telnyx, MSG91, Gupshup, TextLocal, Kaleyra, Karix) — customers attach their own credentials *or* use a SabNode-managed shared pool with markup.
- **10DLC + DLT + alphanumeric + short-code + toll-free** sender provisioning, with regulator-specific compliance workflows baked in (US TCPA/CTIA, India TRAI DLT, UK ICO, EU ePrivacy, Canada CASL, Australia Spam Act, Brazil ANATEL).
- **RCS Business Messaging** as a first-class second channel (rich cards, suggested replies, branded sender, read receipts) with automatic SMS fallback.
- **MMS** with SabFiles as the media source (image, audio, video, vCard, GIF — no free-text URLs).
- **AI co-pilot** for copywriting, segment targeting, send-time optimisation, reply triage, sentiment, intent, and language translation.
- **Plan-gated, credit-metered, RBAC-guarded** like every other SabNode module — never roll your own auth, billing, or permission layer.

Out of scope (deferred to later plans): voice calls, WhatsApp (already SabWa/Wachat), email (SabMail planned separately), in-app push.

---

## Tech stack

- **App layer:** Next.js 16 App Router, Server Actions, Server Components, ZoruUI components, Tailwind v4.
- **Runtime:** Self-hosted (per `project_vercel_native.md` memory — SabNode is **not** on Vercel). Node.js + PM2.
- **Worker:** `services/sabsms-worker/` — Node.js + BullMQ on Redis for send queue, DLR queue, retry queue, scheduled-campaign tick.
- **Database:** MongoDB (primary), Redis (rate-limit + queue + idempotency cache), R2 via SabFiles (media).
- **Auth:** Reuse existing dual-auth (Firebase end-user + httpOnly admin cookie).
- **RBAC:** Register new keys under `sabsms.*` in the existing permission registry.
- **Observability:** Reuse the project's existing OpenTelemetry pipeline; new spans prefixed `sabsms.*`.

---

## Phase dependency graph

```
Phase 0  (data model + RBAC + plan keys)
   │
   ├──► Phase 1 (gateway abstraction + 1 provider end-to-end)
   │       │
   │       ├──► Phase 2 (2-way inbox + DLR + webhooks)
   │       │       │
   │       │       └──► Phase 6 (conversation AI + auto-reply)
   │       │
   │       ├──► Phase 3 (templates + personalization + variables)
   │       │       │
   │       │       └──► Phase 4 (campaigns + scheduling + drip)
   │       │               │
   │       │               └──► Phase 5 (segmentation + A/B + send-time AI)
   │       │
   │       └──► Phase 7 (multi-provider routing + sender pool + cost engine)
   │
   ├──► Phase 8 (compliance: opt-in/out, DLT, 10DLC, consent ledger, audit)
   │
   ├──► Phase 9 (MMS via SabFiles + link shortener + click tracking)
   │
   ├──► Phase 10 (RCS Business Messaging adapter)
   │
   ├──► Phase 11 (analytics + deliverability dashboard + cohort reports)
   │
   ├──► Phase 12 (developer API + webhooks out + SabFlow nodes + Zapier)
   │
   └──► Phase 13 (admin tools, billing, usage exports, fraud guardrails)
```

Phases 1, 8, 3 are the critical path to MVP. Phase 0 is foundational. Phases 7, 10, 12 are parallelizable once Phase 1 lands.

---

## Phase 0 — Foundations: data model, RBAC, plan gating, credits

**PR target:** 1 PR, ~500 LoC. **Risk:** Low — purely additive.

**Goal:** Land the schemas, registry entries, and feature flags so every later phase plugs into existing SabNode plumbing.

### Task 0.1 — Mongo collections

- [ ] Create `src/lib/sabsms/db/collections.ts` exporting strongly-typed collection accessors:
  - `sabsms_numbers` — provisioned sender numbers (E.164, country, type: longcode/shortcode/tollfree/alphanumeric, provider, capabilities: `{sms, mms, rcs, voice}`, status, monthly cost, owner workspace).
  - `sabsms_provider_accounts` — per-workspace gateway credentials (encrypted with workspace KMS key), provider name, auth blob, default sender, region, status.
  - `sabsms_messages` — every send/receive: id, workspace, direction, from, to, body, media[], template_id?, campaign_id?, status (queued|sent|delivered|failed|undelivered|rejected), provider, provider_message_id, segments_count, price, cost, error_code, timestamps (queued_at, sent_at, delivered_at, failed_at), idempotency_key, conversation_id, tags[].
  - `sabsms_conversations` — thread per (workspace, contact_id, channel: sms|mms|rcs), unread count, last message preview, assigned agent, status (open|snoozed|closed), labels[].
  - `sabsms_templates` — name, body, variables[], category (transactional|otp|marketing|alert), language, status (draft|approved|rejected), DLT id (India), 10DLC campaign id (US).
  - `sabsms_campaigns` — name, template_id, audience (segment_id or contact_ids[] or csv_upload_id), schedule (immediate|scheduled|recurring|drip), throttle, sender_strategy, status, stats counters.
  - `sabsms_drips` — sequence of steps `{template_id, wait_duration, conditions[]}`, entry trigger.
  - `sabsms_suppressions` — DNC list: phone (E.164 hash), reason (stop|complaint|bounce|manual|carrier_block), source, created_at.
  - `sabsms_consent_log` — append-only consent + opt-out events (immutable, audit-safe).
  - `sabsms_webhooks_out` — workspace-defined outgoing webhook endpoints + secret + event filter.
  - `sabsms_webhook_deliveries` — outgoing webhook attempts + retries + responses.
  - `sabsms_short_links` — slug → target URL, campaign_id, contact_id, click_count.
  - `sabsms_link_clicks` — click events for attribution.
- [ ] Add Mongo indexes (compound: `{workspace, status, queued_at}`, TTL on `webhook_deliveries` after 90 d, `messages.idempotency_key` unique partial).
- [ ] Write `src/lib/sabsms/db/__tests__/schemas.test.ts` validating Zod schemas roundtrip.

### Task 0.2 — RBAC keys

- [ ] Register in the existing permission registry (find via `grep -r "permissions/registry" src/lib`):
  - `sabsms.numbers.read|provision|release`
  - `sabsms.providers.read|write|delete`
  - `sabsms.messages.send|read|export`
  - `sabsms.conversations.read|reply|assign|close`
  - `sabsms.templates.read|write|submit|delete`
  - `sabsms.campaigns.read|create|launch|pause|delete`
  - `sabsms.drips.read|write|enable|delete`
  - `sabsms.suppressions.read|write|import|export`
  - `sabsms.compliance.read|approve|reject` (admin-only)
  - `sabsms.analytics.read|export`
  - `sabsms.webhooks.read|write|delete`
  - `sabsms.api_keys.read|create|revoke`
- [ ] Seed default role bundles: `sabsms_admin`, `sabsms_agent` (inbox-only), `sabsms_marketer` (campaigns + templates, no compliance), `sabsms_developer` (API + webhooks).

### Task 0.3 — Plan gating + credits

- [ ] Add features to the plan registry: `sabsms.enabled`, `sabsms.max_numbers`, `sabsms.max_monthly_segments`, `sabsms.mms_enabled`, `sabsms.rcs_enabled`, `sabsms.api_enabled`, `sabsms.shared_pool_enabled`.
- [ ] Add credit charge types: `sabsms.segment.domestic`, `sabsms.segment.international`, `sabsms.mms.segment`, `sabsms.rcs.message`, `sabsms.number.monthly_rent`, `sabsms.lookup.hlr`.
- [ ] Wire deduction into the worker (Phase 1) — fail-closed if balance < estimated cost.

### Task 0.4 — Feature flag

- [ ] Add `SABSMS_ENABLED` to `.env.example` + dashboard nav guard so the module hides cleanly until rollout.

---

## Phase 1 — Gateway abstraction + first provider (Twilio) end-to-end

**PR target:** 2 PRs, ~1500 LoC. **Risk:** Medium — defines the abstraction every later provider implements.

**Goal:** Send and receive an SMS through Twilio with full DLR, retries, idempotency, credit deduction, and audit logging. No UI yet beyond an admin debug page.

### Task 1.1 — Provider interface

- [ ] Create `src/lib/sabsms/providers/types.ts`:
  ```ts
  export interface SmsProvider {
    readonly id: string; // 'twilio' | 'vonage' | ...
    readonly capabilities: { sms: boolean; mms: boolean; rcs: boolean; alphanumeric: boolean; shortcode: boolean };
    readonly supportedCountries: string[] | '*';
    send(req: SendRequest, creds: ProviderCreds): Promise<SendResult>;
    parseInboundWebhook(payload: unknown, headers: Record<string,string>, creds: ProviderCreds): InboundMessage | null;
    parseDlrWebhook(payload: unknown, headers: Record<string,string>, creds: ProviderCreds): DlrEvent | null;
    verifyWebhookSignature(payload: string, headers: Record<string,string>, creds: ProviderCreds): boolean;
    lookupNumber?(e164: string, creds: ProviderCreds): Promise<NumberInfo>;
    provisionNumber?(country: string, capabilities: NumberCapabilities, creds: ProviderCreds): Promise<ProvisionedNumber>;
    releaseNumber?(numberId: string, creds: ProviderCreds): Promise<void>;
    estimatePrice(req: SendRequest): Promise<PriceEstimate>;
  }
  ```
- [ ] Define `SendRequest`, `SendResult`, `InboundMessage`, `DlrEvent`, `ProviderCreds`, `NumberInfo`, `PriceEstimate` with discriminated unions where appropriate.

### Task 1.2 — Twilio adapter

- [ ] Implement `src/lib/sabsms/providers/twilio/index.ts` against the interface using `twilio` SDK (verify license — fall back to plain `fetch` if license is incompatible).
- [ ] HMAC-verify Twilio's `X-Twilio-Signature` header in `verifyWebhookSignature`.
- [ ] Map Twilio status (`queued|sending|sent|delivered|undelivered|failed`) → internal status.
- [ ] Unit tests in `src/lib/sabsms/providers/twilio/__tests__/twilio.test.ts` using recorded fixtures (do NOT hit live API in tests).

### Task 1.3 — Send pipeline

- [ ] Create `src/lib/sabsms/engine/send.ts` `enqueueMessage(input)`:
  1. Validate input (Zod).
  2. Normalize destination to E.164 (`libphonenumber-js`).
  3. Check suppression list → reject with `suppressed`.
  4. Resolve sender (explicit number > workspace default > pool selection — pool logic deferred to Phase 7).
  5. Estimate segments (GSM-7 vs UCS-2, 160/153 vs 70/67 chars) + cost.
  6. Reserve credits (decrement with rollback token).
  7. Write `sabsms_messages` doc with `status=queued`, generate idempotency key.
  8. Push job to BullMQ `sabsms:send` queue with priority (transactional > promotional).
  9. Return `{ id, status, segments, estimatedCost }`.
- [ ] Worker `services/sabsms-worker/src/workers/send.ts` consumes the queue, calls provider, updates message status, releases or finalizes credits, emits internal event `sabsms.message.sent`.

### Task 1.4 — Inbound + DLR webhook router

- [ ] Create `src/app/api/sabsms/webhook/[provider]/[direction]/route.ts` (`direction` ∈ `inbound|dlr`).
- [ ] Look up `sabsms_provider_accounts` by the inbound number, verify signature, parse via `provider.parseInboundWebhook` / `parseDlrWebhook`.
- [ ] For inbound: upsert `sabsms_conversations`, write `sabsms_messages` with `direction=inbound`, fire `sabsms.message.received`, run keyword interceptor (STOP/HELP — Phase 8).
- [ ] For DLR: update message status, timestamps, error codes; if `failed` + permanent error → add to suppression.
- [ ] All webhooks idempotent via `provider_message_id` unique index.

### Task 1.5 — Admin debug page

- [ ] `src/app/admin/sabsms/debug/page.tsx` — minimal ZoruUI form to send a test SMS and stream the message status. Admin-only (RBAC guard).

### Acceptance

- [ ] Send a real SMS through a Twilio sandbox account, observe DLR moving through `queued → sent → delivered`, credits debited, audit row written.
- [ ] Reply from the destination handset, see it land in the message log.

---

## Phase 2 — 2-way Inbox (conversations, assignment, notes, SLA)

**PR target:** 2 PRs, ~1800 LoC. **Risk:** Medium — UX heavy.

**Goal:** Helpdesk-grade unified inbox so agents can have real conversations.

- [ ] `src/app/sabsms/inbox/page.tsx` — 3-pane ZoruUI layout: filters (all/mine/unassigned/closed/snoozed) | conversation list | thread view.
- [ ] Real-time updates via existing SSE channel (find with `grep -r "EventSource" src/app`); fall back to polling.
- [ ] Thread view: message bubbles, delivery ticks, media previews (uses `SabFilePicker` for outbound media — never free-text URL per `feedback_sabfiles_no_external_urls.md`), internal notes (separate `notes` array), canned responses, emoji reactions on inbound.
- [ ] Assignment: assign to agent / team / auto-round-robin; re-assignment audit trail.
- [ ] Snooze (wake on reply or after duration), close, reopen, merge two conversations (same contact).
- [ ] SLA timers: first-response, resolution; breaches publish `sabsms.sla.breached` event.
- [ ] Quick actions: add to segment, tag contact, copy CRM link, block sender (adds to suppression).
- [ ] Search: across body, contact name, tags, conversation id, date range.
- [ ] Keyboard shortcuts (j/k navigate, e archive, r reply, n note) — register through existing shortcut bus.

---

## Phase 3 — Templates + variables + personalization + i18n

**PR target:** 1 PR, ~900 LoC. **Risk:** Low.

- [ ] Template editor `src/app/sabsms/templates/[id]/page.tsx`: body textarea with `{{contact.first_name}}` autocomplete, segment + encoding preview (live char counter showing GSM-7 vs UCS-2 split, segment count, estimated cost per send).
- [ ] Variable resolver `src/lib/sabsms/templates/render.ts` — same engine as SabFlow expression resolver if possible; supports filters (`{{contact.first_name | titlecase | default("there")}}`), date formatting (Luxon), conditionals (`{% if order.total > 100 %}...{% endif %}`).
- [ ] Localization: a single template can hold `body` per locale; resolver picks based on `contact.locale` with fallback chain.
- [ ] Compliance categories: `transactional|otp|marketing|alert` — used by Phase 8 to enforce TCPA/DLT rules at send time.
- [ ] DLT registration fields (India): principal entity id, template id, header id, content category.
- [ ] 10DLC fields (US): brand id, campaign id, use case, sample messages.
- [ ] Template approval workflow: draft → submitted → approved/rejected with reviewer notes, only `approved` is sendable for marketing category.

---

## Phase 4 — Campaigns + scheduling + drip sequences

**PR target:** 2 PRs, ~1600 LoC. **Risk:** Medium — touches scheduler + worker.

- [ ] Campaign builder wizard: 1) pick template, 2) pick audience (segment / CSV upload via SabFiles / contact picker), 3) sender strategy (single number / pool / sticky-per-recipient), 4) throttle (msgs/sec or per-minute), 5) schedule (now / one-shot future / recurring cron / drip), 6) per-recipient quiet hours from contact timezone, 7) review with estimated total cost + delivery window.
- [ ] Scheduler: cron-equivalent worker `services/sabsms-worker/src/schedulers/campaign-tick.ts` runs every minute, finds campaigns due, enqueues per-recipient jobs into `sabsms:send` queue respecting throttle (token bucket per workspace + per sender).
- [ ] Drip sequences: linear or branching (`if replied within 24h → step B else step C`); state per contact in `sabsms_drip_state`; pausable, exit conditions (replied / clicked / converted / unsubscribed).
- [ ] Pause / resume / cancel campaign with in-flight job draining.
- [ ] Per-campaign quiet hours + per-country quiet hours (e.g. no marketing in India before 10:00 / after 21:00 IST per TRAI).
- [ ] Test send to a contact / arbitrary number before launch.
- [ ] Duplicate / clone campaign.

---

## Phase 5 — Segmentation + A/B testing + AI send-time optimization

**PR target:** 1 PR, ~1100 LoC. **Risk:** Medium — model serving.

- [ ] Reuse SabCRM segment builder; add SMS-specific predicates: `last_sms_clicked_at`, `total_replies`, `unsubscribed`, `engagement_score`.
- [ ] A/B split campaigns: N variants of template, split percent, optional auto-promote winner after a sample window using a metric (CTR, reply rate, conversion).
- [ ] Send-time optimization: per-contact learned best hour (rolling 90-day click + reply history; cold-start = workspace median). Toggle per campaign.
- [ ] Frequency capping: max N marketing messages per contact per (day | week | month).
- [ ] Smart suppression: contacts with 0 engagement over 60 days excluded by default (overridable).

---

## Phase 6 — AI co-pilot (copywriting, reply, sentiment, intent)

**PR target:** 1 PR, ~900 LoC. **Risk:** Low (additive, behind a plan flag).

- [ ] Compose assist: "Rewrite shorter" / "Make friendlier" / "Add CTA" / "Translate to Hindi" buttons in template editor — call the project's existing LLM gateway (find via `grep -r "anthropic\|openai" src/lib/ai`); fall back gracefully if quota exhausted.
- [ ] Inbox reply suggestions: top-3 suggested replies generated from conversation context with one-click accept/edit.
- [ ] Inbound classification: sentiment (`positive|neutral|negative`), intent (`question|complaint|cancel|purchase_intent|spam|other`), urgency (`low|medium|high`); written to message doc, used by inbox filters and auto-assignment rules.
- [ ] Auto-reply rules: keyword or intent triggers → template send (rate-limited per contact).
- [ ] Spam/abuse detection on outbound: warn if message resembles known spam patterns.
- [ ] PII redaction in AI prompts: phone numbers, emails, credit-card-like patterns scrubbed before sending to the model.

---

## Phase 7 — Multi-provider routing + sender pool + cost engine

**PR target:** 2 PRs, ~1400 LoC. **Risk:** High — affects every send.

- [ ] Add adapters for Vonage, MessageBird, Plivo, MSG91 (India), AWS SNS, Telnyx — at least 2 more beyond Twilio. Each conforms to Phase 1 interface.
- [ ] Routing engine `src/lib/sabsms/engine/router.ts`:
  - Inputs: destination country, message category, sender preference, workspace provider order, real-time provider health, cost.
  - Outputs: ordered provider attempts with fail-over (e.g. Twilio → MSG91 for India promotional).
- [ ] Sender pool: rotate among numbers to spread load + protect deliverability; "sticky-per-recipient" keeps the same sender for the same contact to preserve thread continuity.
- [ ] Real-time throttling: token bucket per provider (respect provider TPS limits) + per workspace + per sender number; backpressure into queue.
- [ ] Health monitor: rolling window of last 1000 sends per provider — auto-degrade if DLR success rate drops below threshold; alert via admin email.
- [ ] Cost engine: pull current per-destination rates (DB-backed, refreshed nightly), compute estimated + actual cost; apply workspace markup; record `cost_to_us` vs `price_to_customer` for margin reporting.

---

## Phase 8 — Compliance: opt-in/out, consent ledger, DLT/10DLC, audit

**PR target:** 2 PRs, ~1500 LoC. **Risk:** High — regulatory exposure.

- [ ] Keyword interceptor on inbound: `STOP|STOPALL|UNSUBSCRIBE|CANCEL|END|QUIT` (multi-language list configurable) → add to suppression, send confirmation, fire `sabsms.contact.unsubscribed`. `HELP|INFO` → send help template. `START|UNSTOP` → remove from suppression (only if previously opted-out via STOP, not via complaint).
- [ ] Consent ledger `sabsms_consent_log` — append-only immutable record: capture method (web form / API / import / verbal), source URL, timestamp, IP, user agent, double-opt-in confirmation, opt-out events. Required for TCPA/GDPR/CASL audits.
- [ ] Suppression enforcement at every send (already wired in Phase 1) — re-confirm here with full unit tests.
- [ ] Country + category rule engine:
  - US: 10DLC campaign required for A2P → reject sends without it. Quiet hours per recipient TZ. TCPA categories.
  - India: DLT principal entity + content template id required → reject sends without it; enforce TRAI quiet hours.
  - EU: marketing requires consent record; one-click unsubscribe URL appended.
  - Canada (CASL): consent + sender ID; unsubscribe handling within 10 business days.
  - Australia: sender id + opt-out.
- [ ] Compliance dashboard `src/app/sabsms/compliance/page.tsx`: provisioning status (10DLC brand/campaign, DLT entity/headers), pending approvals, recent unsubscribes, audit log export (CSV + signed).
- [ ] Admin compliance review queue: templates flagged for human review before approval.
- [ ] Footer policy: auto-append "Reply STOP to unsubscribe" to marketing messages if missing (configurable per workspace).
- [ ] Double opt-in flow: API to send confirmation request, contact must reply YES (or click magic link) within window to be marked `consent=double_opt_in`.

---

## Phase 9 — MMS, link shortener, click + conversion tracking

**PR target:** 1 PR, ~900 LoC. **Risk:** Low.

- [ ] MMS send: media sourced from `<SabFilePicker>` only (per project CLAUDE.md rule). Validate MIME + size against provider limits. Auto-resize images via existing R2 transformer.
- [ ] Inbound MMS: download media to SabFiles bucket, attach to message doc, render preview in inbox.
- [ ] Link shortener `src/app/r/[slug]/route.ts` — 6-char slug, 302 to target, log click in `sabsms_link_clicks` with campaign/contact attribution.
- [ ] Auto-wrap URLs in outbound marketing messages when shortener enabled.
- [ ] UTM auto-append: `?utm_source=sabsms&utm_campaign=<id>&utm_content=<msg_id>`.
- [ ] Conversion tracking pixel + JS snippet for downstream sites; conversion API for server-side reporting.
- [ ] Per-link CTR + per-campaign CTR in analytics (Phase 11).

---

## Phase 10 — RCS Business Messaging adapter

**PR target:** 1 PR, ~1100 LoC. **Risk:** Medium — RCS provisioning is slow.

- [ ] RCS adapter implements the Phase 1 provider interface plus RCS extensions: rich cards (single + carousel), suggested replies, suggested actions (call / open URL / location share / calendar add), typing indicator, read receipts, branded sender.
- [ ] Provider: Sinch RCS or Google RCS Business Messaging via Google Cloud — pick one and abstract.
- [ ] Capability detection: lookup destination's RCS support per-send (cache 24h); if RCS-capable → send rich; else → auto-fallback to SMS/MMS with degraded content (text-only).
- [ ] Template editor RCS mode: card builder with title, description, image (SabFiles), suggested replies (max 11), suggested actions.
- [ ] Brand verification UX: walk workspace through Google RBM agent verification (logo upload, color, description, agent type).
- [ ] Inbox supports RCS rich messages (cards rendered inline, action buttons clickable to record analytics).

---

## Phase 11 — Analytics, deliverability, cohort reports

**PR target:** 1 PR, ~1300 LoC. **Risk:** Low.

- [ ] Dashboard `src/app/sabsms/analytics/page.tsx`:
  - KPIs: messages sent, delivered, failed, replied, CTR, opt-outs, cost, ROI (if conversions tracked).
  - Time series with date-range picker, group-by (provider, country, sender, campaign, template).
  - Funnel: sent → delivered → clicked → converted.
  - Cohort retention: re-engagement by week since first contact.
  - Provider scorecards: DLR rate, average delivery latency, failure breakdown.
  - Number health: per-number sent/delivered/complaint rate, recommend rotation when health degrades.
- [ ] Reports export: CSV + Excel + scheduled email export (uses SabMail when available, else fallback to direct send).
- [ ] Real-time tile: throughput in last 60 s, queue depth.
- [ ] Cost analytics: spend per workspace / per campaign / per provider; margin (price − cost); credit burn rate forecasting.
- [ ] Webhook deliverability for outbound webhooks (Phase 12): success rate, p95 latency.

---

## Phase 12 — Public developer API, outbound webhooks, SabFlow nodes

**PR target:** 2 PRs, ~1500 LoC. **Risk:** Medium — public API contract.

- [ ] REST API `src/app/api/v1/sabsms/...` versioned, OpenAPI spec auto-generated:
  - `POST /messages` (send single or batch), `GET /messages/:id`, `GET /messages?filters`.
  - `POST /campaigns`, `GET /campaigns/:id`, `POST /campaigns/:id/launch|pause|cancel`.
  - `GET/POST /templates`, submit-for-approval.
  - `GET/POST /contacts` (proxies to SabCRM), `POST /contacts/:id/opt-out`.
  - `GET /numbers`, `POST /numbers/provision`, `DELETE /numbers/:id`.
  - `GET /conversations`, `POST /conversations/:id/messages` (agent reply via API).
  - `GET /suppressions`, `POST /suppressions`, `DELETE /suppressions/:phone`.
  - `GET /analytics/...`.
- [ ] API key management UI: scoped keys (read-only / send-only / full), IP allow-list, revocation, last-used.
- [ ] Idempotency keys honored on `POST /messages` for 24 h.
- [ ] Rate limits per key + per workspace, 429 with `Retry-After`.
- [ ] Outbound webhooks: workspace registers URL + secret + event filter (`message.sent|delivered|failed|received|clicked`, `conversation.opened|closed`, `contact.unsubscribed`, `campaign.completed`). HMAC-SHA256 signature header. Exponential retry with DLQ after 24 h. Test fire from UI.
- [ ] SabFlow blocks under `src/lib/sabflow/forge/blocks/sabsms/`:
  - Trigger: "On SMS received", "On SMS delivered", "On unsubscribe".
  - Action: "Send SMS", "Send MMS", "Add to drip", "Add to suppression", "Lookup number".
  - Reuse `resourceLocator` (per `project_sabflow_n8n_parity.md`) for number / template pickers.
- [ ] Zapier + Make + n8n public app — defer to a separate distribution plan but document the API surface.

---

## Phase 13 — Admin tools, billing, fraud guardrails

**PR target:** 1 PR, ~900 LoC. **Risk:** Medium — touches billing.

- [ ] Admin overview `src/app/admin/sabsms/page.tsx`: cross-workspace KPIs, top spenders, top failures, provider health.
- [ ] Manual credit grant / refund (audit logged).
- [ ] Per-workspace spend caps + alerts at 50/80/100 % (emails workspace admin + halts sending at 100 %).
- [ ] Fraud guardrails:
  - Velocity limits per new workspace (first 7 days).
  - Country whitelist by default until verified.
  - Sudden spike detection (10× rolling baseline) → throttle + alert.
  - Pumping fraud detection (international premium-rate destinations) — pre-block list maintained centrally.
  - Disposable / VoIP number flagging on inbound contacts (lookup via HLR).
- [ ] Audit log viewer (admin) — searchable by workspace / user / action.
- [ ] Data export request endpoint for GDPR/CCPA Subject Access Requests; deletion request endpoint with cryptographic erasure of consent records (retain hashed phone for legal opt-out persistence).
- [ ] On-call runbook in `docs/sabsms/runbook.md`: webhook outage, provider down, queue backlog, mass unsubscribe event.

---

## Cross-cutting concerns (apply to every phase)

### Security

- [ ] All provider credentials encrypted at rest (existing workspace KMS pattern).
- [ ] Webhook endpoints public but signature-verified; replay protection via 5-min freshness window + nonce cache.
- [ ] CSRF protection on every Server Action.
- [ ] Rate-limit `/api/sabsms/webhook/*` per source IP to absorb provider retry storms.
- [ ] Inbound media (MMS) scanned for malware via existing SabFiles AV pipeline before storing.

### Performance

- [ ] Send throughput target: 1000 messages/sec/workspace (provider permitting); queue must keep up.
- [ ] Inbox real-time latency: <500 ms from DLR to UI update.
- [ ] Analytics queries: precomputed roll-ups (hourly + daily) in `sabsms_stats_rollup`; raw query for <24 h only.

### Reliability

- [ ] At-least-once send semantics with idempotency key; never silently drop a queued message.
- [ ] DLR ingestion idempotent on `provider_message_id`.
- [ ] Worker graceful shutdown: drain in-flight + checkpoint queue position.
- [ ] Disaster: provider X down → router fails over; if all providers down → queue grows, ops alerted, no data loss.

### Observability

- [ ] Trace every send end-to-end (enqueue → worker pick → provider call → DLR) with the same trace id.
- [ ] Metrics: queue depth, send latency p50/p95/p99, DLR latency, provider error rate, credit-deduction failures, webhook DLQ depth.
- [ ] Structured logs (workspace_id, message_id, provider, status) — no PII (phone hashed in logs).

### Internationalization

- [ ] Unicode-safe everywhere (UCS-2 segmentation, RTL rendering in inbox).
- [ ] All user-facing strings via existing i18n loader.
- [ ] Phone parsing/validation: `libphonenumber-js` with all metadata, not min.

### Accessibility

- [ ] Inbox keyboard-navigable, screen-reader labels on every action, focus management on modals (ZoruUI provides primitives — use them).
- [ ] Color is not the sole status indicator (use icon + text).

### Testing

- [ ] Unit tests per provider adapter against recorded fixtures.
- [ ] Integration tests for send pipeline using an in-memory fake provider.
- [ ] E2E test for: send → DLR → status update → analytics counter.
- [ ] Load test (k6 or similar) before Phase 7 ships at 500 msgs/sec.
- [ ] Use `superpowers:test-driven-development` skill for every phase.

### Documentation

- [ ] User-facing docs site section (existing docs tree): getting started, provider setup guides (Twilio, Vonage, MSG91, ...), compliance per country, template syntax, API reference (auto-generated from OpenAPI), webhook reference.
- [ ] Internal `docs/sabsms/architecture.md` with sequence diagrams (send, inbound, DLR, campaign tick).

---

## Open questions (resolve before Phase 1 starts)

1. **Managed shared pool vs BYO-only at launch?** Managed pool needs upfront provider contracts + KYC + regulatory exposure; BYO ships faster.
2. **Pricing model: per-segment credits (matches SabWa) vs flat monthly + overage?** Match existing module convention.
3. **RCS at launch (Phase 10) or v2?** RCS provisioning is 4–8 weeks per brand; if not v1, mark Phase 10 as v2.
4. **Voice fallback (call when SMS fails for OTP) — separate plan?** Recommend separate SabVoice plan; out of scope here.
5. **Email-to-SMS / SMS-to-email bridge — needed?** Common in support workflows; add as a small Phase 14 if user demand exists.

---

## Memory updates after Phase 0 lands

Save a `project_sabsms_overview.md` memory with: module purpose, sister-module relationships, key collections, plan/credit keys, default RBAC bundles. Index it in `MEMORY.md`.
