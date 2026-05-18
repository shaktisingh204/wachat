# ADR — n8n Executor Survey (basis for SabFlow's Rust executor)

**Status:** Proposed (Track B Phase 1, sub-task 1)
**Date:** 2026-05-18
**Owner:** SabFlow / Track B Phase 1
**Phase branch:** `phase/b-1-foundation`
**Related plan:** `PLAN-sabflow-crdt-collab.md` — Track B Phase 1 §1.
**Sibling ADRs:** `sabflow-executor-rust-bench.md` (Track A §9 / Track B §10), and the nine downstream Track B Phase 1 sub-tasks (node contract, workflow IR, execution-state schema, Rust stack, crate layout, IPC choice, error taxonomy, observability, ADR write-up).

---

## 1. Summary (≤200 words)

n8n runs workflows in one of two modes. **Regular mode** executes in the main Node process — fine for development and small installs, but a single failure or long-running node blocks the API. **Queue mode** moves execution into a separate worker pool fed by a Bull queue on Redis, leaving the main process to handle HTTP, webhooks, and the editor push channel. Both modes share the same `WorkflowExecute` class in `n8n-core`, which exposes four entry points (`runOnce`, `run`, `runPartialWorkflow`, `runManualWorkflow`) and drives the per-node lifecycle: resolve credentials, materialise input items, call the node's `execute()` (or trigger/poll/webhook variant), capture output or route to the error branch when `continueOnFail` is set. Webhooks enter through an Express route, resolve a trigger node, and enqueue (or run inline) a workflow execution. Manual runs from the editor bypass the queue and stream live progress over the push channel. Execution state is persisted as an `execution_entity` row plus a separate `execution_data` blob holding inputs/outputs. SabFlow **mirrors** queue mode, the per-node lifecycle, the error taxonomy, and credential resolution; it **changes** the worker language (Rust where benched), the persistence layer (Mongo + R2 instead of Postgres), and the credential store (SabFiles-managed).

## 2. Why this survey exists

Track B Phase 1 §1 requires a written description of n8n's executor before any Rust code is committed. The nine sibling sub-tasks (node contract, IR, state schema, Rust stack, crate layout, IPC, error taxonomy, observability, write-up) each consume this survey as their source of truth, so the terminology, lifecycle names, and queue semantics quoted below are normative for Track B. Behavioural decisions — what we keep, what we change — are deferred to those sibling ADRs; this file's job is to fix the **reference model**.

Out of scope: implementation choices (covered by siblings §2–§9), the Rust-vs-Node verdict (covered by `sabflow-executor-rust-bench.md`), and any phase past Phase 1.

## 3. Execution modes

### 3.1 Regular mode (in-process)

In regular mode the main n8n process is both API server and executor.

Lifecycle of one execution:

1. A trigger fires (webhook hit, manual click, cron tick, polling trigger) inside the main process.
2. The main process loads the workflow JSON from the DB, builds the in-memory workflow graph, and instantiates `WorkflowExecute`.
3. `WorkflowExecute` walks the DAG starting from the trigger node, calling each node's `execute()` (or trigger/poll variant) **on the same event loop** as the HTTP server.
4. Output items per node are accumulated into a `runData` map keyed by node name.
5. On completion (success or error), the execution record is updated and the editor is notified via the push module.

Properties:

- Zero external dependencies beyond the DB.
- One blocked node (long HTTP call, slow code node) stalls the API for everyone.
- Process restart kills any in-flight execution; there is no checkpoint to resume from.
- Used by default for dev, single-container installs, and the desktop app.

### 3.2 Queue mode (Bull on Redis, worker pool)

Queue mode is the production topology. The main process becomes a **producer**; one or more **worker processes** (typically launched with `n8n worker`) become consumers.

Lifecycle of one execution:

1. The main process receives the trigger as in regular mode, but instead of running the workflow it persists an `execution_entity` row in `new` state and pushes a Bull job onto the `jobs` queue on Redis. The job payload references the execution id; the heavy `execution_data` blob lives in the DB, not in Redis.
2. A worker picks the job up (Bull `getNextJob` / `processJob` loop), claims it, and instantiates `WorkflowExecute` locally.
3. The worker streams progress events back to the main process over a Redis pub/sub channel (Bull events plus n8n-specific channels) so the editor's push module can mirror live status to the user.
4. On finish, the worker writes the final outputs into `execution_data`, marks `execution_entity.status` (`success` / `error` / `canceled`), and acks the Bull job.
5. The main process picks up the completion event and notifies any subscribed editor sessions.

## 4. Bull queue semantics

n8n uses BullMQ (and historically Bull) on top of Redis. The semantics SabFlow needs to inherit:

- **Atomic claim.** `BRPOPLPUSH`-style atomic move of a job id from `wait` to `active` guarantees one worker per job. A worker that dies mid-job leaves the id in `active`; a stalled-job monitor reclaims it after the lock TTL.
- **Lock + heartbeat.** Each active job carries a Redis lock keyed by job id. The worker renews the lock at an interval shorter than its TTL (`lockRenewTime` ~ `lockDuration` / 2). Missed heartbeats mark the job stalled and re-queue it up to `maxStalledCount` times.
- **Retry policy.** Configurable `attempts` with `backoff: { type: 'exponential', delay }`. n8n exposes this per-workflow as "Retry on Fail" and per-node as "Retry On Fail" with `waitBetweenTries`.
- **Delayed jobs.** Jobs with a `delay` sit in a sorted set keyed by execution-at timestamp; a separate poller moves them into `wait` when due. This is how n8n implements `Wait` nodes that pause less than the worker idle threshold.
- **Completion / failure events.** Bull emits `completed`, `failed`, `stalled`, `progress`, `active`, `waiting` events on pub/sub. n8n subscribes from the main process to drive the editor's live view.
- **Dead-letter behaviour.** Bull does not provide a first-class DLQ; n8n leaves exhausted jobs in `failed` state and exposes them via the Executions UI. A Track B Phase 2 sub-task adds a real DLQ on top.

## 5. `WorkflowExecute` (n8n-core)

`WorkflowExecute` is the single class that owns DAG traversal and per-node invocation. Both regular mode and queue mode instantiate it; only the **caller** differs (API process vs. worker process). Its four entry points:

| Entry point | Used by | Purpose |
| --- | --- | --- |
| `runOnce` | Single-pass execution from a known start node | Fire the workflow once with a fixed input payload (the most common path; trigger nodes call this). |
| `run` | Long-running / streaming triggers | Driver loop for triggers that emit many invocations from a single subscription (e.g. SSE, IMAP IDLE, change streams); each emission produces one execution. |
| `runPartialWorkflow` | Editor "Execute Node" / partial reruns | Run only a sub-DAG starting from a chosen node, reusing `runData` already captured upstream. Backs the "Pin data" + "Retry from failed node" features. |
| `runManualWorkflow` | Editor "Execute Workflow" button | Full-graph run initiated from the editor; streams live per-node progress over the push channel; persisted differently from production runs (manual flag on `execution_entity`). |

All four converge on the same per-node invocation routine, so the lifecycle in §6 applies uniformly.

## 6. Per-node lifecycle inside one execution

For each node `N` reached by DAG traversal:

1. **Input materialisation.** `WorkflowExecute` reads the upstream `runData[parent].main[outputIndex]` array of items and binds it as `N`'s `inputData`.
2. **Credential resolution.** If `N` declares credentials, `CredentialsHelper` (see §8) loads, decrypts, and injects them into the node's runtime context (`this.getCredentials(name)`).
3. **Parameter resolution.** Static parameters are read straight from the workflow JSON; expression parameters (`{{ $json.foo }}`) are evaluated against the current item via the tournament evaluator.
4. **Invocation.** The node's `execute()` (regular nodes), `trigger()` (trigger nodes), `webhook()` (webhook entry), or `poll()` (polling triggers) is called. For item-based nodes, n8n iterates items inside the node body; for "Run Once for All Items" nodes, a single call receives the full array.
5. **Output capture.** The returned `INodeExecutionData[][]` is written into `runData[N].main[]`, ready for downstream nodes.
6. **Error path.** If the call throws, behaviour depends on the node's `continueOnFail` flag:
   - `continueOnFail = false` (default) — execution halts; the error is wrapped as `NodeApiError` or `NodeOperationError`, the failed node is marked, and (if connected) the **Error Trigger** node receives the failure payload.
   - `continueOnFail = true` — the thrown error is shaped into an item with a `.error` property and routed downstream as normal output, so the user's workflow can branch on it.
7. **Status update.** Per-node status (`running` → `success` / `error` / `disabled` / `waiting`) and `executionTime` are recorded for the editor's live view and for `execution_data`.

## 7. Webhook trigger path

1. **HTTP entry.** A request hits an Express route registered at `<host>/webhook/<path>` (production) or `<host>/webhook-test/<path>` (editor "Listen for test event" mode).
2. **Route resolution.** n8n's `WebhookService` looks up the path in the `webhook_entity` table, which maps `(method, path)` → `(workflowId, nodeName)`.
3. **Workflow load.** The workflow is loaded, the trigger node is identified, and the inbound request (headers, body, query) is shaped as the first item for that node.
4. **Execution dispatch.** In **regular mode** the workflow runs inline on the request thread; in **queue mode** the request is persisted as an `execution_entity` row and pushed to Bull, then the HTTP handler either (a) responds immediately ("Respond Immediately" mode), (b) waits for the worker to complete and respond ("When Last Node Finishes"), or (c) lets a downstream "Respond to Webhook" node send the response asynchronously.
5. **Cleanup.** Test webhooks are single-shot; production webhooks remain registered until the workflow is deactivated.

## 8. Manual execution (editor "Execute" button)

Manual runs come from the editor, not from a production trigger:

- The editor `POST`s the current (possibly unsaved) workflow JSON to `/rest/workflows/run` along with optional pinned data.
- The API process runs the workflow **inline** (regular-mode-style) even when the install is configured for queue mode, so the editor sees per-node progress over the push channel as it happens. (Queue-mode manual runs are an option but require routing pub/sub events back to the originating editor socket, which is why the default is inline.)
- The resulting `execution_entity` row is flagged `mode = 'manual'`, retained under a separate retention policy from production runs, and shown in the editor's Executions panel.
- Pinned data per node short-circuits upstream execution: a downstream node reads the pinned items as if its parent had just produced them, enabling fast iteration on a single problem node.

## 9. Credentials resolution at run time

`CredentialsHelper` (n8n-core) is the single chokepoint:

1. The node declares the credential type it needs (e.g. `httpBasicAuth`, `googleOAuth2Api`).
2. At run time, `CredentialsHelper.getCredentials(node, type)` loads the matching `credentials_entity` row for the executing user / workspace.
3. The row's `data` column (AES-256-CBC encrypted with the instance encryption key, derived from the `N8N_ENCRYPTION_KEY` env var) is decrypted in memory.
4. For OAuth2 credentials, a refresh check runs first; if the access token is expired or near expiry, `CredentialsHelper` triggers the refresh flow against the provider's token endpoint and writes the new token back.
5. The decrypted credential object is handed to the node via `this.getCredentials(name)`. It is **never** logged, never serialised into `execution_data`, and is scrubbed from error objects before they reach the editor.

## 10. Persistence — where execution state lives

n8n splits execution persistence across two tables for size reasons:

- **`execution_entity`** — the row. Holds metadata: `id`, `workflowId`, `mode` (`manual` / `trigger` / `webhook` / `retry`), `status` (`new` / `running` / `waiting` / `success` / `error` / `canceled`), `startedAt`, `stoppedAt`, `finished` flag, `retryOf`, `retrySuccessId`. Cheap to index, cheap to list.
- **`execution_data`** — the blob. Holds the heavy fields: serialised `runData` (per-node inputs and outputs), `lastNodeExecuted`, `executionData` (the workflow JSON snapshot at run time, so retries are reproducible even if the workflow has since been edited), and any `waitTill` resume state.

This split lets the executions UI page through thousands of rows without pulling megabytes of item payloads, and lets `execution_data` be pruned independently under retention policy.

## 11. What SabFlow MIRRORS vs CHANGES

### Mirror (semantics held constant)

- **Queue-mode topology** — Bull-compatible schema on Redis so existing n8n tooling (`bull-board`, `bullmq` inspectors) can read SabFlow's queue. Producer is the Next.js API + Routing Middleware; consumers are SabFlow workers.
- **Per-node lifecycle** — input → credential resolve → parameter resolve → invoke → output → error-or-continueOnFail, exactly as §6.
- **Error taxonomy** — `NodeApiError` and `NodeOperationError` shapes are preserved (Track B Phase 1 §8 finalises the Rust enum that serialises to these names), so user-facing error messages, the Error Trigger contract, and imported workflows behave identically.
- **Credential resolution contract** — a single helper that nodes call (`getCredentials(name)`); decryption happens inside the worker, never on the wire; OAuth2 refresh on read; never logged.
- **Execution-state split** — one "row" collection for listing/indexing, one "blob" collection for `runData` and `executionData`, with independent retention.
- **Manual vs production run distinction** — manual runs stream live progress over the editor's push channel and use a separate retention pool; production runs are queue-only.
- **`WorkflowExecute` entry-point shape** — `runOnce` / `run` / `runPartialWorkflow` / `runManualWorkflow` map to four entry points on the SabFlow executor service (final naming settled in Track B Phase 1 §2).

### Change (deliberate divergences)

- **Worker language.** Workers are written in Rust **only** where `sabflow-executor-rust-bench.md` clears the >=30% bar (item-iteration + expression hot path). Everywhere else workers stay in Node, mirroring n8n's runtime so community-node compatibility is preserved.
- **Persistence backend.** Postgres + TypeORM → **Mongo + R2**. `execution_entity` becomes a Mongo collection (`sabflow_executions`); `execution_data` becomes a sibling collection (`sabflow_execution_data`) with cold tier offloaded to R2 past the retention window (final shape in Track A Phase 2 §1–§3 and Track B Phase 7 §1, §9).
- **Credentials store.** n8n's encrypted `credentials_entity` rows → **SabFiles-managed credentials**: the encrypted blob lives as a SabFiles object (per CLAUDE.md's "every file lives in SabFiles" rule), with the credential row holding only metadata + SabFile id. Decryption keys come from Vercel env / Marketplace KMS; rotation is a SabFiles re-encrypt op. Final shape in Track B Phase 5.
- **Webhook entry.** Express route → **Next.js Route Handler** (Node.js runtime, Fluid Compute). The Vercel Function persists the `execution_entity` row and enqueues the Bull job; workers consume from a separate Rust/Node service. Routing Middleware handles auth, rate limit, and tenant resolution before the handler runs.
- **Cron triggers.** n8n's internal cron scheduler → **Vercel Cron**, per CLAUDE.md. The cron endpoint enqueues a job exactly like a webhook would (Track B Phase 6 §2).
- **Push channel for manual runs.** n8n's bespoke push module → the **SabFlow WS gateway** built in Track A Phase 3, which already speaks per-doc rooms and JWT-on-upgrade. Manual-run progress events become a topic on the same socket the editor is already using for CRDT updates.
- **Multi-tenancy.** Every collection row carries `workspaceId`; RBAC keys gate read/write per CLAUDE.md's SaaS rules. n8n's single-tenant default is not preserved.

## 12. Open questions handed to siblings

These are explicitly **not** decided here; they belong to the listed sibling sub-task:

1. Exact Rust enum shape for `NodeApiError` / `NodeOperationError` — Track B Phase 1 §8.
2. Whether the Rust worker speaks HTTP, gRPC, or stdin/stdout NDJSON to Node — Track B Phase 1 §7.
3. Whether `runPartialWorkflow` re-uses captured `runData` from a prior execution or re-runs upstream nodes — Track B Phase 1 §2.
4. Whether manual runs are allowed to use queue mode (with editor-targeted pub/sub) or stay inline-only — Track B Phase 1 §4.
5. Cold-tier offload threshold for `execution_data` to R2 — Track B Phase 7 §9.

## 13. Decision log

| Date | Event | Notes |
| ---- | ----- | ----- |
| 2026-05-18 | Survey landed | Reference model fixed for the nine sibling Track B Phase 1 sub-tasks. |
