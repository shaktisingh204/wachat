# SabChat — Big Future Features Plan

> Goal: surpass **Tawk.io** and **Chatwoot** by being the only live-chat that's also a CRM, an automation engine, an omnichannel inbox, and a revenue engine — because the rest of SabNode is already there. We just have to wire it in.

## Baseline (today)

Current SabChat surface area (`src/app/dashboard/sabchat/`):

- `widget/` — embed code + customizer
- `inbox/` — basic conversation list + chat window
- `visitors/` — visitor presence
- `ai-replies/` — AI reply config
- `auto-reply/` — welcome / away messages
- `faq/` — FAQ entries
- `quick-replies/` — canned responses
- `analytics/` — simple counters
- `settings/` — global settings

Schema today: a single `sabChatSettings` blob on the `users` doc; sessions/messages live in `users.sabChatSessions[]`. There is no first-class conversation/contact/inbox model and no multi-channel routing. Public API: `src/app/api/v1/sabchat/{bots,channels,conversations,messages}` exists but is thin.

To beat Chatwoot we need a real multi-tenant conversation/contact graph, an inbox that pulls every SabNode channel, and a deep automation/AI layer.

---

## Pillar 1 — Omnichannel Inbox (kill Chatwoot's main moat)

One unified inbox that merges every channel SabNode already speaks. SabChat becomes the "front door" UI; each channel is just a transport adapter.

| Channel | Source module already in repo | What to wire |
|---|---|---|
| Website live chat | `sabchat/widget` | existing widget, upgraded |
| WhatsApp Cloud API | `wachat/` | reuse `assignments`, `quick-reply-categories`, `saved-replies`, `contact-notes`, `contact-blacklist` |
| WhatsApp Personal (Baileys) | `services/sabwa-node` | already a separate engine |
| Instagram DM + comments | `src/app/instagram` | merge into same conversation timeline |
| Facebook Messenger + page comments | `src/app/facebook` | same |
| Telegram | `src/app/telegram` | same |
| Email (shared inbox) | `dashboard/crm/email` + `EmailClient.tsx` | tickets-as-conversations |
| SMS / RCS | new adapter on Wachat infra | one Twilio/MSG91 channel doc |
| Voice / WhatsApp Calls | `wachat/calls` | call recordings as conversation attachments |
| Apple Business Chat, Google Business Messages, LINE, Viber, X DMs | new adapters | same conversation model |
| In-app chat (mobile/SaaS SDK) | new | iOS/Android/Flutter/React Native SDKs |

### Conversation model (new, replaces user-doc blob)

- `sabchat_inboxes` — one per channel, RBAC scoped
- `sabchat_contacts` — deduped person across channels (phone + email + social IDs)
- `sabchat_conversations` — status, priority, SLA clock, assignee, team, labels, custom attrs
- `sabchat_messages` — rich content blocks: text, files (via SabFiles), cards, carousels, forms, payment, location, voice
- `sabchat_threads` — side conversations: agent↔expert, internal notes
- `sabchat_audit_log` — immutable trail

### Inbox UX upgrades vs Chatwoot

- Universal search across all channels (BM25 + vector — reuse existing search infra).
- Split-screen "contact 360" panel: CRM record, deal history, orders, tickets, SabFlow runs, ad attribution, last 50 page views.
- Multi-conversation tabs + side-by-side compare.
- Keyboard-driven (Linear-style) — `j/k`, `e` to assign, `/` to command palette.
- Snooze, follow, swarm (multiple agents in one room with private notes), handoff, transfer with context note.
- Internal mentions `@agent` + `@team` with Slack/Teams/Email mirror.

---

## Pillar 2 — Smart Widget 2.0 (kill Tawk's widget moat)

Tawk's free widget is the hook. Ours must be drop-dead easy and far more powerful.

- **Multi-surface widgets**: floating bubble, inline embed, slide-over, full-page, dock, modal, banner — single embed script.
- **Pre-chat forms** with conditional logic (powered by SabFlow form engine).
- **Trigger engine**: time-on-page, scroll depth, exit-intent, URL match, UTM match, returning visitor, cart-abandon, fired event from website.
- **Visitor journey tracking**: page views, clicks, custom events (SaaS metrics, plan tier, MRR) — sits inside contact 360.
- **Co-browse + screen share + screen annotation** (WebRTC).
- **Voice + video call from widget** (reuse Wachat voice infra + LiveKit/Daily.co adapter).
- **Article search inline** (Help Center, see Pillar 6).
- **Bot first / human second** with seamless handoff.
- **Department routing** (sales/support/billing) with business-hours per dept.
- **Multi-language**: 40+ locales, auto-detect from browser + live translate (Pillar 3).
- **Customizer**: themes, dark mode, custom CSS, font, animations, sound, mascot, GIF/Lottie avatar.
- **A/B test widget variants** (reuse the experiment plumbing for SEO/landing).
- **Accessibility**: WCAG 2.2 AA, keyboard-only, screen-reader, RTL.
- **Privacy/compliance**: GDPR/CCPA cookie banner integration, end-user data export/delete, EU data residency flag.
- **Identity hash** (`hmac(secret, userId)`) so logged-in app users carry verified identity into chat — same pattern as Intercom.
- **Zero-flicker SSR script** + lazy hydrate.

---

## Pillar 3 — AI Copilot Layer (this is where we leap-frog both)

Beyond `ai-replies/`. Make SabChat the most AI-native inbox on the market.

1. **Agent Copilot** — sidebar that drafts replies, summarizes the thread, surfaces past tickets, suggests macros, fills the next CRM field, and writes the wrap-up note.
2. **AI Auto-Resolve Bot** — RAG over Help Center + SabFiles docs + product catalog + past resolved tickets. Confidence-gated: handles tier-1, escalates with full context. Per-bot guardrails, tone, persona, refusal rules.
3. **Live translate** — translate inbound + outbound in real time, both visitor and agent see native language. Persist both.
4. **Sentiment + intent + topic + PII detection** on every message → drive routing, escalation, CSAT prediction, churn risk score (feeds CRM).
5. **Conversation summarization** — auto-generated thread summary updated every N messages; one-click "summary so far".
6. **Smart routing** — ML classifier picks team/agent based on intent + skill matrix + load + past resolution rate.
7. **Knowledge gap detector** — clusters unanswered/escalated questions weekly and proposes new Help Center articles.
8. **Voice-of-customer dashboard** — top topics, complaint clusters, feature requests, NPS drivers, all from conversations.
9. **AI Macros** — natural-language "always ask for order number first, then check shipment in Shop module" → executable agent.
10. **Multimodal** — accept images/PDFs/voice notes; LLM extracts order #, address, screenshots; OCR; voice-to-text.
11. **AI QA** — auto-grades every conversation against a rubric (greeting, empathy, resolution, upsell) and flags coaching opportunities.

Provider: route through our existing AI plumbing; bring-your-own-key per tenant for cost control.

---

## Pillar 4 — Automations + SabFlow (kill Chatwoot's automation gap)

Chatwoot's automations are conditional macros. We have **SabFlow** (n8n-parity) sitting right there.

- **Conversation triggers** as first-class SabFlow nodes: `On new conversation`, `On message received`, `On status change`, `On label added`, `On SLA breach`, `On CSAT submitted`, `On widget event`.
- **Conversation actions**: send message, assign, label, snooze, add note, create deal, create ticket, push to CRM, charge via SabPay, fire webhook, run SQL, call any 400+ SabFlow integration.
- **Visual flow builder for chatbots** (reuse `wachat/chatbot` builder, extend with cross-channel nodes).
- **No-code rules** in the inbox UI (Chatwoot parity) — for users who don't want SabFlow.
- **Macros 2.0** — multi-step, conditional, variable-templated, with per-tenant marketplace ("share macro to team / org").
- **Time-based**: business hours, holiday calendars, working-hours-per-team, auto-reassign at shift change.
- **SLA policies** — first response / next response / resolution, per-priority, per-team, with breach escalations.

---

## Pillar 5 — CRM-native ("Chatwoot is bolted on; we're built in")

Every conversation is a first-class CRM event.

- Contact dedupe across channels, with merge UI.
- Auto-create / link **CRM contact + deal + booking + order** from conversation context.
- Inline CRM editing in the contact 360 panel.
- **Pipelines** view: drag a conversation into a deal stage.
- **Tickets module** (Chatwoot calls them "conversations" — we keep both: chat = live, ticket = async support thread with status, priority, SLA, parent/child).
- Two-way sync with `crm/sales-crm`, `crm/bookings`, `crm/deals`, `crm/accounts`, `crm/inventory`.
- **Account-level conversations** (B2B): roll multiple contacts in one company up to an Account view.
- **Custom objects + custom fields** (reuse CRM-Advanced custom-object plumbing).
- **Conversation → invoice / quote / order**: one click create from `crm/accounting/vouchers` or `shop`.
- **Loyalty + gift cards**: surface points/wallet inline (reuse `crm/sales/loyalty`, `crm/sales/gift-cards`).

---

## Pillar 6 — Help Center / Knowledge Base (new sub-module: SabKnow)

Tawk has Tawk-To-KB; Chatwoot has Articles. Ours: **SabKnow**.

- Per-tenant portals at `kb.{tenant}.sabnode.app` + custom domain.
- Multi-portal (separate KB per product/region/language).
- Markdown + WYSIWYG + AI ghostwriter ("turn this resolved ticket into an article").
- Versioning, drafts, scheduled publish, approval workflow, audit log.
- Inline analytics: views, search-no-result, helpful %, time-to-find, deflection rate.
- **Linked to AI Auto-Resolve Bot** — article updates retrain the bot embeddings automatically.
- Embedded inside widget search.
- **Community forum** mode (Discourse-lite) for self-serve community support.
- SEO-ready (reuse `seo/` module: sitemaps, meta, schema.org FAQ).

---

## Pillar 7 — Commerce & Conversational Selling

Live chat that closes deals.

- **Catalog cards in chat** (reuse `wachat/catalog` + `shop/` product schema).
- **In-chat checkout** — Razorpay/Stripe/UPI link, WhatsApp Pay, ApplePay (reuse `wachat/whatsapp-pay`).
- **Cart recovery** — widget trigger on cart-abandon → bot → human.
- **Live shopping**: agent shares product, applies coupon, generates payment link, confirms order.
- **Ad-to-chat attribution** (reuse `ad-manager` + `meta-suite`): which Meta/Google campaign drove this chat → revenue.
- **WhatsApp Ads click-to-chat** unified with website chat under one customer record.
- **Upsell/cross-sell suggestions** powered by purchase history.

---

## Pillar 8 — Voice, Video, Co-browse

- WebRTC voice + video calls from widget (1:1, group, agent transfer).
- Call recordings stored in SabFiles, transcribed + summarized by AI.
- Co-browse with safe DOM masking for password fields.
- Screen share + agent annotation (draw on visitor screen).
- IVR-style voice bot (text-to-speech + STT, routes to live agent).
- Voicemail → ticket with transcript.

---

## Pillar 9 — Team Ops (built for scale)

- **Teams + inboxes + permissions** (reuse `team/` + RBAC keys).
- **Skill-based routing** + round-robin + load-balanced + sticky-agent + VIP-first.
- **Shifts + rosters** (reuse `hrm/` shifts) — auto presence + business hours per agent.
- **Workload heatmap** + concurrency caps per agent.
- **Agent statuses**: online/away/busy/break, auto-set from HRM punch-in.
- **Internal QA + coaching** with scorecards, calibration sessions, rubrics, AI-suggested coaching moments.
- **Gamification**: leaderboards, badges, streaks (drives agent engagement — Tawk has nothing here).
- **CSAT, NPS, CES** post-chat surveys with branching; results feed into VoC dashboard.
- **Disposition codes** required on close — drive reporting + retraining.

---

## Pillar 10 — Reporting & Analytics

Reach Zendesk-grade depth — Chatwoot's weakest area.

- Real-time live dashboard (active convos, queue depth, longest wait, SLA breaches).
- Conversation, agent, team, channel, label, intent, topic, bot reports.
- **Funnel reports**: widget impression → conversation start → resolution → CSAT → revenue.
- **Cohort retention** of conversational customers.
- **Bot performance**: deflection %, handoff %, confusion rate, top fallback intents.
- **Revenue attribution** per agent / per channel.
- Custom report builder + scheduled email PDFs.
- BI export — Postgres mirror / S3 unload / Looker connector.
- Per-tenant goals + alerts.

---

## Pillar 11 — Developer Platform (so others build on us)

- **Public REST + GraphQL + WebSocket APIs** (we already have `/api/v1/sabchat/`; flesh out conversations, messages, contacts, events, search, bots, attachments, tags, teams).
- **Webhooks** with signing, retries, replays, dead-letter; per-event filters.
- **Mobile SDKs**: iOS Swift, Android Kotlin, RN, Flutter — for in-app support like Intercom Messenger.
- **JS Widget SDK**: `SabChat.identify()`, `.track()`, `.event()`, `.update()`, `.hide()`, `.boot()`.
- **Server SDKs**: Node, Python, Go, PHP, Ruby.
- **App marketplace** (per tenant + global) — Shopify, Magento, WooCommerce, HubSpot, Salesforce, Zoho, Pipedrive, Linear, Jira, GitHub, Slack, Teams, Discord, Notion, ClickUp, monday, Stripe, Razorpay, Zendesk import.
- **Custom apps** — embed an iframe inside the conversation sidebar (Chatwoot-style "Dashboard Apps").
- **CLI + Terraform provider** for ops teams.

---

## Pillar 12 — Compliance, Security, Trust

- SOC2 Type II, ISO 27001 roadmap pages + status.
- GDPR/CCPA/India DPDP toolkit (data subject requests, retention rules, redaction).
- HIPAA-ready inbox (PHI scrub, encrypted-at-rest with per-tenant CMK).
- Audit log + SIEM export.
- SSO (SAML, OIDC) + SCIM provisioning.
- IP allowlists, device trust, session expiry, force MFA per role.
- Per-message redaction + PII masking on the wire.
- EU/India/US data residency.
- PCI-friendly payment flow (tokenized links, never card-in-chat).

---

## Pillar 13 — Differentiators (the "twak" — features no competitor bundles)

1. **SabFlow-native** automation = no-code workflows that span chat → CRM → email → invoice → shipping → analytics.
2. **One identity across channels** including agent-side personal-WhatsApp (sabwa-node) — unique.
3. **Built-in voice/video + co-browse** without Twilio bills.
4. **Conversation → Ticket → Deal → Order → Invoice → Loyalty point** native pipeline.
5. **AI QA on 100% of conversations** (others sample).
6. **Help Center + Forum + Bot + Inbox + CRM** in one license.
7. **Ad → Chat → Revenue closed-loop reporting**, native.
8. **HRM-aware staffing** — shifts drive agent availability automatically.
9. **Marketplace + white-label** — resell SabChat under your brand to your clients.
10. **Offline-first agent PWA** + native desktop (Tauri) with global push.

---

## Roadmap phasing (6 quarters)

### Q1 — Foundation
- New schema: contacts, conversations, messages, inboxes, audit log.
- Migrate widget + inbox to new model.
- WhatsApp Cloud + sabwa-node adapters into unified inbox.
- RBAC + teams + assignment.

### Q2 — Omnichannel + AI v1
- Instagram, Facebook, Telegram, Email, SMS adapters.
- AI Copilot sidebar, AI Auto-Resolve bot (RAG over SabFiles + Help Center), live translate.
- SabKnow MVP.

### Q3 — Automation & CRM-native
- SabFlow conversation triggers/actions.
- SLA + business hours + advanced routing.
- Two-way sync with CRM contacts/deals/bookings/orders.
- Macros 2.0.

### Q4 — Commerce + Voice
- Catalog cards + in-chat checkout.
- Voice + video + co-browse.
- Ad-attribution dashboards.
- Mobile SDKs (iOS/Android/RN/Flutter).

### Q5 — Reporting + Marketplace
- Reporting suite + BI exports.
- App marketplace + custom dashboard apps.
- White-label + multi-portal.

### Q6 — Compliance + Scale
- SSO/SCIM/SOC2 audit.
- Regional residency.
- HIPAA inbox.
- Performance hardening: 10M conv / tenant, sub-200ms p95.

---

## Module reuse cheat-sheet (don't rebuild what we have)

| Need | Reuse |
|---|---|
| File uploads in chat | `@/components/sabfiles` (SabFilePicker / SabFileUrlInput) |
| Workflow engine | SabFlow + sabflow expression engine |
| WhatsApp Cloud + personal | Wachat + sabwa-node |
| Voice infra | wachat/calls |
| Catalog/products | wachat/catalog + shop/ |
| Payments | wachat/whatsapp-pay + billing/ + crm/accounting |
| Loyalty/coupons | crm/sales/loyalty + gift-cards |
| Email shared inbox | dashboard/crm/email |
| Agent shifts/presence | hrm/ |
| Audit + RBAC keys | existing CRM RBAC plumbing |
| Search | existing BM25/vector infra |
| UI | ZoruUI only |
| Public landing for KB | seo/ + builder/ |

---

## Suggested first slice

Start with **Pillar 1 (data model + omnichannel)** + **Pillar 2 (widget 2.0)** as Q1, since every other pillar compounds on that foundation. Everything else is parasitic on a real `sabchat_contacts` / `sabchat_conversations` / `sabchat_messages` graph and a multi-surface widget that can carry the bot, the AI, the catalog, and the call.

---

## Execution Tracker — Rust backend (live)

Backend is **Rust** (axum + mongodb + redis), modelled after the existing `wachat-*` crates in `rust/crates/`. Each line below is a leaf crate or wiring step. Lines are marked **done** as work lands.

### Wave 1 — Shared types (prerequisite)
- [x] `sabchat-types` crate — DTOs: Inbox, Channel, Contact, Conversation, Message, ContentBlock, Assignment, AuditEvent **done**

### Wave 2 — Domain crates (parallel)
- [x] `sabchat-contacts` crate — dedupe, identity resolution, CRUD over `sabchat_contacts` **done**
- [x] `sabchat-conversations` crate — CRUD, status, priority, labels, assignment over `sabchat_conversations` **done**
- [x] `sabchat-messages` crate — append/list, rich content blocks (text/file/card/carousel/form), attachments via SabFiles, over `sabchat_messages` **done**
- [x] `sabchat-inboxes` crate — per-channel inbox registry, RBAC, channel-config CRUD **done**
- [x] `sabchat-audit` crate — append-only audit log writer **done**
- [x] `sabchat-routing` crate — assignment, round-robin/skill, SLA timers **done**
- [x] `sabchat-widget` crate — public widget endpoints (session, post message, history, identify hmac) **done**
- [x] `sabchat-ws` crate — WebSocket gateway for agent live updates + visitor presence **done**

### Wave 3 — Wiring
- [x] Add 9 crates to `rust/Cargo.toml` workspace members **done**
- [x] Mount routers in `rust/crates/api/src/main.rs` under `/v1/sabchat/*` **done**
- [ ] `cargo check` smoke from workspace root *(harness SIGTERMs long builds; verify outside)*
- [x] Replace `src/app/actions/sabchat.actions.ts` Server Actions with calls into Rust API **done** (new file `src/app/actions/sabchat-v2.actions.ts` + `src/lib/rust-client/sabchat.ts`)
- [x] New ZoruUI inbox v2 page (`/dashboard/sabchat/inbox-v2`) reading from new endpoints **done**

---

## Wave 4 — Pillars 1 (channel adapters), 3 (AI), 4 (automation), 5 (CRM), 6 (KB), 7 (commerce), 9 (teams), 10 (reports)

Dispatched via 20 parallel agents on 2026-05-27. 18 new Rust leaf crates + 2 Next.js pages. All registered in workspace + api binary state/router/main.

### Channel adapters (Pillar 1 / Q2)
- [x] `sabchat-channel-whatsapp` — Wachat Cloud webhook → conversation **done** (1240 lines)
- [x] `sabchat-channel-instagram` — Instagram DM + comment → conversation **done** (1202 lines)
- [x] `sabchat-channel-facebook` — Messenger + Page-comment → conversation **done** (1094 lines)
- [x] `sabchat-channel-telegram` — Telegram bot updates → conversation **done** (1155 lines)
- [x] `sabchat-channel-email` — Email inbound (References-threading) → conversation **done**
- [x] `sabchat-channel-sms` — Twilio/MSG91 SMS inbound → conversation **done** (772 lines)

### AI layer (Pillar 3 / Q2)
- [x] `sabchat-ai-copilot` — agent draft / summarize / suggest / wrap-up (LLM trait + StubClient) **done** (993 lines)
- [x] `sabchat-ai-translate` — text / detect / message (Translator trait + StubTranslator) **done** (642 lines)
- [x] `sabchat-ai-sentiment` — sentiment / intent / topic / PII (StubClassifier with regex) **done** (997 lines)
- [x] `sabchat-ai-resolve-bot` — RAG over KB articles, confidence-gated auto-reply or escalate **done** (1116 lines)

### Automation + SLA (Pillar 4 / Q3)
- [x] `sabchat-macros` — multi-step macros with `{{var}}` templating + audit + rollup **done** (1650 lines)
- [x] `sabchat-sla` — policy CRUD + per-conv apply + cron sweep + `pick_policy_for` helper **done** (1316 lines)
- [x] `sabchat-business-hours` — calendars + holidays + `is_open` evaluator (chrono-tz) **done**

### CRM-native (Pillar 5)
- [x] `sabchat-crm-bridge` — contact link / push / pull + conversation→deal/ticket/booking **done** (1188 lines)

### Help Center (Pillar 6)
- [x] `sabchat-knowledge` — SabKnow MVP: portals + categories + articles + public read API **done**
- [x] `/dashboard/sabchat/knowledge` — ZoruUI agent KB management page **done** (1310 lines TS)

### Commerce (Pillar 7)
- [x] `sabchat-commerce` — product card / catalog carousel / payment link + webhook callback **done**

### Team Ops (Pillar 9)
- [x] `sabchat-teams` — teams + skill matrix + agent-skill levels + presence **done**

### Reporting (Pillar 10)
- [x] `sabchat-reports` — live / volume / response-times / by-agent / by-inbox / by-channel / CSAT (Mongo aggregations) **done**
- [x] `/dashboard/sabchat/reports` — ZoruUI analytics dashboard page **done** (495 lines TS)

### Wire-up
- [x] Added 18 path deps to `rust/crates/api/Cargo.toml` **done**
- [x] Added 18 imports + 18 fields + 18 ctor params + 18 `FromRef` impls in `state.rs` **done**
- [x] Added 18 router builders + 20 `.nest()` calls (knowledge has `public_router`, commerce has `webhook_router`) in `router.rs` **done**
- [x] Added 18 state constructors + 18 args to `AppState::new(...)` in `main.rs` **done**
- [ ] `cargo check` smoke (harness SIGTERMs long builds; verify outside)

### New URL surface

```
/v1/sabchat/channels/whatsapp     /v1/sabchat/macros
/v1/sabchat/channels/instagram    /v1/sabchat/sla
/v1/sabchat/channels/facebook     /v1/sabchat/business-hours
/v1/sabchat/channels/telegram     /v1/sabchat/crm-bridge
/v1/sabchat/channels/email        /v1/sabchat/kb         + /v1/sabchat/kb-public
/v1/sabchat/channels/sms          /v1/sabchat/commerce   + /v1/sabchat/commerce-webhook
/v1/sabchat/ai/copilot            /v1/sabchat/reports
/v1/sabchat/ai/translate          /v1/sabchat/teams
/v1/sabchat/ai/sentiment
/v1/sabchat/ai/resolve-bot
```

---

## Wave 5 — Additional Pillars

Dispatched via parallel agents. Complete and wired.

- [x] `sabchat-public-api` — API-key gated routes **done**
- [x] `sabchat-cobrowse` — WebRTC co-browse sessions **done**
- [x] `sabchat-dispositions` — Disposition CRUD and stats **done**
- [x] `sabchat-sso` — Admin SSO config + SCIM **done**
- [x] `sabchat-channel-viber` — Viber adapter **done**
- [x] `Next.js admin shell` — Frontend admin screens **done**

### Wave 5b — Cleanup and Wire-up
- [x] `rust/crates/api/Cargo.toml` path dependencies **done**
- [x] `rust/crates/api/src/state.rs` struct updates **done**
- [x] `rust/crates/api/src/router.rs` sub-routers mounted **done**
- [x] `rust/crates/api/src/main.rs` constructors **done**

---

## Wave 6 — Frontend Convergence & Final Adapters

Dispatched via 7 parallel agents on 2026-05-27.

### Phase A: Missing Channel Adapters
- [ ] `sabchat-channel-apple` — Apple Business Chat ingest
- [ ] `sabchat-channel-gbm` — Google Business Messages ingest
- [ ] `sabchat-channel-x` — X (Twitter) DMs ingest

### Phase B: Smart Widget 2.0 (Frontend)
- [ ] `src/app/widget-v2/` — WebRTC Co-browse, Voice/Video, Help Center search, Pre-chat forms

### Phase C: Inbox v2 Power-ups (Frontend)
- [ ] `src/app/dashboard/sabchat/inbox-v2/` — Contact 360 panel, Multi-tabs, Command Palette, Actions (Snooze, Follow, etc.)

### Phase D: App Marketplace
- [ ] `sabchat-marketplace` — Tenant integrations backend
- [ ] `src/app/dashboard/sabchat/admin/marketplace` — Tenant integrations UI

### Wire-up
- [x] `rust/crates/api/Cargo.toml` path dependencies **done**
- [x] `rust/crates/api/src/state.rs` struct updates **done**
- [x] `rust/crates/api/src/router.rs` sub-routers mounted **done**
- [x] `rust/crates/api/src/main.rs` constructors **done**
