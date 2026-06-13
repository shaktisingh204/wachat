# SabSMS v2 — Audit Fix Waves

Source: `plans/sabsms-v2-audit-gaps.json` (144 gaps: 31 critical, 60 major, 53 minor).
Build truth at audit time: engine **213 cargo / 0 warnings**, **594 TS tests pass**, BUT **237 tsc errors in `src/app/sabsms`** (masked by "scoped tsc on touched files"). Engine logic largely real; UI layer heavily mocked-as-real.

## Wave A — correctness core (RUNNING) — disjoint file ownership
- **engine** (`services/sabsms-engine/**`): finalise unit bug (segments not cents), DLR cross-workspace IDOR scope, ticker honors `notBeforeEpochMs`, consent/suppression schema unify, Telnyx provision real id+caps, number-release-at-provider path, verify fraud ticker spawned, +tests.
- **billing** (`credits/route.ts`, `lib/sabsms/credits/**`): channel passthrough (MMS 3×, RCS flat), finalise recompute from segments, releaseExpiredHolds periodic, credit-mirror dedup (shared `credits/core.ts`).
- **security** (`templates/actions.ts`, `ratecards/store.ts`): IDOR — session-derived workspaceId, rate-card child-attach authorization.
- **foundations** (`lib/sabsms/types.ts`, `db/collections.ts`, `engine-client.ts`, `ecosystem.config.js`, `.env.example`): PM2 entries (identity/insights nightly + credits sweeper), `SABSMS_ENGINE_PUBLIC_URL`, additive schema (rcsEnabled, keyword_rules, tenDlc, engine-written message fields), page-toolkit tsc fixes.

## Wave B — UI de-mock by route-group cluster (disjoint dirs) — PENDING A
Each cluster: convert mock-presented-as-real → real (wire to existing backend) OR honest "coming soon" if no backend; fix tsc errors in its own files; no cross-cluster shared-file edits (A owns those).

- **C-compliance** (`app/sabsms/compliance/**`): hub (319-line fiction), 10dlc (fake TCR + make `tenDlc.status` settable on provider accounts so US marketing isn't permanently blocked), gdpr (mock SAR), audit (fake hash-chain), keywords (real engine feature, fake stats + build keyword-rules CRUD UI), dlt nav-reachability.
- **C-analytics** (`app/sabsms/analytics/**`): cohorts (Math.random), numbers (Math.random scorecards), funnel (missing page.tsx, orphan client), deliverability (fake constants), facet filters not wired, scorecard `$push` memory risk, bot/HEAD click filtering.
- **C-settings** (`app/sabsms/settings/**`): billing (fake invoices → real usage or platform redirect), team (mockTeam → real RBAC via getEffectivePermissionsForProject), notifications (local-only → persist), RCS enable toggle, reseller white-label/carrier-fee.
- **C-campaigns** (`app/sabsms/campaigns/**` + `scheduled/**`): advanced builder sends nothing, detail pause/resume bypass engine, MMS/RCS/list/CSV audiences, link-tracking toggle decorative, iCal `[token]` route 404.
- **C-numbers-providers** (`app/sabsms/numbers/**`, `providers/**`): add-number → mock wizard, fake Sync, dead routing/webhook bulk actions, providers/routing dup of real routing, pool strategy UI (engine-ready, no UI).
- **C-templates-send** (`app/sabsms/templates/**` minus actions.ts, `send/**`, `quick-send/**`): templates/create dead mock, approval enforcement at send, DLT binding forwarded into EnqueueSendInput, quick-send DLT id dropped, MMS composer (SabFilePicker→public URL→mediaUrls).
- **C-inbox** (`app/sabsms/inbox/**`): remove mock generateAiReply, reply attachments, real assignment directory, keyword-rules link.
- **C-shell** (`app/sabsms/page.tsx` dashboard, routing+health nav registration, dock/module reg, `sabflow-blocks`/`flow`/`api/sabsms/blocks` MOCK_BLOCKS, `[...slug]` coming-soon, `providers/routing` removal).
- **C-devplatform** (`app/sabsms/{otp,api-keys,api-docs,sdk-reference,webhooks}/**`, `app/api/v1/sms/**`): public-API mediaSabFileIds actually send media, lookup plan-gate/meter, RCS fallback-rate analytics hook.

## Deferred (document honestly; net-new, lower-value, plan-deferred) — NOT faked
- OTP drop-in hosted widget (V2.7/V2.13) — large net-new.
- `sk_test_` full sandbox mode tied to mock provider — net-new.
- White-label theming + carrier-fee pass-through line items (V2.13 reseller) — net-new.
- SabCRM contact-picker resourceLocator in send (E.164 input works today).
- Full TCR / DLT-portal API auto-sync (manual entry path must work).

## Wave C — verification + tsc-zero sweep + e2e
cargo test, full tsx, scoped tsc must reach 0 in src/app/sabsms + src/lib/sabsms, extend scripts/sabsms-e2e.mjs (retry→dead-letter, cross-workspace creds, reserve-batch, hold release), chaos failover test.
