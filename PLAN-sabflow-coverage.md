# SabFlow — Coverage Plan (Track C: Stubs, Integrations, Collab GA, Playback, Marketplace)

**Goal:** close the five remaining product gaps that block SabFlow from full n8n parity. Each gap maps to one or more phases; every phase is 10 sub-tasks dispatched as parallel worktree agents — same execution model as `PLAN-sabflow-crdt-collab.md`.

The five gaps:

1. **~150 Rust stub executors** in `rust/crates/sabflow-nodes/` still emit `stub: true` (73 already masked by working forge fallbacks).
2. **~570 n8n integrations** SabFlow doesn't have. Each is 1–3 days of real work.
3. **Real-time multi-user collab** (WebSocket presence + CRDT) — design ADRs landed; needs implementation + infra.
4. **Recording-style execution playback** — n8n's frame-by-frame run inspector. Needs server-side trace streaming, not just snapshot replay.
5. **Marketplace as a content library** — UI ships and the registry has ~10 templates; n8n has hundreds curated over years.

## Execution model (inherits from PLAN-sabflow-crdt-collab.md)

- **10 phases total**, named `C.1` through `C.10`.
- Phases run **sequentially**; sub-tasks within a phase run **in parallel** (10 agents).
- Each phase merges into `phase/c-N-<name>` before the next phase opens.
- A phase closes only when all 10 sub-tasks land green (CI + review).
- Long-tail integrations (beyond Phase C.7's 250) and marketplace templates (beyond Phase C.10's ~200) move to a rolling backlog after Track C closes — they are not phases.

---

## Phase C.1 — Inventory & taxonomy

**Goal:** machine-readable inventory of every gap before any backfill starts. Without this, we cannot prioritise.

1. Enumerate every Rust stub in `rust/crates/sabflow-nodes/` — emit `docs/inventory/rust-stubs.json` with `{ nodeType, file, hasForgeFallback, lastTouched, complexityHint }`. Build script wired into CI so the inventory stays live.
2. Enumerate the 73 forge fallbacks (`src/lib/sabflow/forge/blocks/n8n/`, `parity*/`, `shims*/`) — emit `docs/inventory/forge-fallback-map.json` and confirm 1:1 with the masked Rust stubs.
3. Compare against n8n's node manifest (vendored under `vendor/n8n-nodes/` or pulled fresh) — emit `docs/inventory/n8n-missing.json` with one row per missing integration including `nodeType`, `category`, `credentialType[]`, n8n version it landed in.
4. Rank by demand: pull from any available SabFlow execution telemetry + customer-ask records, fall back to public n8n usage signals (issue counts, community-survey rankings). Output `docs/inventory/priority-bands.json` with bands `S` (top 30), `A` (next 50), `B` (next 200), `C` (long tail).
5. Audit the playback gap: read `docs/adr/sabflow-execution-state.md` and `sabflow-executor-observability.md`; produce a delta doc listing what's already streamed (per-node start/end events) vs what playback needs (per-item input/output + intermediate state). Output `docs/inventory/playback-gap.md`.
6. Audit current marketplace templates — list the 10, classify by category, identify gaps where users hit "no template for X". Output `docs/inventory/marketplace-state.md`.
7. Audit the collab gap: cross-reference `PLAN-sabflow-crdt-collab.md` Track A Phases 3–10 against landed code; what's design-only vs partially-implemented vs done. Output `docs/inventory/collab-state.md`.
8. Build a dashboard page at `/dashboard/internal/sabflow-coverage` (admin-only) that reads the JSON inventories and renders progress: stub-coverage %, integration-coverage %, etc. RBAC-gated.
9. Wire CI: each PR touching `rust/crates/sabflow-nodes/` or `src/lib/sabflow/forge/` must update the relevant inventory JSON or the PR fails. Prevents drift.
10. Write the umbrella ADR `docs/adr/sabflow-coverage.md` that pins the priority bands and acceptance gates for Phases C.2–C.10.

**Gate:** all 10 sub-tasks land + CI dashboards green + priority-band JSON reviewed by product.

---

## Phase C.2 — Rust node harness & author SDK

**Goal:** shipping 150+ node implementations is unsafe at scale without a parity-test harness and an authoring SDK. This phase builds both before any backfill.

1. Golden-fixture harness: spin up an n8n Docker container during CI, run the same workflow against both n8n and SabFlow Rust executor, byte-compare output JSON. Output `benches/sabflow-node-parity/`.
2. Node-author SDK: derive-macro crate `sabflow-node-derive` so `#[node]` attribute reduces boilerplate from ~80 lines to ~15. Document in `rust/crates/sabflow-nodes/AUTHORING.md`.
3. Credential-injection harness: per-test mocked credentials with the same envelope shape as `sabflow_credentials` rows; verifies `getCredentials()` parity with n8n.
4. Expression-engine integration: confirm `{{ $json.foo }}` evaluation inside Rust nodes matches `sabflow-expression-syntax.md` ADR. Adds Rust-side expression tests.
5. Error-taxonomy parity: every n8n error (`NodeApiError`, `NodeOperationError`, `WorkflowOperationError`) maps to a Rust `CredentialsError` / `NodeError` variant. Documented in `docs/adr/sabflow-executor-rust-errors.md`.
6. Item-iteration helpers: `for_each_item`, `pair_items`, `merge_branches` — the loops every n8n node hand-rolls. Hide behind SDK so node authors don't reinvent.
7. Binary-data SDK: `BinaryDataRef` type that lazily fetches from SabFiles via the Rust BFF; mirrors n8n's `IBinaryData` shape. ADR in `docs/adr/sabflow-binary-data.md`.
8. Continue-on-fail handling: SDK exposes `try_with_continue_on_fail` so nodes don't reimplement.
9. CI matrix update: `cargo test` + golden-fixture comparison + n8n-vendored fixtures, all gated. Update `.github/workflows/sabflow-rust.yml`.
10. Author one reference node (HTTP Request) end-to-end using the new SDK; merge it as the proof-of-concept. Becomes the template every C.3 agent copies.

**Gate:** harness reproduces all 73 already-working forge nodes byte-for-byte against n8n; HTTP Request reference node ships.

---

## Phase C.3 — Top-30 Rust stub backfill (S-band)

**Goal:** the 30 hottest nodes (HTTP, control flow, item manipulation) shipped in Rust with parity tests. 10 agents × 3 nodes each.

Bands S nodes (from C.1.4 priority JSON — final list locks at C.1 close). Indicative slate:

1. HTTP Request + HTTP Request (auth variants) + Webhook
2. Set + EditFields + Function
3. IF + Switch + Merge
4. Code + Function Item + Filter
5. ItemLists (Aggregate / SplitOut / Summarize)
6. RemoveDuplicates + Sort + Limit
7. ScheduleTrigger + ManualTrigger + ExecuteWorkflowTrigger
8. ExecuteWorkflow + Wait + StopAndError
9. NoOp + Compression + DateTime
10. ConvertToFile + ConvertToText + RespondToWebhook

Each agent: implement 3 nodes using C.2 SDK, write golden-fixture tests against n8n, flip `stub: true` → `stub: false` in registry, update `docs/inventory/rust-stubs.json`.

**Gate:** all 30 nodes pass parity tests; `stub:true` banner stops showing for any of them.

---

## Phase C.4 — Mid-tier Rust stubs (A-band, 60 nodes)

**Goal:** 60 next-priority nodes. 10 agents × 6 nodes each.

Indicative content: storage adapters (S3, FTP, SFTP), DB connectors (MySQL, Postgres, Redis, Mongo, MSSQL), file ops (ReadWriteFile, ReadBinaryFile, MoveBinaryData), data shaping (XML, HTML extract, RSS, CSV, ICS), email (EmailSend, EmailReadImap), basic utilities (Crypto, HMAC, JWT, UUID, RandomData), date/time helpers, error trigger / error workflow.

**Gate:** parity tests green for all 60; `docs/inventory/rust-stubs.json` shows `unmasked count: 60`.

---

## Phase C.5 — Long-tail Rust stubs (final ~60)

**Goal:** close the remaining stubs. Acceptance bar drops slightly for rarely-used nodes (smoke tests instead of full golden fixtures), documented in the umbrella ADR.

Indicative content: niche transforms (XPath, JSONata, HTML to Markdown), small SaaS endpoints with one-method integrations, CRM/ERP tail (small Mailgun-tier providers), legacy / deprecated-in-n8n nodes we still need for migration parity.

**Gate:** zero `stub:true` rows remain in `docs/inventory/rust-stubs.json`. Bench summary in `docs/adr/sabflow-stub-coverage-summary.md`.

---

## Phase C.6 — Top-50 missing n8n integrations (S-band)

**Goal:** the 50 integrations with the highest user demand, shipped end-to-end (node + credential type + tests + docs).

Indicative slate (final list from C.1.3 + C.1.4 priority JSON):

| # | Integrations bundled (5 per agent) |
|---|---|
| 1 | Gmail OAuth2, GoogleDrive OAuth2, GoogleSheets OAuth2, GoogleCalendar OAuth2, GoogleContacts OAuth2 |
| 2 | Slack (OAuth2 + Webhook), Discord, Telegram, MicrosoftTeams, Zoom |
| 3 | Twilio, SendGrid, Mailchimp, Postmark, Mailgun |
| 4 | HubSpot, Salesforce, Pipedrive, ActiveCampaign, ConvertKit |
| 5 | Stripe, Shopify, PayPal, Square, WooCommerce |
| 6 | Notion, Airtable, Coda, ClickUp, Monday.com |
| 7 | GitHub, GitLab, Bitbucket, Linear, Jira |
| 8 | Asana, Trello, Todoist, Calendly, TypeForm |
| 9 | Dropbox, OneDrive, Box, S3, R2 |
| 10 | OpenAI, Anthropic, Cohere, Mistral, OpenRouter |

Each agent: 5 integrations × (node impl + credential type registered in `executor/credentials/schema.ts` `CREDENTIAL_TYPES_KNOWN` + per-type test op via Phase B.5 §8 registry + at least one golden-fixture parity test + node-reference doc). Stub flag flipped.

**Gate:** 50 new credential types live + 50 new node types runnable on real test accounts + parity tests green.

---

## Phase C.7 — Mid-tier integrations (B-band, 200 nodes)

**Goal:** next 200 by priority. 20 agents × 10 integrations each.

Same pattern as C.6 but quality bar tightens on credential injection (every type must round-trip via Phase B.5 §9 import-n8n) and relaxes slightly on node-doc detail (auto-generated from the SDK descriptor; manual edits only where the upstream API has a quirk worth flagging).

**Gate:** SabFlow's integration count crosses 250 (33 existing + 50 from C.6 + 200 here) + integration-coverage % on the C.1.8 dashboard ≥ 44% of n8n's published 570.

---

## Phase C.8 — Real-time collab GA (Track A Phases 3–10 closeout)

**Goal:** ship the collab feature whose ADRs landed today. This phase doesn't redesign — it executes `PLAN-sabflow-crdt-collab.md` Track A Phases 3–10 in sequence (Phases 1–2 already closed via the ADRs).

Sub-tasks map to the existing Track A phases (each agent owns one phase's worth of sub-tasks; phases run sequentially as Track A specifies, but the 10 agents here parallelise *within* each Track A phase). To keep this phase to 10 sub-tasks rather than 80, we batch Track A's 10 sub-tasks-per-phase under each agent:

1. Stand up `services/sabflow-ws/` Node service per `sabflow-ws-gateway-node.md` §2 (10 sub-tasks of A.3 in one agent's worktree).
2. Implement Yjs sync protocol per `sabflow-sync-ordering.md` (Track A.4 closeout).
3. Build `useSabFlowDoc` + `usePresence` + `<SabFlowProvider>` (Track A.5).
4. Editor integration — replace `EditorPage.tsx` in-memory `flow` state with `useSabFlowDoc(flowId)` (Track A.6).
5. Presence & awareness (Track A.7 — most already shipped per `project_sabwa_zoruui_migration` memory; just verify + close gaps).
6. Per-doc RBAC keys registered globally via Phase B.8 §1 pattern; share-link tokens (Track A.8).
7. Reliability runbooks: gateway crash, Redis split-brain, KEK leak (cross-references Phase B.5 KMS runbook). Track A.9.
8. Perf rollout: Yjs vs yrs final bench, feature-flag ramp by workspace, dashboard wiring. Track A.10.
9. Migration of any docs still on the legacy non-CRDT flow into the new doc shape (`sabflow_docs`). One-shot script + dual-read window.
10. GA announce: docs site, changelog, customer-pilot list, internal demo.

**Gate:** every Track A box checked + 1 paying-tier customer pilot running + zero P1 bugs for 7 days.

---

## Phase C.9 — Execution playback (server-side trace streaming)

**Goal:** the n8n "watch the run frame-by-frame" inspector, on top of the trace channel already designed in `sabflow-executor-observability.md` §3.

1. Extend `publishTraceEvent` in `executeFlow.ts` to emit per-item snapshots (input + output JSON, capped at 256 KiB per side; larger payloads pointer-indirect to R2 via SabFiles per `sabflow-execution-state.md` §4). ADR in `docs/adr/sabflow-playback-trace-shape.md`.
2. Add a `replay` topic to the trace channel; persisted to `sabflow_execution_traces` (new collection, TTL 30 days for non-pinned runs).
3. SSE endpoint `/api/sabflow/executions/[id]/replay` that streams the persisted trace + pointer-resolved snapshots in original execution order.
4. Pinning API — a user can pin an execution (skip TTL); pin status persists to `sabflow_executions.pinned: true`. RBAC-gated.
5. Playback UI: scrub bar, play/pause, frame stepping, per-node input/output side-by-side, per-item drill-down. Built as `<PlaybackInspector>` in `src/components/sabflow/playback/`.
6. Time-travel debug: clicking a node in playback opens its config panel in read-only with the exact `parameters` it ran with (re-resolved expressions).
7. Diff view: when re-running with edits, the playback UI overlays old run vs new run per-node.
8. Mobile playback view (read-only) — same SSE feed, condensed UI.
9. Export: download a single run as `.sabflow-trace.zip` containing the JSON trace + pointer-resolved payloads. Useful for support.
10. Docs: `docs/features/execution-playback.md` + in-app onboarding tour.

**Gate:** playback works for any execution captured under the new trace shape; old executions degrade gracefully to snapshot-only mode.

---

## Phase C.10 — Marketplace content library

**Goal:** turn the marketplace from a 10-template shelf into a content library — authoring kit, review pipeline, partner program, rolling target of 50 → 100 → 200+.

1. Template-authoring CLI: `npx sabnode-template init <name>` scaffolds a template package with `template.json`, a screenshot, a category tag, and a verification harness.
2. Verification pipeline: every template runs in an empty-workspace sandbox during CI — must complete in < 60 s and produce no errors. Failed templates blocked from publish.
3. In-product review queue: admin UI at `/dashboard/admin/marketplace/queue` showing submitted templates, screenshots, run logs. RBAC-gated to internal reviewers.
4. Partner program: contributor docs at `docs/partners/marketplace-contributing.md`, NDA-light agreement, attribution + revenue share (deferred to billing review for actual split).
5. Browse UX: rebuild `/marketplace` with categories (Sales, Marketing, Ops, AI, Internal Tools, Developer), search, filter by required-integrations, "works with my workspace" badge (computed from installed credential types).
6. One-click install: clones template into user's workspace; prompts for missing credential types; uses Phase B.5 §9 import path under the hood.
7. Versioning: templates carry semver; an installed copy can be upgraded; diff view shows what changed.
8. Seed 40 first-party templates across the 6 categories (CRM sync, lead-routing, GPT-4 content pipelines, Slack alerts, Shopify ops, GitHub release automation). Each one tested under C.10.2 pipeline.
9. Open partner contributions: ship docs + a public template repo, recruit 5 launch partners with 5 templates each = 25 partner templates at GA.
10. Telemetry: install counts, run counts, success/failure rates per template — wired to the C.1.8 coverage dashboard.

**Gate:** ≥ 65 published templates live + partner program documented + verification pipeline green for all of them.

---

## Open questions

1. **C.6/C.7 batching:** is a 5-integrations-per-agent batch the right size, or should we drop to 3 to leave headroom for one-off credential weirdness (e.g., Salesforce's domain-scoped OAuth)?
2. **Stub backfill quality bar in C.5:** smoke tests instead of full goldens for niche nodes — is that acceptable, or do we want full parity for everything?
3. **Marketplace revenue share** (C.10.4): defer entirely to billing review, or sketch a number now so contributors know what to expect?
4. **C.8 gate condition** of "1 paying-tier customer pilot" — do we have a named candidate?
5. Track C runs after Phase B.6 manual-trigger retry (still open per recent commit message). Confirm B.6 closes before C opens, or run C.1 (inventory only, no implementation) in parallel.

---

## Cross-references

- `PLAN-sabflow-crdt-collab.md` — Tracks A + B; this plan inherits the execution model and consumes Track A Phases 1–2 outputs.
- `docs/adr/sabflow-foundation.md`, `sabflow-executor-foundation.md` — umbrellas this plan extends.
- `docs/adr/sabflow-credentials-*.md` — Phase B.5 ADRs; C.6/C.7 nodes register against these schemas.
- `docs/adr/sabflow-executor-observability.md` — the trace channel C.9 builds on.
- `docs/adr/sabflow-execution-state.md` — the `sabflow_executions` collection C.9 extends.
