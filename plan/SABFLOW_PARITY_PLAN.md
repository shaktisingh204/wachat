# SabFlow → n8n + Typebot parity plan

Last reviewed: 2026-05-19.
Owner: SabFlow core.
Status: draft for review.

---

## 0. How to read this document

This plan covers everything required to bring SabFlow inside SabNode to feature-parity with n8n's full node catalogue and Typebot's conversational-bot DX. It is intentionally exhaustive — every phase contains:

- Goal — what shipped at the end of the phase looks like.
- Sub-phases — week-sized milestones inside the phase.
- File-and-folder deliverables — concrete paths under `src/` or `tools/`.
- Acceptance criteria — what must be demonstrably true to call the phase done.
- Risks and unknowns — what may go sideways and the mitigation we plan to use.
- Telemetry — what events SabFlow records so we can prove the feature is used.

All deliverables sit inside the existing SabFlow module of SabNode (`src/lib/sabflow/**`, `src/app/dashboard/sabflow/**`, `src/components/sabflow/**`). Nothing in this plan introduces a new top-level product surface — every artefact ships as part of SabFlow or SabNode.

---

## 1. Reality check — what already exists

A walk of the SabNode repo before this plan started:

| Area | Files | Notes |
|---|---:|---|
| `src/lib/sabflow/forge/blocks/n8n/**` | 782 | SabFlow forge-block implementations, organised by category: ai, aws, commerce, communication, crm, devops, email, google, microsoft, langchain_embed, langchain_misc, langchain_retrievers, langchain_chains, security, infra, hr, tools, plus mass_a … mass_i staging dirs. Sampled `AzureStorage` block — full `apiRequest` wiring, not a stub. |
| `src/lib/sabflow/n8n/**` | 256 | n8n-runtime parity port: execution-context, expression sandbox, errors, extensions, helpers, expression evaluator, augmentation, data-table types. |
| `src/lib/sabflow/forge/blocks/typebot/` | 5 | `blink`, `cards`, `chatnode`, `dify_ai`, `return_block`. Tiny — Typebot port is currently a stub. |
| `src/lib/sabflow/integrations/**` | 10 | Hand-written services: anthropicAi, calCom, elevenlabs, googleSheets, mistral, nocodb, openAi, sendEmail, togetherAi, types. |
| `src/lib/sabflow/executor/nodes/**` | 10 | Core node-engine kernels: branching, code, cron-trigger, error-trigger, function, http-request, loop-merge, set, wait, webhook-trigger. |
| `src/lib/sabflow/triggers/**` | 6 | cronParser, debounce, health, receiver, replay, scheduleRegistry. |
| `src/lib/sabflow/expressions/**` | 7 | Expression engine + sandbox. |
| `src/lib/sabflow/queue/**` | 8 | SabFlow queue + worker plumbing. |
| `src/lib/sabflow/worker/**` | 1 | Worker bootstrap. |
| `src/lib/sabflow/engine/**` | 11 | Variable substitution, evaluator, glue. |
| `src/lib/sabflow/marketplace/**` | 5 | install, versioning, templates, telemetry, registry. |
| `src/lib/sabflow/oauth/**` | 7 | Provider registry (47), state store, refresh, revoke, scope catalog, credential-type map, README. |
| `src/lib/sabflow/credentials/**` | 3 | Types catalog (200+ credential types), encryption, db wrapper. |
| `src/components/sabflow/**` | ~20 top-level dirs | editor, canvas, blocks, chat (ChatBubble, ChatWindow, SabFlowChat, TypingIndicator, EmbedListener), debug, inspector, playback, presence, marketplace, panels, results, templates, variables, dataPicker, diff, graph. |
| `src/app/api/sabflow/import-typebot/route.ts` | 1 | Typebot v3 JSON importer. |
| `src/app/api/embed/widgets/**` | — | Embed/widget API. |
| `src/lib/sabflow/app-presets/**` | 530 | API descriptors (345 `n8n-*` ports + 185 native). |
| OAuth providers registered | 47 | Includes PKCE (Twitter, Airtable) and per-tenant subdomain (Zendesk, Freshdesk, Shopify). |

**Conclusion**: the structural scaffold is largely in place. The remaining work is registry wire-up, narrow feature gaps, conversational-block buildout, embed widget polish, per-node documentation, and end-to-end QA. This is finishing work, not a greenfield rewrite.

---

## 2. Scope

### 2.1 What "100% n8n parity" means inside SabFlow

In scope:

- Every n8n built-in node in `n8n-master/packages/nodes-base/nodes/**` has a working SabFlow forge equivalent. "Working" means: the operations listed in n8n's documentation execute against the real upstream API; the form schema renders in the SabFlow inspector; auth is wired to a SabFlow credential; outputs match n8n's shape closely enough that a flow imported from n8n produces semantically identical data.
- SabFlow's visual builder supports drag-drop, connection routing, sub-workflows, error-branch routing, retry / wait policies, multi-output branching, loop / split-in-batches, expression editor with autocomplete on upstream-node schemas, data-pinning for replays, and node disabling.
- SabFlow ships triggers for: cron (already), webhook with path + response builder + wait-for-response mode, manual trigger with stored test payloads, generic poll trigger, and error trigger.
- SabFlow Code and Function nodes execute untrusted JavaScript inside the SabFlow sandbox service with timeouts, memory caps, a curated module allow-list, and the helper globals `$json`, `$node`, `$input`, `$workflow`, `$now`, `$itemIndex`.
- SabFlow AI agents (LangChain-style): chains, agents, tools, memory, retrievers, vector stores — every `langchain_*` directory under `forge/blocks/n8n/` reaches "registered + form-rendered + tested" status.
- SabFlow credentials cover OAuth (with refresh, PKCE, per-tenant subdomain), API key, basic auth, bearer, HTTP header, OAuth-1, and AWS-SigV4 — all already typed in `credentials/types.ts`.
- SabFlow executions UI: list with filters, retry-from-here, retry-from-start, partial run from a chosen node, step-replay (component shells already exist under `components/sabflow/playback`).
- SabFlow variables + per-environment overrides surfaced in the builder.
- SabFlow marketplace install/share round-trip for entire flows.
- SabFlow self-host runbook for the SabFlow worker pool + Mongo + Redis.

Out of scope (explicit deferral):

- The full n8n community-node ecosystem. We cover n8n's built-in catalogue only.
- n8n's "Workflow Trigger by Another Workflow" full UX — SabFlow ships basic sub-workflows first; cross-flow event triggering follows in a later release.
- n8n's "AI Tool framework v2" — lands after stable LangChain-style agents.
- n8n's REST API surface for managing workflows externally — SabFlow already exposes its own REST under `/api/v1/**`; we do not add an n8n-compatible alias.

### 2.2 What "needed features of Typebot" means inside SabFlow

In scope:

- SabFlow conversational blocks shipped as a category in the same forge-block registry the workflow nodes live in:
  - **Bubbles**: text, image, video, embed, audio, file (SabFiles-sourced — no free-text URL paste).
  - **Inputs**: text, number, email, url, date, time, phone, choice, picture-choice, rating, payment, file-upload (SabFiles destination).
  - **Logic**: condition, set-variable, redirect, jump, end.
  - **Integrations**: any SabFlow workflow node can be invoked from a conversational flow as a step.
- SabFlow bot widget: a small standalone runtime bundle that hosts a SabFlow flow in `bubble | popup | container | standalone` modes, embeddable on any site with a single `<script>` snippet. Bundle is served from the SabFlow domain.
- SabFlow theme: per-flow style document (font, colors, button radius, avatar SabFile id, position, language).
- SabFlow live-preview pane in the builder that mirrors the widget's runtime.
- SabFlow analytics: per-block reach count, per-flow completion funnel, drop-off heatmap on the canvas.
- SabFlow Typebot import: the existing `/api/sabflow/import-typebot` route handles the full Typebot v3 flow JSON schema, mapping every Typebot block type onto a SabFlow conversational block.

Out of scope:

- Typebot's "Group" abstraction — SabFlow keeps flow blocks flat, the same way n8n does. The importer flattens any imported Typebot groups.
- Typebot's whitelabel pricing tiers and team-billing nuances — SabFlow's existing plan-and-credit machinery covers this differently and is not on the parity list.
- Typebot's standalone hosted-by-Typebot landing pages. SabFlow ships an embedded-on-your-site widget; landing-page hosting is a follow-up.

### 2.3 SabNode-platform constraints honoured throughout

- All file inputs and uploads go through SabFiles (`<SabFilePicker>`, `<SabFilePickerButton>`, `<SabFileUrlInput>`, `<SabFileToFileButton>`). No raw URL paste fields anywhere. This is a SabNode-wide rule; SabFlow follows it.
- All UI components use ZoruUI from `@/components/zoruui`. Motion uses `motion/react` (`m`, `AnimatePresence`, `useReducedMotion`).
- All multi-tenant data is keyed by workspaceId. RBAC is enforced server-side via SabNode's existing permission machinery.
- All credit-metered operations (AI calls, outbound HTTP, executions) decrement the workspace's credit balance via SabNode's existing meter.

---

## 3. Conventions, patterns, and house rules

These conventions are non-negotiable for every PR landed under this plan. They keep the codebase consistent and reviewable.

### 3.1 Block-author conventions

- Every forge block lives at `src/lib/sabflow/forge/blocks/<category>/<block-id>.ts`.
- A block file exports nothing and ends with `registerForgeBlock({ ... })`. Side-effect-only modules; the registry imports them at startup.
- Block IDs are `kebab-case`, prefixed by category for vendor-namespaced blocks (`google-sheets`, `microsoft-onedrive`). Native SabFlow blocks use `sabflow-` prefix (`sabflow-http-request`).
- Operations are `dot.case` strings: `record.create`, `record.update.bulk`, `file.upload.streaming`.
- Every operation declares an explicit input schema (Zod) and an explicit output schema (Zod). The inspector form and the typeahead-fed expression editor read from the same Zod schemas. There is no second source of truth.
- Error throwing uses `ForgeError` with `code`, `httpStatus`, `retryable`, `userMessage`. Bare `Error` is reserved for programmer mistakes.

### 3.2 Doc-author conventions

- Every block has a `docs/sabflow/nodes/<block-id>.mdx` page with sections in this order: Summary, Auth setup, Operations table, Field reference, Examples, Errors and fixes, Limits.
- Examples reference real, published marketplace flows by id rather than ad-hoc JSON. This keeps docs and runtime aligned.
- Screenshots live in `docs/sabflow/_assets/` and are stored as SabFiles in the SabNode reference workspace, referenced by SabFile id. (No raw URL paste in docs either.)

### 3.3 Test conventions

- Every block ships with a `*.test.ts` file alongside it that runs against a recorded HTTP fixture in `__fixtures__/`. Fixtures are recorded once against a real test workspace; subsequent runs hit the local fixture, not the live API.
- AI blocks record fixtures against the SabFlow AI provider router with deterministic seeds.
- End-to-end builder tests live in `tests/sabflow/builder.spec.ts` and drive the UI with Playwright.

### 3.4 Branching, commits, PRs

- Branch names: `sabflow/<phase>-<short-slug>` — e.g. `sabflow/p2-subworkflows`.
- Commit message prefix: `feat(sabflow):` for new behaviour, `refactor(sabflow):`, `docs(sabflow):`, `test(sabflow):`, `chore(sabflow):`.
- Every PR references the phase number from this plan and ticks at least one acceptance-criteria checkbox in its description.

### 3.5 Telemetry conventions

- Every user-facing action emits a telemetry event named `sabflow.<surface>.<action>`. Surfaces include `builder`, `widget`, `executions`, `connections`, `marketplace`.
- Block-execution telemetry is recorded under `sabflow.exec.block.<blockId>.<op>` with `status`, `latencyMs`, `errorCode` properties. No PII in event properties.

---

## 4. Glossary

- **SabFlow forge block**: an entry in the SabFlow block registry. May be a workflow node (Slack post, HTTP request, branch, code) or a conversational block (text bubble, choice input). Same registry, different categories.
- **SabFlow node**: synonym for forge block in user-facing copy.
- **SabFlow flow**: a graph of forge blocks plus connection edges. Persisted in Mongo. May be a workflow (n8n-shaped) or a conversation (Typebot-shaped) or both.
- **SabFlow execution**: a single run of a flow. Has a status, a timeline of node-run records, a snapshot of inputs and outputs per node, and a credit-debit ledger entry.
- **SabFlow trigger**: an event source that starts an execution. Triggers are themselves forge blocks of a special trigger category.
- **SabFlow credential**: an encrypted token/secret bag scoped to a workspace, referenced by id from a block's configuration. Already implemented in `src/lib/sabflow/credentials/**`.
- **SabFlow agent**: a SabFlow forge block that wraps a SabFlow AI provider router + tools + memory + retrievers. LangChain-style.
- **SabFlow worker pool**: the set of processes that pull from the SabFlow queue and run executions. Currently `src/lib/sabflow/worker` + `src/lib/sabflow/queue`.
- **SabFlow sandbox**: the isolated execution boundary for user-supplied code (`Code` and `Function` nodes). Implementation lives under `src/lib/sabflow/execution/sandbox/`.
- **SabFlow widget**: the standalone runtime bundle that hosts a SabFlow conversational flow on a third-party page. New in Phase 7.
- **SabFlow marketplace**: the curated catalogue of installable flow templates and forge-block packs. `src/lib/sabflow/marketplace`.
- **SabFlow AI provider router**: SabFlow's existing abstraction over multiple AI providers (`integrations/openAi.ts`, `integrations/anthropicAi.ts`, `integrations/mistral.ts`, etc.). Phase 5 makes this a first-class router.

---

## 5. Phased plan

### Phase 0 — Inventory + truth ledger (1 week)

**Goal.** Replace assumptions with a checked-in ledger that names every existing forge block, its operations, its UI form coverage, and its test coverage. This ledger drives every other phase.

**Sub-phases.**

- **0.1 Audit tool**. Write `tools/sabflow/audit-blocks.ts` (Node CLI, not a route). Walks `src/lib/sabflow/forge/blocks/**` recursively. For every file, parses the AST to find `registerForgeBlock({...})` calls and extracts: `id`, `label`, `category`, operations list (op id, declared input schema fields, declared output schema fields), credentials referenced, whether the block has a sibling `.test.ts`, the count of operations marked `// TODO` or `throw new Error('not implemented')`.
- **0.2 n8n diff**. Walks `n8n-master/packages/nodes-base/nodes/**` if a checkout is provided (env var `N8N_REFERENCE_PATH`). Produces a list of n8n nodes that have no SabFlow counterpart and a list of SabFlow blocks with no n8n parent (native blocks).
- **0.3 Ledger output**. Renders `plan/SABFLOW_BLOCK_LEDGER.md`, sorted by category then block id, one row per block, columns: id, category, ops total, ops implemented, ops stubbed, has test, has doc, n8n parent, gaps. Plus a per-category summary table at the top.

**Deliverables.**

- `tools/sabflow/audit-blocks.ts`
- `tools/sabflow/audit-blocks.lib.ts` (pure functions, unit-tested)
- `tools/sabflow/audit-blocks.test.ts`
- `plan/SABFLOW_BLOCK_LEDGER.md` (generated; committed)
- `package.json` script `"sabflow:audit": "tsx tools/sabflow/audit-blocks.ts"`

**Acceptance.**

- Running `npm run sabflow:audit` regenerates the ledger deterministically.
- The ledger names every file under `forge/blocks/**` exactly once.
- A sample of 20 random blocks is hand-verified — ops listed in the ledger match ops declared in the file.

**Risks.**

- Some forge-block files may use indirect registration (e.g. registering inside a loop or via a factory). The audit tool needs an escape hatch for those; if it can't statically resolve, it lists the file under "needs manual review".

**Telemetry.**

- N/A (offline tool).

### Phase 1 — Block wire-up + builder discovery (3 weeks)

**Goal.** Every implemented forge block is discoverable in the builder, configurable in the inspector, and executable by the SabFlow executor. No more "registered but invisible" or "configurable but not executable".

**Sub-phases.**

- **1.1 Registry uniformity (week 1, days 1–2)**. Audit `src/lib/sabflow/forge/registry.ts` (or equivalent). Every block must register with the same shape — anything declared as `requiresSubdomain`, `requiresCredential`, `category`, `iconName`, `version`, `deprecatedAlias`, `defaultLabel`. Add a runtime assertion that throws at startup if any registered block omits a required field. Write a unit test that loads the registry and runs the assertion.
- **1.2 Inspector form pipeline (week 1, days 3–5)**. The SabFlow inspector form is generated from each block's declared input Zod schema. Drop any hand-maintained inspector form that duplicates a schema. The form supports field kinds: text, password, number, toggle, select, multi-select, json, code, expression, credential-picker, sabfile-picker, color, date, conditional-show (depend on another field). Each kind is a ZoruUI component already living under `components/zoruui` or `components/sabflow/inspector`.
- **1.3 Builder node picker (week 2, days 1–3)**. Right-side palette in the SabFlow editor reads from the same registry. Categories are pulled from each block's `category`. Search is by label + id + tags. Each tile shows icon, label, version, "deprecated" badge if applicable. Drag from palette → drop on canvas creates a new node bound to that block. Hover preview shows ops list + default-credential hint.
- **1.4 Canvas behaviour (week 2, days 4–5)**. Snap-to-grid, smart routing on edges, multi-select, copy/paste, duplicate, group-move, undo/redo verified against existing implementation. Zoom controls + minimap. Touch trackpad pan. Keyboard shortcuts: `Cmd+Z`, `Cmd+Shift+Z`, `Cmd+D` duplicate, `Backspace` delete, `Cmd+/` toggle node disable.
- **1.5 Executor harness (week 3, days 1–3)**. Refactor `src/lib/sabflow/executor/index.ts` so executing a forge block is uniform: resolve credentials → resolve subdomain (if `requiresSubdomain`) → parse inputs via Zod → invoke the block handler → validate output via Zod → record block run on the execution timeline. No special cases per block id.
- **1.6 Block run record schema (week 3, days 4–5)**. `node_run_records` collection in Mongo. Fields: executionId, nodeId, blockId, operation, status, inputJson, outputJson, errorJson, startedAt, finishedAt, retryAttempt. Index on (executionId, nodeId). Retention 30 days by default, configurable per workspace.

**Deliverables.**

- `src/lib/sabflow/forge/registry.ts` consolidated.
- `src/components/sabflow/inspector/SchemaForm.tsx`.
- `src/components/sabflow/editor/NodePicker.tsx`.
- Refactored `src/lib/sabflow/executor/index.ts`.
- Mongo migration adding `node_run_records` collection + indexes.
- Test file `src/lib/sabflow/executor/__tests__/uniformity.test.ts`.

**Acceptance.**

- Every block in the ledger from Phase 0 appears in the builder palette.
- A user can drag any block onto the canvas, configure it through generated forms, run the flow, and see the result in the inspector — without writing custom inspector code per block.
- Executing the same block produces identical outputs against the recorded fixture across three consecutive runs.

**Risks.**

- A block whose declared schema diverges from its real runtime input contract. Mitigation: Phase 0 ledger flags these as "schema-runtime gap" and Phase 1.5 makes the executor's parse step the authority — the block has to conform, not the other way around.

**Telemetry.**

- `sabflow.builder.node_added` with `blockId`, `category`.
- `sabflow.builder.node_configured` on inspector save.
- `sabflow.exec.block.<blockId>.<op>` with `status`, `latencyMs`.

### Phase 2 — Builder UX gaps (3 weeks)

**Goal.** Close the remaining feature gaps between SabFlow's builder and n8n's.

**Sub-phases.**

- **2.1 Sub-workflows (week 1)**. New built-in block `sabflow-execute-workflow`. Input: workflowId (workspace-scoped flow picker), input JSON, wait-for-completion toggle. Output: the called flow's final output JSON or its execution id. Recursion guard: hard cap of 10 nested levels per execution, configurable per workspace. Persisted on the child execution: `parentExecutionId`, `parentNodeId`. Executions UI shows the parent-child tree.
- **2.2 Error branches (week 1)**. Every node gets an optional `onError` output port. When the block throws, the executor routes the error envelope to that port instead of failing the execution. Error envelope shape: `{ code, message, retryable, blockId, operation, attempts }`. If `onError` is not connected, behaviour falls back to the workspace's default error policy (`fail`, `continue`, `route-to-error-trigger`).
- **2.3 Retry policy (week 2, days 1–3)**. Per-node config: max attempts, backoff (`fixed`, `exponential`), backoff base ms, retry-on (`always`, `retryable-only`, `status-code list`). Surfaced in the inspector under an "Advanced" disclosure. Executor honours the policy before falling back to the error port.
- **2.4 Wait nodes (week 2, days 4–5)**. Three wait modes:
  - `time-delta`: pause for N (ms | s | min | h | days).
  - `until-timestamp`: resume at an ISO timestamp.
  - `webhook-resume`: emit a one-time resume URL on the execution, suspend, resume on POST to that URL.
  Suspended executions persist as `status: 'waiting'` rows; SabFlow worker picks them back up via a polling tick on `time-delta`/`until-timestamp` and via the incoming HTTP handler on `webhook-resume`.
- **2.5 Loop / SplitInBatches (week 3, days 1–3)**. Reusable loop block: input is an array, output is per-item iteration plus a "done" output port that fires after the array is exhausted. Batch size configurable. State is held on the execution row, not in worker memory, so a restart resumes correctly.
- **2.6 Expression editor (week 3, days 4–5)**. Monaco-based editor with autocomplete fed by upstream-node Zod output schemas. Pressing `{{` opens a node-output picker. Bracketed expressions evaluate against the live test payload pinned by the user (see Phase 2.7).
- **2.7 Data pinning (carries into 2.6)**. Each node can pin a JSON payload that becomes the "test input" for downstream nodes during builder-time evaluation. Pin button next to the run-this-node button. Pins are workspace-scoped and persisted on the flow document.

**Deliverables.**

- New blocks: `sabflow-execute-workflow`, `sabflow-wait`, `sabflow-loop`, `sabflow-error-trigger` (the existing one extended), `sabflow-error-route` (the always-on shim that materialises the error envelope as a node output).
- `src/lib/sabflow/executor/retry.ts`.
- `src/lib/sabflow/executor/wait.ts` (the persistent-wait machinery).
- `src/components/sabflow/editor/ExpressionEditor.tsx`.
- `src/components/sabflow/editor/PinButton.tsx`.
- Mongo migration: add `pinnedTestInputs` to flow documents; add `parentExecutionId` to executions.

**Acceptance.**

- A flow with a sub-workflow that calls another sub-workflow runs end-to-end and shows the tree in the executions UI.
- A node with retry policy fails the first attempt, succeeds the second, and the execution timeline shows both attempts with the gap recorded.
- A `webhook-resume` wait suspends the execution; the suspended row is visible in the executions UI; POST to the resume URL completes the execution.
- Loop-block resume works across a worker restart simulated by `pm2 restart sabflow-worker`.
- Expression `{{$node["HTTP Request"].$json.data[0].id}}` autocompletes from the upstream HTTP block's pinned payload.

**Risks.**

- Webhook-resume needs an unauthenticated public URL bound to a one-time token. Mitigation: tokens are 32-byte random, single-use, scoped to the execution id, and expire after the wait window.

**Telemetry.**

- `sabflow.builder.subworkflow_created`, `sabflow.exec.error_routed`, `sabflow.exec.retry_attempted`, `sabflow.exec.wait_suspended`, `sabflow.exec.wait_resumed`.

### Phase 3 — Triggers parity (1 week)

**Goal.** SabFlow ships every trigger n8n supports, with parity-grade configuration UX.

**Sub-phases.**

- **3.1 Webhook trigger (days 1–2)**. Path: workspace-scoped slug, with a generated random suffix to make the URL unguessable. Methods: GET, POST, PUT, PATCH, DELETE. Body parsing: JSON, form, multipart, raw. Response builder: status, headers, body — either static, an expression against the rest of the flow, or "wait for response" so the rest of the flow can shape the response synchronously.
- **3.2 Manual trigger (day 3)**. "Run with test data" button in the builder pins a JSON payload as the trigger output and runs the flow. The pinned payload is persisted on the flow document so the next builder open keeps it.
- **3.3 Poll trigger (day 4)**. Generic helper for blocks that need to poll for new items. Block declares a "fetch" function returning a list and a "deduplicate" key. Trigger machinery records last-seen keys per flow, runs on cron, emits only new items.
- **3.4 Error trigger (day 5)**. Workspace-level flow that fires when any other flow in the workspace fails. Receives the error envelope + the failed execution id. Useful for centralised pagerduty/slack notifications.

**Deliverables.**

- `src/lib/sabflow/triggers/webhook.ts` — the dispatcher route `/api/sabflow/triggers/webhook/[slug]/route.ts`.
- `src/lib/sabflow/triggers/manual.ts`.
- `src/lib/sabflow/triggers/poll.ts`.
- `src/lib/sabflow/triggers/error.ts` (workspace-error fan-out).
- Inspector forms for each.

**Acceptance.**

- A webhook flow round-trips: external curl to the SabFlow URL fires the flow, response builder returns the chosen status + body.
- A poll trigger fires once per new upstream item, never twice, across worker restarts.
- An intentionally-broken flow in a workspace causes the workspace's error-trigger flow to fire once with the right error envelope.

**Risks.**

- Webhook URLs may leak in logs. Mitigation: SabNode log scrubbing already redacts URLs by pattern; add `sabflow/triggers/webhook` to the redaction list.

**Telemetry.**

- `sabflow.trigger.webhook.received`, `sabflow.trigger.poll.tick`, `sabflow.trigger.poll.new_items`, `sabflow.trigger.error.fired`.

### Phase 4 — Code, Function, and Python nodes (1 week)

**Goal.** SabFlow runs user-authored JavaScript and Python safely.

**Sub-phases.**

- **4.1 Sandbox audit (day 1)**. Audit `src/lib/sabflow/execution/sandbox/serverSandbox.ts` against a list of escape vectors: process/global access, `require` injection, prototype pollution, `Function`-constructor, timers, async-leak, fetch unrestricted, file access. Document each vector + the mitigation. File: `plan/SANDBOX_THREAT_MODEL.md`.
- **4.2 Sandbox hardening (days 2–3)**. Close every documented vector. Hard caps: 30s wall-clock, 128 MB heap, 0 network unless an `$http` helper is explicitly requested and the workspace allows it. Allow-list of built-in modules: none by default; explicitly-permitted set includes `lodash`, `date-fns`, `mathjs`. Error reporting captures stack lines pointing at the user's code, not the sandbox plumbing.
- **4.3 Helper globals (day 4)**. `$json`, `$node["..."]`, `$input.all()`, `$input.first()`, `$workflow`, `$now`, `$itemIndex`, `$env` (only whitelisted env vars). `$helpers.dateFormat`, `$helpers.uuid`, `$helpers.hash`. Helper API matches n8n's so flows imported from n8n run unchanged. Document in `docs/sabflow/nodes/sabflow-code.mdx`.
- **4.4 Python node (day 5)**. New block `sabflow-python`. Runs untrusted Python in a separate OS process under the SabFlow sandbox service. Same global helper names exposed via a Python shim module `sabflow`. Heap and wall-clock caps mirror the JS node. Output is JSON-serialisable Python data structures.

**Deliverables.**

- `plan/SANDBOX_THREAT_MODEL.md`.
- Hardened `src/lib/sabflow/execution/sandbox/**`.
- New block `src/lib/sabflow/forge/blocks/generic/sabflow-python.ts`.
- Helper-globals reference: `docs/sabflow/nodes/sabflow-code.mdx`, `docs/sabflow/nodes/sabflow-python.mdx`.
- Monaco editor wired to syntax-highlight + lint user code inside the inspector.

**Acceptance.**

- A 100-iteration loop that allocates 1 GB inside the JS sandbox is killed at 128 MB with a clear timeout error surfaced to the user.
- An infinite loop is killed at 30 s with a wall-clock timeout error.
- A flow imported from n8n whose Code node uses `$node["HTTP Request"].json.data[0].id` resolves identically in SabFlow.
- A Python node multiplies two numbers and returns an integer cleanly.

**Risks.**

- Sandbox escapes are an arms race. Mitigation: every reported escape gets a regression test in `src/lib/sabflow/execution/sandbox/__tests__/escapes.test.ts` so we never re-open a closed vector.

**Telemetry.**

- `sabflow.sandbox.timeout`, `sabflow.sandbox.oom`, `sabflow.sandbox.disallowed_require`, `sabflow.sandbox.user_error`.

### Phase 5 — AI Agent nodes (3 weeks)

**Goal.** SabFlow supports LangChain-style agents, tools, memory, and retrievers in parity with n8n's AI nodes.

**Sub-phases.**

- **5.1 AI provider router (week 1, days 1–2)**. Consolidate the existing `integrations/{openAi,anthropicAi,mistral,togetherAi}.ts` into a single SabFlow router with a uniform interface: `runChat({ model, messages, tools?, stream? })`, `runEmbedding({ model, input })`, `runImage({ model, prompt })`. The router resolves the model string (`provider/model`) to a credential and an HTTP call. New providers slot in by adding a small adapter.
- **5.2 Chain / Agent blocks (week 1, days 3–5)**. Wire up the existing `forge/blocks/n8n/langchain_*` directories. Chain kinds: `llm_chain`, `qa_chain`, `summarisation_chain`, `extraction_chain`. Agent kinds: `tool-calling-agent`, `react-agent`, `plan-and-execute-agent`. Each agent block accepts a list of tools, a memory binding, and an optional retriever binding.
- **5.3 Tools (week 2)**. Every existing forge block can be exposed as a tool by toggling a "Use as tool" switch in its inspector. The block's input Zod schema becomes the tool's JSON schema; the block's output becomes the tool's return value. Tool resolution happens inside the agent block's executor.
- **5.4 Memory (week 2)**. Three memory backends: `mongo-conversation` (default, scoped to a session id), `redis-session`, `vector-summary` (compresses history into a vector store as it grows). Memory binding is a separate block in the agent's edge graph.
- **5.5 Retrievers + vector stores (week 3)**. Existing `langchain_retrievers` blocks for: pinecone, weaviate, pgvector, chroma, qdrant, mongodb-atlas-vector. Document loaders: pdf, docx, html, csv, sabfile (read any SabFile by id). Splitters: recursive-character, token-aware, markdown-aware.

**Deliverables.**

- `src/lib/sabflow/ai/router.ts`.
- All `forge/blocks/n8n/langchain_*` blocks registered and exposed in the picker under a single "AI" category with sub-categories: Chains, Agents, Tools, Memory, Retrievers, Vector stores, Embeddings, Loaders, Splitters.
- `docs/sabflow/ai-agents.mdx` overview page.

**Acceptance.**

- An agent flow with three tools (Slack post, HTTP request, SabFlow code), a Mongo memory, and a Pinecone retriever runs end-to-end against a recorded fixture.
- The same agent runs against a live OpenAI or Anthropic credential and produces an answer that references the retrieved document.
- An AI block can be marked "tool-only" and disappears from the picker but appears in agent tool lists.

**Risks.**

- AI calls are expensive. Mitigation: every AI block run debits credits via SabNode's meter and short-circuits when the workspace is over-quota.

**Telemetry.**

- `sabflow.ai.chain.<kind>.invoked`, `sabflow.ai.agent.<kind>.tool_call`, `sabflow.ai.retriever.<store>.query`, `sabflow.ai.tokens` with `prompt`, `completion`, `total`.

### Phase 6 — Per-node documentation (4 weeks, fully parallelisable)

**Goal.** Every SabFlow forge block has a dedicated documentation page available both in the marketing site and inside the builder.

**Sub-phases.**

- **6.1 Doc template + generator (week 1)**. Build `tools/sabflow/gen-docs.ts` that reads a block file and emits a starter mdx file with auto-filled Summary, Operations table, Field reference, Limits. The author writes the Auth setup, Examples, and Errors-and-fixes sections by hand.
- **6.2 Builder-embedded doc drawer (week 1)**. ZoruUI drawer that pops out of the inspector when the user clicks "?". Renders mdx for the currently-selected block. Mdx for in-app docs is bundled at build time; no network call.
- **6.3 Doc backfill — high-traffic blocks (week 2)**. The top 50 blocks by anticipated usage: HTTP request, Set, IF, Switch, Code, Wait, Loop, Sub-workflow, Google Sheets, Slack, OpenAI Chat, Anthropic Chat, Webhook trigger, Cron trigger, Manual trigger, Error trigger, Postgres, MySQL, MongoDB, Redis, AWS S3, SabFiles, Email send, SMTP, HubSpot, Salesforce, Stripe, Notion, Linear, GitHub, GitLab, Asana, Trello, ClickUp, Monday, Airtable, Calendly, Zoom, Twilio, Discord, Telegram, WhatsApp via SabWa, plus the 10 AI Agent / Chain blocks.
- **6.4 Doc backfill — long tail (weeks 3–4)**. Every remaining forge block gets a doc page. Parallelisable across many writers since each block is independent.
- **6.5 Cross-references and tutorials (week 4)**. Each doc page links to a "see also" list. Five end-to-end tutorial flows are published to the SabFlow marketplace and the doc site, each one demonstrating a real use case: "Daily standup digest", "Lead-form to CRM with enrichment", "Stripe customer to email sequence", "Support ticket triage with AI", "RSS to summarised newsletter".

**Deliverables.**

- `tools/sabflow/gen-docs.ts`.
- `docs/sabflow/nodes/<block-id>.mdx` — one per block.
- `docs/sabflow/tutorials/<slug>.mdx` — five tutorials.
- `src/components/sabflow/inspector/DocsDrawer.tsx`.

**Acceptance.**

- Every block in the Phase 0 ledger has a doc page > 200 words with at least one example.
- The in-app docs drawer renders correctly for 100 random blocks.
- The five tutorials each have a corresponding installable marketplace template.

**Risks.**

- Doc rot — code changes, doc lags. Mitigation: a check in CI fails the build if a block's input Zod schema field set diverges from the field reference in its mdx (auto-generated sections are regenerated; hand-written sections raise a warning only).

**Telemetry.**

- `sabflow.docs.drawer.opened` with `blockId`.
- `sabflow.docs.page.viewed` with `blockId` (on the marketing site).

### Phase 7 — Typebot conversational blocks + SabFlow bot widget (4 weeks)

**Goal.** SabFlow can host conversational bot flows on third-party sites with parity-grade Typebot features.

**Sub-phases.**

- **7.1 Conversational block catalogue (week 1)**. Build out `forge/blocks/typebot/`:
  - Bubbles: `text-bubble`, `image-bubble`, `video-bubble`, `embed-bubble`, `audio-bubble`, `file-bubble` (SabFiles only).
  - Inputs: `text-input`, `number-input`, `email-input`, `url-input`, `date-input`, `time-input`, `phone-input`, `choice-input`, `picture-choice-input`, `rating-input`, `payment-input`, `file-upload-input` (SabFiles destination).
  - Logic: `condition`, `set-variable`, `redirect`, `jump`, `end`.
  Every block follows §3.1 forge conventions.
- **7.2 Theme document (week 2, days 1–2)**. A SabFlow flow may carry a `theme` document: `{ fontFamily, accentColor, backgroundColor, textColor, buttonRadius, avatarSabFileId, position, language }`. Inspector exposes a Theme tab on the flow root. Theme is honoured by the widget runtime.
- **7.3 Widget runtime (week 2, days 3–5, and week 3, days 1–3)**. Build `widget/` package that compiles to a single ESM bundle served from the SabFlow domain. Modes: `bubble` (chat bubble bottom-right that opens a popup), `popup` (full-screen modal), `container` (mounts into a host element), `standalone` (renders a full page). API: `<script src="https://app.sabnode.example/widget/sabflow.js"></script>` followed by `SabFlow.init({ flowId, mode, container?, theme? })`. Events: `start`, `complete`, `dropoff`, `messageSent`, `messageReceived` posted via `postMessage` and exposed via `SabFlow.on('event', handler)`.
- **7.4 Live preview pane (week 3, days 4–5)**. Right-side panel in the SabFlow editor that mirrors the widget runtime against the current flow draft. Changes in the canvas reflect after a 500 ms debounce. Preview persists state across builder reloads.
- **7.5 Conversational analytics (week 4, days 1–3)**. Per-block reach count + completion-funnel chart on the executions page. Drop-off heatmap overlaid on the canvas as a colour gradient — red blocks lose the most users.
- **7.6 Typebot importer hardening (week 4, days 4–5)**. Audit `/api/sabflow/import-typebot/route.ts` against the Typebot v3 JSON schema. Every Typebot block type maps to a SabFlow block. Imported flows survive an export-import round-trip without diffing. Add a test fixture per Typebot block type.

**Deliverables.**

- 22 new forge blocks under `src/lib/sabflow/forge/blocks/typebot/` (plus the existing 5).
- `widget/` package, served at `/widget/sabflow.js` and `/widget/sabflow.css`.
- `src/components/sabflow/editor/ThemePanel.tsx`.
- `src/components/sabflow/editor/PreviewPane.tsx`.
- `src/components/sabflow/executions/Funnel.tsx`.
- `src/components/sabflow/editor/CanvasHeatmap.tsx`.
- Typebot v3 importer with fixture-backed tests.

**Acceptance.**

- A bot built in the SabFlow editor and embedded with `<script>` snippet on an external test page runs in all four modes.
- Importing a real Typebot flow JSON produces a SabFlow flow that runs identically.
- The preview pane mirrors a flow edit within 500 ms.
- The funnel chart shows the right drop-off for a flow run 100 times with synthetic users.

**Risks.**

- The widget needs to coexist with arbitrary host-page CSS. Mitigation: the widget renders inside a shadow DOM and ships its own minimal reset.

**Telemetry.**

- `sabflow.widget.init` with `mode`, `flowId`.
- `sabflow.widget.event` with `event` (`start`/`complete`/`dropoff`/`messageSent`/`messageReceived`).
- `sabflow.builder.theme_edited`.

### Phase 8 — Executions, replay, debug (2 weeks)

**Goal.** SabFlow users can introspect, retry, and debug any execution with parity-grade tooling.

**Sub-phases.**

- **8.1 Executions list (week 1, days 1–2)**. Already exists — verify it shows: id, flow name, trigger source, status, start, finish, duration, credits used. Filters: flow, status, time range, has-error, by trigger source. Server-paginated.
- **8.2 Per-execution timeline (week 1, days 3–5)**. Tree view of node runs with status icons. Click a node run → drawer with input JSON, output JSON, error JSON if any, retry attempts, and a "copy as fixture" button.
- **8.3 Retry-from-here (week 2, days 1–2)**. From any node run, a button "Retry from here" creates a new execution that imports the upstream nodes' outputs from the original execution and starts running from the chosen node.
- **8.4 Partial run (week 2, day 3)**. From the builder, the user can right-click a node and "Run from here" using pinned test data — useful while debugging.
- **8.5 Step replay (week 2, days 4–5)**. Wire the existing `components/sabflow/playback` shells to every block. Replay walks the timeline at 0.5x / 1x / 2x speed, highlighting the active node on the canvas and surfacing its input/output.

**Deliverables.**

- `src/app/dashboard/sabflow/executions/page.tsx` (verified, polished).
- `src/app/dashboard/sabflow/executions/[executionId]/page.tsx`.
- `src/components/sabflow/executions/TimelineTree.tsx`.
- `src/components/sabflow/playback/Player.tsx` (wired).
- New API: `POST /api/sabflow/executions/[id]/retry?fromNode=<nodeId>`.

**Acceptance.**

- A failed execution can be retried from the failing node in under 3 clicks.
- Step replay walks a 30-node flow without dropping frames at 1x speed.
- Filters round-trip via URL params (deep-linkable).

**Risks.**

- Large execution payloads (>1 MB per node) can blow up the timeline UI. Mitigation: payloads >256 KB are truncated in the timeline drawer with a "download full payload" link.

**Telemetry.**

- `sabflow.executions.retry`, `sabflow.executions.replay.opened`, `sabflow.executions.payload_truncated`.

### Phase 9 — Marketplace + sharing (1 week)

**Goal.** Workspaces can publish, install, and version SabFlow flows.

**Sub-phases.**

- **9.1 Install round-trip (days 1–2)**. Verify `src/lib/sabflow/marketplace/install.ts` clones a marketplace flow into the target workspace as an editable copy.
- **9.2 Publish (day 3)**. "Publish to marketplace" button on every flow (workspace-permission-gated). Bumps the marketplace version on re-publish. Stores a denormalised snapshot — published flows are independent of their source flow's later edits.
- **9.3 Taxonomy + search (day 4)**. Tags: by category (CRM, marketing, email, ai, conversational, etc.), by complexity, by required credentials. Search by tag, name, description.
- **9.4 Featured + curation (day 5)**. SabFlow admins can feature templates. Featured list rendered on the marketplace home.

**Deliverables.**

- `src/app/dashboard/sabflow/marketplace/page.tsx` (verified).
- `src/app/dashboard/sabflow/marketplace/[templateId]/page.tsx`.
- `POST /api/sabflow/marketplace/publish`.
- `POST /api/sabflow/marketplace/install`.
- Tag taxonomy seeded in Mongo.

**Acceptance.**

- A workspace publishes a flow; a second workspace installs it; both run independently.
- Republishing the flow bumps the version; older installs continue to work; new installs get the new version.

**Risks.**

- Credential references in shared flows. Mitigation: published flows store credential placeholders, not credential ids. Install prompts the user to bind their own credentials.

**Telemetry.**

- `sabflow.marketplace.published`, `sabflow.marketplace.installed`, `sabflow.marketplace.searched`.

### Phase 10 — SabFlow self-host runbook (1 week)

**Goal.** A new operator can stand up SabFlow against Mongo + Redis with a single command.

**Sub-phases.**

- **10.1 docker-compose stack (days 1–2)**. `deploy/sabflow/docker-compose.yml` brings up: SabNode app, SabFlow worker, sabwa-node, Mongo, Redis, MinIO (for SabFiles object store).
- **10.2 Environment setup script (day 3)**. `deploy/sabflow/setup.sh` generates the secrets the stack needs (JWT, AUTH_STATE_KEY, encryption keys), drops them into a `.env` file, prints the URL.
- **10.3 Worker scaling notes (day 4)**. `deploy/sabflow/scaling.md`: how to add more SabFlow workers, how to scale Mongo, how to scale Redis, when to shard.
- **10.4 Backup + restore (day 5)**. `deploy/sabflow/backup.sh` and `deploy/sabflow/restore.sh` — Mongo dumps, Redis snapshots, MinIO bucket sync.

**Deliverables.**

- `deploy/sabflow/docker-compose.yml`.
- `deploy/sabflow/setup.sh`.
- `deploy/sabflow/backup.sh`.
- `deploy/sabflow/restore.sh`.
- `deploy/sabflow/scaling.md`.
- `docs/sabflow/self-host.mdx` walkthrough.

**Acceptance.**

- A fresh Ubuntu VM with Docker installed reaches a working SabFlow login in under 15 minutes following the docs.
- Backup and restore on the same machine round-trips a 1 GB Mongo dataset.

**Risks.**

- Self-host operators may forget to rotate secrets. Mitigation: `setup.sh` prints a rotation reminder and stamps the secret-generation date into a file.

**Telemetry.**

- N/A (self-host operators can opt into anonymous heartbeat via `SABFLOW_TELEMETRY=on`).

### Phase 11 — QA + polish (3 weeks)

**Goal.** Every shipped surface is tested, accessible, and performance-budgeted.

**Sub-phases.**

- **11.1 Block E2E matrix (week 1)**. Playwright test per high-traffic block (top 50) that drives the SabFlow builder, drops the block, configures it, runs, asserts the result against a recorded fixture. Long-tail blocks get smoke tests only.
- **11.2 Widget cross-browser (week 2, days 1–2)**. Widget runs in Chrome, Safari, Firefox, Edge against three host-page CSS profiles (Tailwind reset, Bootstrap reset, WordPress default theme). Pass = no visual regression beyond a 1% pixel diff.
- **11.3 Accessibility audit (week 2, days 3–5)**. Builder, executions, marketplace, widget pass axe-core + a manual keyboard-only walkthrough. Targets: WCAG 2.2 AA.
- **11.4 Load test (week 3, days 1–3)**. 1000 concurrent executions through the SabFlow queue. Worker pool autoscales (manually for now) and the queue does not exceed 30 s p99 latency.
- **11.5 Polish backlog (week 3, days 4–5)**. Empty-state copy review, error-message review, loading-state review across every SabFlow surface. ZoruUI compliance audit — no rogue Radix or Bootstrap imports.

**Deliverables.**

- `tests/sabflow/builder.spec.ts`, `tests/sabflow/widget.spec.ts`, `tests/sabflow/executions.spec.ts`.
- `tests/sabflow/load/run.ts` and an artifact report `tests/sabflow/load/REPORT.md`.
- Accessibility findings + fixes referenced by GitHub-issue links.

**Acceptance.**

- Top 50 blocks pass E2E.
- Widget visual diff under 1% across three host-page profiles.
- Builder + executions + marketplace + widget all score axe-core "no violations".
- Load test reports p50, p95, p99 with the queue at 1000 concurrent.

**Risks.**

- Playwright maintenance churn. Mitigation: every block test is a thin wrapper over a shared `runBlock(blockId, ops, inputs)` helper; the helper changes once when the framework moves.

**Telemetry.**

- N/A (tests run in CI).

---

## 6. Cross-cutting concerns

### 6.1 Security

- Every block that talks to a third-party API does so through SabFlow's `apiRequest` helper which (a) enforces TLS, (b) honours per-workspace egress allowlists when configured, (c) records the outbound URL host (not path or query) into the audit log, (d) redacts credentials from any logged response.
- Sandbox-escape regression tests are mandatory.
- OAuth state nonces are 24-byte random, single-use, 10-minute TTL, bound to the originating workspace + provider. Already implemented in `src/lib/sabflow/oauth/stateStore.ts`; Phase 5+ work must not weaken this.
- Webhook trigger paths include a random suffix that is unguessable; the user-facing slug is for readability only and not load-bearing for security.

### 6.2 Performance

- Builder canvas: render 200-node flows at 60 fps. Use canvas virtualisation past 50 visible nodes.
- Executor: cold-start under 200 ms; per-node overhead under 5 ms beyond the upstream API's own latency.
- Widget bundle: under 60 KB gzipped including the JS runtime and the default theme CSS.
- Mongo queries on the executions page are paginated server-side at 50 rows.

### 6.3 Observability

- Every execution has a trace id propagated through every block call. Trace id is surfaced in the executions UI and in logs.
- SabFlow worker emits a heartbeat metric `sabflow.worker.heartbeat` every 30 s with `pid`, `inFlight`, `queueDepth`.
- AI usage tokens are emitted under `sabflow.ai.tokens` and rolled up nightly into a workspace-level usage report.

### 6.4 Internationalisation

- Every user-visible string in the SabFlow surface uses the existing `useT` hook from `src/lib/i18n`. Hard-coded English strings are not allowed in new PRs.
- The widget supports `theme.language` and falls back to host-page `<html lang>` when unset.
- Doc pages live under `docs/sabflow/` with one canonical English source; translation follows after Phase 11.

### 6.5 Accessibility

- ZoruUI components are accessible by default. New custom components ship with `aria-*` attributes and keyboard navigation. Builder canvas supports keyboard node selection (`Tab`/`Shift+Tab`) and connection (`Enter` on a port, navigate to target port, `Enter` again).
- Widget supports screen-readers — every conversational bubble has `aria-live="polite"`; every input is labelled.

### 6.6 Credit metering

- Block-execution debits credits via SabNode's existing meter through `recordCreditDebit(workspaceId, kind, amount)`. Kinds include `sabflow.block.run`, `sabflow.ai.tokens`, `sabflow.outbound.http`.
- A workspace at zero credits cannot start a new execution. In-flight executions complete to a clean stopping point and surface the credit-exhausted error.

---

## 7. Migration plan from current state

The codebase already runs SabFlow in production for early workspaces. This plan must not break those workspaces.

### 7.1 Schema migrations

- Each Mongo migration lives under `src/lib/sabflow/migrations/<NN>-<slug>.ts` (the dir already exists). Migrations are idempotent and run on app boot under a lock.
- New collections introduced by this plan: `node_run_records` (Phase 1.6), `sabflow_marketplace_versions` (Phase 9), `sabflow_themes` (Phase 7).
- Field additions never remove or rename existing fields without an aliasing read-fallback for at least one minor version.

### 7.2 Backwards-compatibility for existing flows

- Existing flows continue to run unchanged through Phase 1's executor refactor. The refactor introduces uniformity at the registry layer; flow-document shapes are not touched.
- Phase 2's error-port addition is opt-in; flows that do not connect `onError` keep their existing error semantics.
- Phase 7 introduces conversational blocks but does not alter the workflow-block schema.

### 7.3 Feature flags

- Every phase ships behind a workspace-level feature flag. Flags live in `src/lib/sabflow/featureFlags.ts`. Defaults are off on existing workspaces; on for new workspaces and the SabNode reference workspace.
- Flags:
  - `sabflow.subworkflows.enabled` — Phase 2.1
  - `sabflow.error_branches.enabled` — Phase 2.2
  - `sabflow.python_node.enabled` — Phase 4.4
  - `sabflow.ai_agents.enabled` — Phase 5
  - `sabflow.typebot_widget.enabled` — Phase 7
  - `sabflow.marketplace_publish.enabled` — Phase 9
- Flags are removed once the phase has been GA for one quarter without incident.

### 7.4 Auto-commit-pollution clean-up

- Earlier work on this branch had legitimate SabFlow changes (batches 2 and 3) auto-committed by the IDE inside unrelated "Refactor payroll" / "Refactor HRM" commits. We do not rewrite shared history. Instead, the SabFlow CHANGELOG appendix below explicitly attributes those changes to the correct batch.

---

## 8. Versioning strategy

- SabFlow inside SabNode follows semver-on-features. Each phase landing equals a minor release (1.X.0). Patch releases (1.X.Y) ship bug fixes and small block additions.
- Forge-block versioning is independent: every block's `version` field bumps on a breaking change to its inputs or outputs. Old flows pin to the version they were authored against; the runtime upgrades them lazily during edit.
- Imported flows from n8n include a `n8nSourceVersion` field so we can replay the import if the importer changes.
- The widget is versioned independently and served from `/widget/sabflow.v<N>.js`. The latest tag aliases to the most recent stable. Embeddings pin to a major.

---

## 9. Risk register

| ID | Risk | Probability | Impact | Mitigation |
|---|---|:---:|:---:|---|
| R1 | Sandbox escape | low | catastrophic | Threat model + regression tests in Phase 4.1–4.2. Every CVE-class finding files a new regression test before the fix lands. |
| R2 | Widget crashes host page | medium | high | Shadow DOM + iframe fallback for hostile-CSS environments. Cross-browser test in Phase 11.2. |
| R3 | Mongo executions collection grows unbounded | high | medium | 30-day default retention, configurable per workspace. Nightly compaction. |
| R4 | AI provider outage cascades into builder | medium | medium | AI router falls back across providers; if all configured providers fail, the block surfaces a clear "AI unavailable" error and routes via `onError` if connected. |
| R5 | Block schema and runtime drift | medium | medium | Phase 1.5's parse-on-the-way-in machinery makes the registry the authority; Phase 11 E2E tests catch regressions. |
| R6 | Importer for n8n / Typebot misses edge cases | medium | low | Fixture-backed tests per block type; importer logs a warning per unmapped field and surfaces them to the user post-import. |
| R7 | Doc rot | high | low | CI lint that diffs block schema vs doc; auto-regenerates the auto-sections. |
| R8 | Webhook URL leak | low | medium | Random suffix + log scrubbing + URL rotation on user request. |
| R9 | Marketplace published flow contains secrets | low | high | Publish path strips credential ids and replaces with placeholder. CI test asserts no `credential_id` keys in published payloads. |
| R10 | Long-running worker stuck on hung HTTP call | medium | medium | Every outbound HTTP has a 30 s default timeout, overridable per node. Worker watchdog kills the worker after 5 min wall-clock per single block execution. |

---

## 10. Effort summary

| Phase | Eng-weeks | Notes |
|---|---:|---|
| 0. Inventory ledger | 1 | Sequential prerequisite |
| 1. Block wire-up + discovery | 3 | Sequential prerequisite |
| 2. Builder UX gaps | 3 | Parallel after Phase 1 |
| 3. Triggers parity | 1 | Parallel after Phase 1 |
| 4. Code/Function/Python | 1 | Parallel after Phase 1 |
| 5. AI Agent nodes | 3 | Parallel after Phase 1 |
| 6. Per-node docs | 4 | Parallel after Phase 1 (writer-heavy) |
| 7. Typebot blocks + widget | 4 | Parallel after Phase 1 |
| 8. Executions, replay, debug | 2 | Sequential after Phases 2, 5 (uses their data shapes) |
| 9. Marketplace + sharing | 1 | Sequential after Phase 1 |
| 10. SabFlow self-host runbook | 1 | Parallel after Phase 8 |
| 11. QA + polish | 3 | Sequential — last |
| **Total** | **27** | |

Single senior engineer working linearly: ~6.5 calendar months.
Team of three with the dep graph followed: ~3 calendar months.
Team of six maxing parallelism after Phase 1: ~2 calendar months.

---

## 11. Critical dependency graph

```
   ┌────────────────────┐
   │ 0. Audit / ledger  │
   └─────────┬──────────┘
             │
             ▼
   ┌────────────────────┐
   │ 1. Wire-up + UI    │
   └────────┬───────────┘
            │
   ┌────────┼────────┬────────────┬────────────┬───────────────┐
   ▼        ▼        ▼            ▼            ▼               ▼
┌─────┐ ┌─────┐ ┌─────────┐ ┌──────────┐ ┌──────────────┐ ┌─────────┐
│ 2.  │ │ 3.  │ │ 4. Code │ │ 5. AI    │ │ 6. Per-node  │ │ 7.      │
│ UX  │ │ Trg │ │ + Python│ │ Agents   │ │ docs (heavy) │ │ Typebot │
└──┬──┘ └─────┘ └─────────┘ └────┬─────┘ └──────────────┘ └────┬────┘
   │                              │                            │
   └──────────────┬───────────────┘                            │
                  ▼                                            │
            ┌──────────────────────┐                           │
            │ 8. Executions/replay │ ◄─────────────────────────┘
            └──────────┬───────────┘
                       ▼
                ┌────────────────┐
                │ 9. Marketplace │
                └──────┬─────────┘
                       ▼
              ┌──────────────────┐
              │ 10. Self-host doc│
              └──────┬───────────┘
                     ▼
                ┌────────────┐
                │ 11. QA     │
                └────────────┘
```

---

## 12. Fastest credible v1 milestone

If the SabFlow team needs a shippable "n8n + Typebot grade" v1 before the full long tail, ship this slice and call it `SabFlow v1.0`:

1. Phase 0 — audit ledger — 1 wk.
2. Phase 1 — wire-up + discovery — 3 wks.
3. Phase 2.1 — sub-workflows — 1 wk.
4. Phase 2.2 — error branches — 0.5 wk.
5. Phase 2.3 — retry policy — 1 wk.
6. Phase 4.1–4.3 — sandboxed JS code node — 1 wk.
7. Phase 7.1 — conversational block catalogue — 1 wk.
8. Phase 7.3 — widget runtime, popup + bubble modes only — 1.5 wks.

Total: **~9 eng-weeks** to a credible parity v1.

Everything after that is breadth (more blocks), depth (Python, AI agents, advanced retrievers), polish (analytics, theme tweaks), and docs.

---

## 13. Open decisions

The plan cannot make these calls; the SabFlow team must.

1. **Team size and timeline target.** One engineer for six months, or a team of three for three months, or a team of six for two months? Drives sequencing.
2. **Code-sandbox boundary.** Stay with the current `node:vm`-based SabFlow sandbox, or invest in a dedicated process-level sandbox (separate OS process per execution) for stronger isolation guarantees? The latter is roughly +1 eng-week.
3. **Doc generation strategy.** Hand-write every block doc (slowest, highest quality), generate skeletons from descriptors (fastest, uneven quality), or hybrid with auto-generated reference + hand-written examples (recommended)?
4. **Widget hosting.** Co-deploy `widget/sabflow.js` from the SabNode Next.js bundle, or extract it into a separate small Node service to keep host-page request budgets predictable? Recommendation: co-deploy until traffic warrants the split.
5. **n8n source-of-truth.** Pin to a specific n8n release for the parity check (e.g. n8n 1.65) or chase the moving target? Recommendation: pin per minor release; refresh quarterly.
6. **History clean-up.** Live with the existing auto-commit pollution in `main` history, or rewrite history on a long-lived `sabflow/parity-rewrite` branch before more parallel-agent work lands? Recommendation: live with it — `git log --grep=sabflow` reads correctly even if some commits have unrelated titles.

---

## 14. Appendix A — Acceptance criteria checklist (cumulative)

A copy of every phase's acceptance criteria in a single checklist for tracking in a project board.

- [ ] 0.1 Audit tool exists and is committed.
- [ ] 0.2 Ledger regenerates deterministically.
- [ ] 0.3 Random-sample verification of 20 blocks passes.
- [ ] 1.1 Registry uniformity assertion passes at startup.
- [ ] 1.2 Inspector form is fully schema-generated.
- [ ] 1.3 Builder node picker shows every block.
- [ ] 1.4 Builder keyboard shortcuts work.
- [ ] 1.5 Executor harness is per-block-id-uniform.
- [ ] 1.6 `node_run_records` collection exists with indexes.
- [ ] 2.1 Nested sub-workflow run completes and shows the tree.
- [ ] 2.2 Error envelope routes through `onError` port.
- [ ] 2.3 Retry policy executes per attempt with backoff.
- [ ] 2.4 Webhook-resume wait round-trips.
- [ ] 2.5 Loop block resumes across worker restart.
- [ ] 2.6 Expression editor autocompletes upstream node outputs.
- [ ] 2.7 Pinned test input survives builder reload.
- [ ] 3.1 Webhook trigger round-trips with response builder.
- [ ] 3.2 Manual trigger persists pinned test data.
- [ ] 3.3 Poll trigger deduplicates across worker restarts.
- [ ] 3.4 Workspace error trigger fires on flow failure.
- [ ] 4.1 Sandbox threat model is documented.
- [ ] 4.2 Sandbox kills infinite loop at wall-clock limit.
- [ ] 4.3 Helper globals match n8n's exactly (verified by fixture).
- [ ] 4.4 Python node executes hello-world and returns JSON.
- [ ] 5.1 AI provider router resolves `openai/gpt-x` and `anthropic/claude-x` correctly.
- [ ] 5.2 Chain block runs a simple QA chain against a fixture.
- [ ] 5.3 Tool-use exposes a forge block as a tool inside an agent.
- [ ] 5.4 Mongo conversation memory persists across runs.
- [ ] 5.5 Pinecone retriever returns the seeded document.
- [ ] 6.1 Doc generator emits valid mdx for any block.
- [ ] 6.2 In-app docs drawer renders mdx for the selected block.
- [ ] 6.3 Top-50 block docs are hand-completed.
- [ ] 6.4 Every long-tail block has at least an auto-generated doc.
- [ ] 6.5 Five marketplace tutorials are published.
- [ ] 7.1 All conversational blocks render in the builder.
- [ ] 7.2 Theme document round-trips through the inspector and the widget.
- [ ] 7.3 Widget loads on a Tailwind, a Bootstrap, and a vanilla host page.
- [ ] 7.4 Preview pane mirrors builder edits under 500 ms.
- [ ] 7.5 Drop-off heatmap matches synthetic-user counts.
- [ ] 7.6 Typebot v3 import round-trip diffs cleanly.
- [ ] 8.1 Executions list filters round-trip via URL.
- [ ] 8.2 Per-execution timeline renders for a 30-node flow.
- [ ] 8.3 Retry-from-here completes the failed branch only.
- [ ] 8.4 Partial run uses pinned test data correctly.
- [ ] 8.5 Step replay at 1x speed runs without dropped frames.
- [ ] 9.1 Install round-trip clones a marketplace flow.
- [ ] 9.2 Publish strips credential ids.
- [ ] 9.3 Tag-based search returns the right templates.
- [ ] 9.4 Featured list shows admin-curated templates.
- [ ] 10.1 `setup.sh` brings a fresh VM to a login screen.
- [ ] 10.2 Backup/restore round-trips 1 GB.
- [ ] 11.1 Top-50 block E2E passes in CI.
- [ ] 11.2 Widget visual diff under 1% across host profiles.
- [ ] 11.3 Builder + executions + marketplace + widget pass axe-core.
- [ ] 11.4 Load test of 1000 concurrent executions reports p99 under 30 s.
- [ ] 11.5 ZoruUI compliance audit shows no rogue UI imports.

---

## 15. Appendix B — File organisation reference

Where new code goes during this plan.

```
src/lib/sabflow/
├── ai/router.ts                          # Phase 5.1 AI provider router
├── execution/sandbox/                    # Phase 4 — hardened sandbox
├── executor/
│   ├── index.ts                          # Phase 1.5 refactor
│   ├── retry.ts                          # Phase 2.3
│   ├── wait.ts                           # Phase 2.4
│   └── nodes/
│       ├── sabflow-execute-workflow.ts   # Phase 2.1
│       ├── sabflow-error-route.ts        # Phase 2.2
│       ├── sabflow-loop.ts               # Phase 2.5
│       └── ...
├── forge/
│   ├── registry.ts                       # Phase 1.1 consolidation
│   └── blocks/
│       ├── n8n/<category>/<block>.ts     # existing, audited in Phase 0
│       ├── typebot/<block>.ts            # Phase 7.1 buildout
│       └── generic/sabflow-python.ts     # Phase 4.4
├── marketplace/                          # Phase 9 polish
├── migrations/                           # all phases — schema migrations
├── n8n/                                  # existing runtime port — touched only as needed
├── oauth/                                # existing — completed in earlier batches
├── triggers/
│   ├── webhook.ts                        # Phase 3.1
│   ├── manual.ts                         # Phase 3.2
│   ├── poll.ts                           # Phase 3.3
│   └── error.ts                          # Phase 3.4
├── widget/                               # Phase 7.3 widget runtime
└── featureFlags.ts                       # Phase 7.3 onward — cross-cutting flags

src/components/sabflow/
├── editor/
│   ├── ExpressionEditor.tsx              # Phase 2.6
│   ├── PinButton.tsx                     # Phase 2.7
│   ├── NodePicker.tsx                    # Phase 1.3
│   ├── ThemePanel.tsx                    # Phase 7.2
│   └── PreviewPane.tsx                   # Phase 7.4
├── executions/
│   ├── TimelineTree.tsx                  # Phase 8.2
│   └── Funnel.tsx                        # Phase 7.5
├── inspector/
│   ├── SchemaForm.tsx                    # Phase 1.2
│   └── DocsDrawer.tsx                    # Phase 6.2
├── playback/                             # Phase 8.5 wiring
└── chat/                                 # existing — used by widget runtime

src/app/dashboard/sabflow/
├── executions/                           # Phase 8 polish
├── marketplace/                          # Phase 9 polish
└── flow-builder/                         # all phases — host of new components

src/app/api/sabflow/
├── triggers/webhook/[slug]/route.ts      # Phase 3.1
├── executions/[id]/retry/route.ts        # Phase 8.3
├── marketplace/publish/route.ts          # Phase 9.2
└── marketplace/install/route.ts          # Phase 9.1

docs/sabflow/
├── nodes/<block-id>.mdx                  # Phase 6 — one per block
├── tutorials/<slug>.mdx                  # Phase 6.5
├── ai-agents.mdx                         # Phase 5
└── self-host.mdx                         # Phase 10

deploy/sabflow/                           # Phase 10
├── docker-compose.yml
├── setup.sh
├── backup.sh
├── restore.sh
└── scaling.md

tools/sabflow/
├── audit-blocks.ts                       # Phase 0.1
├── audit-blocks.lib.ts
├── audit-blocks.test.ts
└── gen-docs.ts                           # Phase 6.1

tests/sabflow/
├── builder.spec.ts                       # Phase 11
├── widget.spec.ts                        # Phase 11.2
├── executions.spec.ts                    # Phase 11.1
└── load/run.ts                           # Phase 11.4

plan/
├── SABFLOW_PARITY_PLAN.md                # this document
├── SABFLOW_BLOCK_LEDGER.md               # Phase 0 output
└── SANDBOX_THREAT_MODEL.md               # Phase 4.1
```

---

## 16. Appendix C — Telemetry event catalogue

A single registry of every telemetry event SabFlow emits.

| Event | Properties | Surface |
|---|---|---|
| `sabflow.builder.node_added` | blockId, category | builder |
| `sabflow.builder.node_configured` | blockId, operation | builder |
| `sabflow.builder.subworkflow_created` | parentFlowId, childFlowId | builder |
| `sabflow.builder.theme_edited` | flowId, themeField | builder |
| `sabflow.exec.block.<blockId>.<op>` | status, latencyMs, errorCode | executor |
| `sabflow.exec.error_routed` | blockId, errorCode | executor |
| `sabflow.exec.retry_attempted` | blockId, attempt, ok | executor |
| `sabflow.exec.wait_suspended` | mode, durationMs | executor |
| `sabflow.exec.wait_resumed` | mode, suspendedMs | executor |
| `sabflow.sandbox.timeout` | language | sandbox |
| `sabflow.sandbox.oom` | language | sandbox |
| `sabflow.sandbox.disallowed_require` | module | sandbox |
| `sabflow.sandbox.user_error` | language, errorName | sandbox |
| `sabflow.ai.chain.<kind>.invoked` | model, latencyMs | ai |
| `sabflow.ai.agent.<kind>.tool_call` | tool, ok | ai |
| `sabflow.ai.retriever.<store>.query` | store, hits, latencyMs | ai |
| `sabflow.ai.tokens` | provider, model, prompt, completion, total | ai |
| `sabflow.trigger.webhook.received` | slug, method | triggers |
| `sabflow.trigger.poll.tick` | flowId | triggers |
| `sabflow.trigger.poll.new_items` | flowId, count | triggers |
| `sabflow.trigger.error.fired` | failedFlowId, errorCode | triggers |
| `sabflow.docs.drawer.opened` | blockId | builder |
| `sabflow.docs.page.viewed` | blockId | marketing |
| `sabflow.widget.init` | mode, flowId | widget |
| `sabflow.widget.event` | event, flowId | widget |
| `sabflow.executions.retry` | executionId, fromNode | executions |
| `sabflow.executions.replay.opened` | executionId | executions |
| `sabflow.executions.payload_truncated` | sizeBytes | executions |
| `sabflow.marketplace.published` | templateId, version | marketplace |
| `sabflow.marketplace.installed` | templateId, version | marketplace |
| `sabflow.marketplace.searched` | query, resultCount | marketplace |
| `sabflow.worker.heartbeat` | pid, inFlight, queueDepth | worker |

---

## 17. Appendix D — Telemetry catalogue index by phase

For each phase, the events it introduces. Use this when shipping the phase to confirm dashboards exist.

- Phase 1 — `node_added`, `node_configured`, `exec.block.*`.
- Phase 2 — `subworkflow_created`, `error_routed`, `retry_attempted`, `wait_suspended`, `wait_resumed`.
- Phase 3 — `trigger.webhook.received`, `trigger.poll.tick`, `trigger.poll.new_items`, `trigger.error.fired`.
- Phase 4 — `sandbox.timeout`, `sandbox.oom`, `sandbox.disallowed_require`, `sandbox.user_error`.
- Phase 5 — `ai.chain.*`, `ai.agent.*`, `ai.retriever.*`, `ai.tokens`.
- Phase 6 — `docs.drawer.opened`, `docs.page.viewed`.
- Phase 7 — `widget.init`, `widget.event`, `builder.theme_edited`.
- Phase 8 — `executions.retry`, `executions.replay.opened`, `executions.payload_truncated`.
- Phase 9 — `marketplace.published`, `marketplace.installed`, `marketplace.searched`.

---

## 18. Appendix E — Shipping checklist for each new block

A standardised punch list to copy into every block-shipping PR.

- [ ] Block file lives at `src/lib/sabflow/forge/blocks/<category>/<block-id>.ts`.
- [ ] Registers via `registerForgeBlock(...)` with `id`, `label`, `category`, `iconName`, `version`, `defaultLabel`, `requiresSubdomain` (if applicable), `defaultCredentialType` (if applicable).
- [ ] Each operation declares an input Zod schema and an output Zod schema.
- [ ] Errors thrown are `ForgeError` instances with `code`, `httpStatus`, `retryable`, `userMessage`.
- [ ] Sibling `<block-id>.test.ts` exists with at least one fixture-backed test per operation.
- [ ] `docs/sabflow/nodes/<block-id>.mdx` exists with summary, auth, ops, fields, examples, errors, limits.
- [ ] Block appears in the SabFlow builder palette under the correct category.
- [ ] If the block touches user files, it uses SabFiles only — no free-text URL paste.
- [ ] If the block touches AI, it goes through the SabFlow AI provider router, not a direct SDK call.
- [ ] Telemetry event `sabflow.exec.block.<id>.<op>` is emitted automatically by the executor — no manual instrumentation needed.
- [ ] PR title is `feat(sabflow): block — <label>` and references the phase number from this plan.

---

## 19. Appendix F — CHANGELOG attribution for prior auto-commit pollution

For clarity when reading `git log`:

- The OAuth onboarding flow (47 providers, animated stepper dialog, PKCE plumbing, per-tenant subdomain plumbing, Shopify, README, env-example whitelist, and the long preset-retag sweep) all landed in batches 1 through 6 of the work that preceded this plan. Some of those changes appear inside commits with payroll/HRM-flavoured titles because the IDE auto-committed intermediate snapshots. The actual content is correct; the commit-message titles are misleading. Filtering by file path (`git log -- src/lib/sabflow/oauth/`) reads truthfully.

---

## 20. Appendix G — Per-block status legend

The ledger produced by Phase 0 uses a controlled vocabulary. Every block carries one status per axis.

**Runtime status.**

- `stubbed` — the block is registered but its operations throw `not implemented`.
- `wired` — at least one operation calls a real upstream API end-to-end against a fixture.
- `complete` — every documented operation from the parent n8n node has a working SabFlow implementation.
- `enhanced` — beyond parity: the block adds operations or fields not present in the n8n parent.

**UI status.**

- `hidden` — present in the registry but excluded from the builder palette (intentional).
- `palette-only` — visible in the picker, but the inspector form is empty or generic.
- `inspector-ready` — full form generated from the input Zod schema; all field kinds render.
- `polished` — inspector-ready plus block-specific help-text, example payloads, and inline links to the docs drawer.

**Test status.**

- `none` — no test file.
- `smoke` — one fixture-backed test, happy path only.
- `per-op` — one fixture-backed test per operation, happy and one error case each.
- `gold` — per-op plus boundary conditions and at least one live-credential test that runs against a real workspace under a manual trigger.

**Doc status.**

- `none` — no mdx file.
- `auto` — auto-generated reference only, no hand-written examples.
- `hand` — hand-written summary, auth, examples, errors, limits.
- `tutorial-linked` — hand + appears in at least one of the five Phase 6.5 marketplace tutorials.

**Parity status.**

- `n8n-parent: <node path>` — has an upstream n8n equivalent.
- `n8n-parent: none` — native SabFlow block with no n8n peer (e.g. SabFlow-specific blocks like `sabflow-execute-workflow`).
- `typebot-parent: <block kind>` — has an upstream Typebot equivalent.
- `typebot-parent: none` — workflow block, not conversational.

The audit script produces a row per block of the form:

```
| id | category | runtime | ui | test | doc | parity |
|----|----------|---------|----|------|-----|--------|
| azure-storage | microsoft | wired | inspector-ready | smoke | none | n8n-parent: Microsoft/Storage/AzureStorage.node.ts |
```

A block is "shippable" when it is at least `wired` + `inspector-ready` + `per-op` + `auto`. A block is "polished" when it is `complete` + `polished` + `per-op` + `hand`.

The Phase 11 ship gate requires every block to be at least `shippable`. The `polished` bar is a stretch goal for the top 50.

---

## 21. Appendix H — Per-node doc template

Every `docs/sabflow/nodes/<block-id>.mdx` follows this exact structure. The `--- AUTO-GENERATED ---` regions are produced by `tools/sabflow/gen-docs.ts` and are overwritten on regeneration; everything outside those markers is hand-written and preserved.

````mdx
---
title: <Block label>
blockId: <block-id>
category: <category>
sabflowVersion: <plan-version-when-published>
n8nParent: <relative path under n8n-master, or "none">
typebotParent: <typebot block kind, or "none">
---

# <Block label>

import { DocsCallout, OperationsTable, FieldReference, ExampleFlow } from '@/components/sabflow/docs';

## Summary

<!-- HAND-WRITTEN: 80–200 words. What the block does, who it is for, the
single sentence the SabFlow user reads first to decide whether to drop it
on the canvas. -->

## Auth setup

<!-- HAND-WRITTEN: how to obtain the credential, where to register an app
in the upstream service, which redirect URI to use, what scopes to request.
Include a screenshot reference by SabFile id, not a raw URL. -->

<DocsCallout type="note">
SabFlow's connection dialog handles the OAuth dance automatically when this
provider supports OAuth — see the Auth tab of the inspector.
</DocsCallout>

## Operations

<!-- AUTO-GENERATED START: operations -->
<OperationsTable blockId="<block-id>" />
<!-- AUTO-GENERATED END: operations -->

## Field reference

<!-- AUTO-GENERATED START: fields -->
<FieldReference blockId="<block-id>" />
<!-- AUTO-GENERATED END: fields -->

## Examples

### Example 1 — <use case>

<!-- HAND-WRITTEN: 1–2 paragraphs setting up the scenario, then an
<ExampleFlow> reference to a published SabFlow marketplace flow id. -->

<ExampleFlow id="sabflow-example-<block-id>-1" />

### Example 2 — <other use case>

<ExampleFlow id="sabflow-example-<block-id>-2" />

## Errors and fixes

<!-- HAND-WRITTEN: a table of the most common errors users hit. Each row
has the error code (from ForgeError.code), the human cause, and a one-line
fix. Include the rate-limit + auth-revoked + bad-input rows for every
block; add block-specific rows below. -->

| Code | Cause | Fix |
|---|---|---|
| `RATE_LIMITED` | Upstream provider returned 429. | The block's retry policy will back off — increase max attempts or reduce flow throughput. |
| `AUTH_REVOKED` | The connected credential was revoked upstream. | Re-authorise the credential from the SabFlow Connections page. |
| `BAD_INPUT` | A required field is missing or malformed. | Check the inspector's red-underlined field; refer to the field reference above. |

## Limits

<!-- HAND-WRITTEN: rate limits, payload-size caps, regional restrictions,
known incompatibilities. If the block carries no special limits, state
"No SabFlow-specific limits beyond the upstream provider's published quotas." -->

## See also

<!-- HAND-WRITTEN: 3–5 related block ids in the same category or that
commonly chain with this one. -->

- [SabFlow `<related-block-1>`](./<related-block-1>.mdx)
- [SabFlow `<related-block-2>`](./<related-block-2>.mdx)
````

A doc lint check enforces the structure: every doc page must include the seven section headings in this exact order. Missing sections fail CI. The lint also confirms the `<OperationsTable>` and `<FieldReference>` components are present and the regions remain marked, so regeneration stays safe.

---

## 22. Appendix I — Per-phase budget envelope

The numbers in §10 are point estimates. Real planning needs uncertainty bands. The envelope below is what a project manager should use when negotiating timelines.

| Phase | Eng-weeks (point) | Min | Likely | Max | Sensitivity |
|---|---:|---:|---:|---:|---|
| 0. Audit ledger | 1 | 0.5 | 1 | 1.5 | Low — pure tooling |
| 1. Wire-up + UI | 3 | 2 | 3 | 5 | Medium — depends on how clean the registry is today |
| 2. Builder UX gaps | 3 | 2.5 | 3 | 5 | Medium — sub-workflows recursion edge cases |
| 3. Triggers | 1 | 0.75 | 1 | 1.5 | Low |
| 4. Code/Function/Python | 1 | 0.75 | 1 | 2 | Medium — sandbox escapes can blow budget |
| 5. AI Agents | 3 | 2 | 3 | 5 | High — LangChain-style scope creep |
| 6. Per-node docs | 4 | 3 | 4 | 6 | Medium — writer availability |
| 7. Typebot + widget | 4 | 3 | 4 | 6 | Medium — host-CSS cross-browser issues |
| 8. Executions / replay | 2 | 1.5 | 2 | 3 | Low |
| 9. Marketplace | 1 | 0.75 | 1 | 1.5 | Low |
| 10. Self-host runbook | 1 | 0.5 | 1 | 2 | Low |
| 11. QA + polish | 3 | 2 | 3 | 5 | High — bug-tail is unpredictable |
| **Totals** | **27** | **19.75** | **27** | **43.5** | |

Plan against the **likely** column. Cut to the **min** column only with explicit scope reductions agreed with the SabFlow team lead. If a phase trends toward **max**, raise it as a risk before exceeding the **likely** estimate by 20%.

---

## 23. Appendix J — Communication and reporting cadence

How the SabFlow team reports progress against this plan.

- **Weekly demo (15 minutes).** Show the phase's most recent acceptance criterion in motion. No slides — only the running SabFlow surface.
- **Bi-weekly written status.** One paragraph per active phase, posted to the SabNode internal channel. Format: `Phase <N> — <status>: <one sentence done>, <one sentence next>, <one sentence risks>`.
- **Phase-end retrospective.** When a phase clears acceptance, ship a short retro inside `plan/RETRO-<phase>.md` covering: what shipped, what slipped, what changed in the plan, what the team learned. Treat retro docs as part of the deliverable.
- **Live ledger.** `plan/SABFLOW_BLOCK_LEDGER.md` is regenerated as part of every PR merge into `main`. The latest snapshot is the single source of truth for "where are we".

---

## 24. Appendix K — Mapping table — n8n node → SabFlow forge block (excerpt)

Sample of the mapping table the audit script produces. The full table lives in `plan/SABFLOW_BLOCK_LEDGER.md` after Phase 0; this excerpt is illustrative.

| n8n node (path) | SabFlow block id | Category | Notes |
|---|---|---|---|
| `nodes/Slack/Slack.node.ts` | `slack` | communication | OAuth via SabFlow Slack provider. |
| `nodes/Google/Sheets/v2/GoogleSheetsV2.node.ts` | `google-sheets` | google | OAuth via SabFlow Google provider. |
| `nodes/Microsoft/Outlook/MicrosoftOutlook.node.ts` | `microsoft-outlook` | microsoft | OAuth via SabFlow Microsoft Graph. |
| `nodes/HubSpot/HubSpot.node.ts` | `hubspot` | crm | OAuth via SabFlow HubSpot provider. |
| `nodes/Postgres/Postgres.node.ts` | `postgres` | databases | API-key style credential. |
| `nodes/MongoDb/MongoDb.node.ts` | `mongodb` | databases | API-key style credential. |
| `nodes/HttpRequest/HttpRequest.node.ts` | `http-request` | generic | Wired via SabFlow core. |
| `nodes/Code/Code.node.ts` | `sabflow-code` | generic | SabFlow-sandboxed JS. |
| `nodes/Function/Function.node.ts` | `sabflow-function` | generic | SabFlow-sandboxed JS. |
| `nodes/If/If.node.ts` | `branching` | generic | Wired via SabFlow core. |
| `nodes/Switch/Switch.node.ts` | `switch` | generic | New block in Phase 2.5 if not yet registered. |
| `nodes/Set/Set.node.ts` | `set` | generic | Wired via SabFlow core. |
| `nodes/SplitInBatches/SplitInBatches.node.ts` | `sabflow-loop` | generic | New per Phase 2.5. |
| `nodes/Wait/Wait.node.ts` | `sabflow-wait` | generic | New per Phase 2.4. |
| `nodes/ExecuteWorkflow/ExecuteWorkflow.node.ts` | `sabflow-execute-workflow` | generic | New per Phase 2.1. |
| `nodes/Webhook/Webhook.node.ts` | `webhook-trigger` | triggers | Wired via SabFlow core; UX upgrade in Phase 3.1. |
| `nodes/Cron/Cron.node.ts` | `cron-trigger` | triggers | Wired via SabFlow core. |
| `nodes/ErrorTrigger/ErrorTrigger.node.ts` | `sabflow-error-trigger` | triggers | Extended in Phase 3.4 to be workspace-level. |
| `nodes/LangChain/Agents/ToolCallingAgent.node.ts` | `agent-tool-calling` | ai | Wired per Phase 5.2. |
| `nodes/LangChain/Chains/LlmChain.node.ts` | `chain-llm` | ai | Wired per Phase 5.2. |
| `nodes/LangChain/Memory/MongoMemory.node.ts` | `memory-mongo` | ai | Wired per Phase 5.4. |
| `nodes/LangChain/Retrievers/PineconeRetriever.node.ts` | `retriever-pinecone` | ai | Wired per Phase 5.5. |

Every row of the full table cross-references both directions: an n8n node lookup returns a SabFlow block, and a SabFlow block lookup returns an n8n parent (or "native"). The audit script in Phase 0 maintains the table.

---

## 25. Appendix L — Mapping table — Typebot block → SabFlow forge block

| Typebot block kind | SabFlow block id | Category |
|---|---|---|
| `text-bubble` | `text-bubble` | typebot |
| `image-bubble` | `image-bubble` | typebot |
| `video-bubble` | `video-bubble` | typebot |
| `embed-bubble` | `embed-bubble` | typebot |
| `audio-bubble` | `audio-bubble` | typebot |
| `text-input` | `text-input` | typebot |
| `number-input` | `number-input` | typebot |
| `email-input` | `email-input` | typebot |
| `url-input` | `url-input` | typebot |
| `date-input` | `date-input` | typebot |
| `time-input` | `time-input` | typebot |
| `phone-input` | `phone-input` | typebot |
| `choice-input` | `choice-input` | typebot |
| `picture-choice-input` | `picture-choice-input` | typebot |
| `rating-input` | `rating-input` | typebot |
| `payment-input` | `payment-input` | typebot |
| `file-upload-input` | `file-upload-input` | typebot |
| `condition` | `condition` | typebot |
| `set-variable` | `set-variable` | typebot |
| `redirect` | `redirect` | typebot |
| `jump` | `jump` | typebot |
| `end` | `end` | typebot |
| `webhook` | re-uses SabFlow `sabflow-webhook` workflow block | bridge |
| `script` | re-uses SabFlow `sabflow-code` workflow block | bridge |
| `openai` | re-uses SabFlow `agent-tool-calling` or `chain-llm` workflow block | bridge |
| `google-sheets` | re-uses SabFlow `google-sheets` workflow block | bridge |

The bridges matter: SabFlow does not duplicate functionality between the workflow side and the conversational side. A Typebot `webhook` block, when imported, becomes a SabFlow `sabflow-webhook` block invoked inline. This keeps the catalogue lean and the bug surface single-rooted.

---

End of plan.
