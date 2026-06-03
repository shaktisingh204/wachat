# Twenty CRM Server Review — Slice 04: Workflow Engine, Automation, AI, Functions, Queue

Read-only catalog of the vendored Twenty backend automation stack. Source root:
`services/sabcrm/packages/twenty-server/src`. All descriptions are original
summaries of the observed design; no source is reproduced verbatim.

Scope of this slice:

- **Core modules** (`engine/core-modules/`): `workflow` (API/GraphQL/REST layer),
  `logic-function`, `code-interpreter`, `tool`, `tool-provider`, `cron`,
  `message-queue`. (Note: there is **no** `engine/core-modules/ai` — AI/agent
  logic lives under `engine/metadata-modules/ai`.)
- **Workspace modules** (`modules/workflow/`): `common`, `workflow-builder`,
  `workflow-executor`, `workflow-runner`, `workflow-trigger`, `workflow-status`,
  `workflow-tools`.
- **Worker entrypoint**: `src/queue-worker/` (`queue-worker.ts`, `queue-worker.module.ts`).

---

## 1. Architecture Overview

Twenty's automation engine is a **persisted, queue-backed, resumable state
machine**. It separates four concerns:

1. **Authoring/data model** — a `Workflow` owns immutable `WorkflowVersion`
   snapshots; each version holds a single `trigger` + a flat array of `steps`
   (a DAG linked by `nextStepIds`). Activating a version may materialize
   `WorkflowAutomatedTrigger` rows (for DB-event and cron triggers).
2. **Triggering** — four trigger types fire a *run* either via DB-event
   listeners, a cron scheduler, an HTTP webhook controller, or a manual/REST
   GraphQL mutation.
3. **Running/orchestration** (`workflow-runner`) — creates a `WorkflowRun`,
   throttles + enqueues it onto the BullMQ `workflow-queue`, and manages the
   run lifecycle (staled-run reaping, cleanup, throttling).
4. **Executing** (`workflow-executor`) — a recursive step executor that resolves
   each step's input variables, dispatches to a per-type action, records
   per-step status into `WorkflowRun.state.stepInfos`, and walks `nextStepIds`.
   Long jobs are chunked (re-enqueued after `MAX_EXECUTED_STEPS_COUNT = 20`
   steps) to avoid single-job timeouts.

Everything is **multi-tenant by workspace**; the run job sets a system auth
context and executes inside `GlobalWorkspaceOrmManager.executeInWorkspaceContext`.

---

## 2. Workflow Data Model

Three standard workspace entities + one automated-trigger entity
(`modules/workflow/common/standard-objects/`). These are TypeORM "workspace
entities" (per-tenant schema), not core entities.

### 2.1 `WorkflowWorkspaceEntity` (the workflow shell)

| Field | Type | Notes |
|---|---|---|
| `name` | `string \| null` | display name |
| `lastPublishedVersionId` | `string \| null` | pointer to most recently activated version |
| `statuses` | `WorkflowStatus[] \| null` | array of `DRAFT` / `ACTIVE` / `DEACTIVATED` |
| `position` | `number` | board ordering |
| `searchVector` | `tsvector` | full-text search on `name` |
| `versions` | relation → `WorkflowVersion[]` | |
| `runs` | relation → `WorkflowRun[]` | |
| `automatedTriggers` | relation → `WorkflowAutomatedTrigger[]` | materialized DB-event/cron triggers |
| `timelineActivities`, `attachments` | relations | |
| `createdBy` / `updatedBy` | `ActorMetadata` | actor stamping |

`WorkflowStatus` enum: `DRAFT`, `ACTIVE`, `DEACTIVATED`.

### 2.2 `WorkflowVersionWorkspaceEntity` (immutable flow snapshot)

| Field | Type | Notes |
|---|---|---|
| `name` | `string \| null` | |
| `trigger` | `WorkflowTrigger \| null` | the single trigger object (jsonb) |
| `steps` | `WorkflowAction[] \| null` | flat array of step nodes (jsonb DAG) |
| `status` | `WorkflowVersionStatus` | `DRAFT` / `ACTIVE` / `DEACTIVATED` / `ARCHIVED` |
| `position`, `searchVector` | | |
| `workflow` / `workflowId` | relation | owning workflow |
| `runs` | relation → `WorkflowRun` | |

Authoring model: only `DRAFT` versions are editable; activation freezes a
version and (for old active versions) archives the prior one — a lightweight
**versioning** scheme. A "create draft from version" flow clones an active
version back into an editable draft.

### 2.3 `WorkflowRunWorkspaceEntity` (one execution instance)

| Field | Type | Notes |
|---|---|---|
| `name` | `string \| null` | |
| `enqueuedAt` | `Date \| null` | |
| `startedAt` / `endedAt` | `string \| null` | |
| `status` | `WorkflowRunStatus` | see enum below |
| `createdBy` / `updatedBy` | `ActorMetadata` | |
| `state` | `WorkflowRunState` (jsonb) | the live state machine (see below) |
| `position` | `number` | |
| `workflowVersion` / `workflowVersionId` | relation | pinned version snapshot |
| `workflow` / `workflowId` | relation | |
| `timelineActivities` | relation | |

`WorkflowRunStatus` enum: `NOT_STARTED`, `ENQUEUED`, `RUNNING`, `COMPLETED`,
`FAILED`, `STOPPING`, `STOPPED`.

**`WorkflowRunState`** (the durable state machine, stored in `state`):

- `flow`: a frozen copy of `{ trigger, steps }` from the version (so edits to the
  version never affect an in-flight run).
- `stepInfos`: `WorkflowRunStepInfos` — a `Record<stepId, { status, result?, error? }>`
  capturing per-step progress. `StepStatus` values observed:
  `PENDING`, `RUNNING`, `SUCCESS`, `FAILED`, `FAILED_SAFELY`, `SKIPPED`,
  `STOPPED`. This map IS the resume cursor — there is no separate program counter.
- `workflowRunError?`: top-level error message.

There is also a derived `WorkflowRunOutput` shape (`flow` + `stepsOutput` map +
`error`) used when surfacing results.

### 2.4 `WorkflowAutomatedTriggerWorkspaceEntity`

Materialized registration row created when a version with a DB-event or cron
trigger is activated.

| Field | Type | Notes |
|---|---|---|
| `type` | `AutomatedTriggerType` | `DATABASE_EVENT` or `CRON` only |
| `settings` | `AutomatedTriggerSettings` (jsonb) | event name / cron pattern |
| `workflow` / `workflowId` | relation | |

`AutomatedTriggerSettings` union:
- DB event: `{ eventName }`, optionally `{ eventName, fields: string[] }` for
  update/upsert (so the trigger only fires when listed fields change).
- Cron: `{ pattern }` (a cron expression string).

Note MANUAL and WEBHOOK triggers are **not** materialized here — they are
resolved at request time (command-menu item for manual, HTTP route for webhook).

---

## 3. Trigger Types

Defined in `workflow-trigger/types/workflow-trigger.type.ts`
(`WorkflowTriggerType` enum). Each trigger carries a `BaseWorkflowTriggerSettings`
with an `outputSchema` (the shape downstream steps can reference) plus
`nextStepIds` and an optional canvas `position`.

| Trigger type | Settings / config shape | How it fires |
|---|---|---|
| **`DATABASE_EVENT`** | `{ outputSchema, eventName }`. `eventName` is `"<object>.<action>"` (e.g. `company.created`). Materialized automated-trigger settings may add `fields: string[]` for update/upsert filtering. | `WorkflowDatabaseEventTriggerListener` subscribes to `@OnDatabaseBatchEvent('*', <action>)` for CREATED / UPDATED / DELETED / DESTROYED / UPSERTED. On a batch it enriches records with relations, then queries `workflowAutomatedTrigger` rows whose `settings->>'eventName'` matches and dispatches a run per matching workflow. |
| **`MANUAL`** | `{ outputSchema, objectType?, icon?, isPinned?, availability? }` where `availability` is `GlobalAvailability \| SingleRecordAvailability \| BulkRecordsAvailability`. | On activation, `createOrUpdateCommandMenuItem` registers a command-menu entry (global / single-record / bulk). User invocation calls `runWorkflowVersion` → runner. Manual runs are **enqueued directly** (bypass the not-started → enqueue cron path) for low latency. |
| **`CRON`** | `{ outputSchema }` + a discriminated union: `{type:'DAYS', schedule:{day,hour,minute}}`, `{type:'HOURS', schedule:{hour,minute}}`, `{type:'MINUTES', schedule:{minute}}`, or `{type:'CUSTOM', pattern}`. The structured forms are compiled to a cron pattern via `compute-cron-pattern-from-schedule.ts`. | On activation a `WorkflowAutomatedTrigger {type:CRON, settings:{pattern}}` row is created. A periodic `WorkflowCronTriggerCronJob` reads triggers (from a Redis cache keyed per workspace, falling back to DB), and for each whose `pattern` satisfies `shouldRunNow(pattern, now)` dispatches a run. |
| **`WEBHOOK`** | `{ outputSchema }` + union: `{httpMethod:'GET', authentication:'API_KEY'\|null}` or `{httpMethod:'POST', authentication:'API_KEY'\|null, expectedBody:object}`. | Inbound HTTP hits `workflow-trigger.controller.ts`; the request body/headers become the run payload. Not materialized as an automated-trigger row — resolved live at the route. |

`AutomatedTriggerType` (the materialized subset) is therefore only
`{ DATABASE_EVENT, CRON }`.

---

## 4. Action / Step Library

All step node types live in `WorkflowActionType`
(`workflow-executor/workflow-actions/types/workflow-action-type.enum.ts`).
Each `WorkflowAction` node has the base shape:

```
{ id, name, type, settings, valid, nextStepIds?, position? }
```

Every settings object extends **`BaseWorkflowActionSettings`**:

```
{
  outputSchema,
  errorHandlingOptions: {
    retryOnFailure:   { value: boolean },
    continueOnFailure:{ value: boolean }   // → FAILED_SAFELY instead of FAILED
  }
}
```

The executor dispatches via `WorkflowActionFactory.get(type)`. Several types
(`SEND_EMAIL`, `DRAFT_EMAIL`, `HTTP_REQUEST`) route to a shared
`ToolExecutorWorkflowAction` that bridges into the `tool` core module rather
than having a bespoke action class.

| Action type | Action class / handler | `settings.input` config shape | Behavior |
|---|---|---|---|
| **`CODE`** | `CodeWorkflowAction` | `{ logicFunctionId, logicFunctionInput: Record<string,any> }` | Resolves input variables, then runs a Logic Function (serverless code) via `LogicFunctionExecutorService`. Returns `result.data` or surfaces `error`. |
| **`LOGIC_FUNCTION`** | `LogicFunctionWorkflowAction` | `{ logicFunctionId, logicFunctionInput: Record<string,any> }` | Same input shape as CODE; invokes a stored Logic Function. (CODE is the legacy alias; both map to the logic-function executor.) |
| **`SEND_EMAIL`** | `ToolExecutorWorkflowAction` → email tool | `{ connectedAccountId, recipients: EmailRecipients, subject?, body?, inReplyTo? }` | Sends an email through a connected account; body supports rich-text → HTML rendering. |
| **`DRAFT_EMAIL`** | `ToolExecutorWorkflowAction` → draft-email tool | same as SEND_EMAIL | Creates a draft instead of sending. |
| **`CREATE_RECORD`** | `CreateRecordWorkflowAction` | `{ objectName, objectRecord: ObjectRecordProperties, upsert? }` | Resolves variables, creates a record via the record-CRUD core module. |
| **`UPDATE_RECORD`** | `UpdateRecordWorkflowAction` | `{ objectName, objectRecordId, objectRecord, fieldsToUpdate?: string[] }` | Partial/full update. |
| **`DELETE_RECORD`** | `DeleteRecordWorkflowAction` | `{ objectName, objectRecordId }` | Soft-delete a record. |
| **`UPSERT_RECORD`** | `UpsertRecordWorkflowAction` | `{ objectName, objectRecord }` | Insert-or-update. |
| **`FIND_RECORDS`** | `FindRecordsWorkflowAction` | `{ objectName, filter?:{recordFilterGroups?, recordFilters?, gqlOperationFilter?}, orderBy?:{recordSorts?, gqlOperationOrderBy?}, limit? }` | Query records; result feeds downstream steps (commonly an iterator). |
| **`FORM`** | `FormWorkflowAction` | `FormFieldMetadata[]` — each `{ id, name, label, type: WorkflowFormFieldType, value?, placeholder?, settings? }` | Emits `pendingEvent:true` and **pauses** the run (status PENDING) until a human submits the form (`submitFormStep` resumes it). A human-in-the-loop step. |
| **`FILTER`** | `FilterWorkflowAction` | `{ stepFilterGroups?: StepFilterGroup[], stepFilters?: StepFilter[] }` | Evaluates filter predicates against context; if it fails, downstream steps are skipped (gates the branch). |
| **`IF_ELSE`** | `IfElseWorkflowAction` | `{ stepFilterGroups, stepFilters, branches: StepIfElseBranch[] }` | Evaluates branch conditions, picks the matching branch's `nextStepIds` to execute and **skips** the rest. Multi-way conditional. |
| **`HTTP_REQUEST`** | `ToolExecutorWorkflowAction` → http tool | `{ url, method:'GET'\|'POST'\|'PUT'\|'PATCH'\|'DELETE', headers?:Record<string,string>, body?:Record<...>\|string }` | Outbound HTTP call; response returned as step result. |
| **`AI_AGENT`** | `AiAgentWorkflowAction` | `{ agentId?, prompt? }` | Loads an `AgentEntity`, resolves the prompt, runs `AgentAsyncExecutorService.executeAgent` (tool-calling LLM). Credit-gated; returns agent result or a "no more credits" error. |
| **`ITERATOR`** | `IteratorWorkflowAction` | `{ items?: any[] \| string, initialLoopStepIds?: string[], shouldContinueOnIterationFailure? }` | Loops: re-enters `initialLoopStepIds` once per item. The executor re-dispatches the loop body until `hasProcessedAllItems`. `items` may be a variable reference string resolved at runtime. |
| **`DELAY`** | `DelayWorkflowAction` | union: `{delayType:'SCHEDULED_DATE', scheduledDateTime}` or `{delayType:'DURATION', duration:{days?,hours?,minutes?,seconds?}}` | Computes a delay-ms, enqueues a `ResumeDelayedWorkflow` job on the delayed-jobs queue, emits `pendingEvent:true` to pause the run until the timer fires. |
| **`EMPTY`** | `EmptyWorkflowAction` | (no input) | No-op placeholder / structural node (e.g. a freshly-added unconfigured step). |

### Action output contract

Every action returns `WorkflowActionOutput`:

```
{
  result?: object,                  // success payload (also marks SUCCESS)
  error?: string,                   // failure
  pendingEvent?: boolean,           // pause: wait for external resume (FORM, DELAY)
  shouldEndWorkflowRun?: boolean,   // stop the whole run (→ STOPPED)
  shouldRemainRunning?: boolean,    // step still in progress
  shouldSkipStepExecution?: boolean,// skip (branch not taken)
  shouldFailSafely?: boolean        // continueOnFailure → FAILED_SAFELY, keep going
}
```

---

## 5. Executor / Runner Architecture

### 5.1 Runner (`WorkflowRunnerWorkspaceService`)

- `run({ workspaceId, workflowVersionId, payload, source, workflowRunId? })`:
  checks billing/feature usage, loads the version, and routes:
  - **Hard-throttled** workspace → creates a *failed* run immediately.
  - **Manual trigger** → `enqueueWorkflowRun` (direct enqueue).
  - Otherwise → `createNotStartedWorkflowRunAndTriggerEnqueueJob` (creates a
    `NOT_STARTED` run, then a separate enqueue cron/job moves it to `ENQUEUED`).
- `resume(...)` and `submitFormStep(...)` re-add a `RunWorkflowJob` to continue a
  paused run.
- **Throttling** lives in `WorkflowThrottlingWorkspaceService` (hard limit per
  workspace). A run-queue subsystem (`workflow-run-queue/`) provides cron-driven
  housekeeping: `workflow-run-enqueue` (promote NOT_STARTED → ENQUEUED),
  `workflow-handle-staled-runs` (reap runs stuck > `STALED_RUNS_THRESHOLD_MS` =
  1h), and `workflow-clean-workflow-runs` (retain `NUMBER_OF_WORKFLOW_RUNS_TO_KEEP`
  = 1000, prune runs older than `RUNS_TO_CLEAN_THRESHOLD_DAYS` = 14).

### 5.2 Run job (`RunWorkflowJob`, BullMQ `workflow-queue`)

Request-scoped processor. Builds a **system auth context** and runs inside the
workspace ORM context. Two entry modes:

- **start** (no `lastExecutedStepId`): guards status ∈ {ENQUEUED, NOT_STARTED},
  loads version, **builds code steps from source** (`CodeStepBuildService` —
  transpiles inline Logic-Function code before run), marks run RUNNING,
  increments a per-trigger metric, then `executeFromSteps(trigger.nextStepIds)`.
- **resume** (`lastExecutedStepId` set): guards RUNNING, recomputes the next
  steps from the last step's recorded output, and continues — this is how
  chunked execution (the 20-step re-enqueue) and pause/resume both work.

### 5.3 Step executor (`WorkflowExecutorWorkspaceService`)

The heart of the state machine. `executeFromSteps(stepIds)` runs the given
frontier in parallel (`Promise.all`), then optionally recomputes overall run
status. Per step (`executeFromStep`):

1. Reload the run, read `state.stepInfos` + `state.flow.steps`.
2. Decide via `shouldExecuteStep` / `shouldFailSafely` / `shouldSkipStepExecution`
   whether to run, fail-safely, or skip.
3. `executeStep` → factory dispatch → `action.execute({ currentStepId, steps,
   context, runInfo })`. Context is `getWorkflowRunContext(stepInfos)` — a map of
   prior step outputs keyed for variable resolution.
4. Errors: distinguish *user* errors (invalid step type/input/not-found) from
   *system* errors (captured to Sentry + a metric). If the failing step is inside
   an iterator with continue-on-iteration-failure, the error is downgraded to
   fail-safely.
5. `processStepExecutionResult` maps the output to a `StepStatus` and persists it
   to `stepInfos`.
6. `getNextStepIdsToExecute` computes the frontier:
   - **Iterator**: if not all items processed → re-enter `initialLoopStepIds`.
   - **If/Else**: execute the matching branch's `nextStepIds`, skip the others
     (or fail-safely all branches if the step failed safely).
   - Default: the step's own `nextStepIds`.
7. Skipped/fail-safely steps are stamped and their successors continued via
   `skipAndFailSafelyStepsThenContinue`.
8. After `MAX_EXECUTED_STEPS_COUNT = 20` steps in one job, it **re-enqueues** a
   continuation job (`continueExecutionFromStepInAnotherJob`) — bounded per-job
   work + crash-safe resume.

`computeWorkflowRunStatus` finalizes: STOPPING→STOPPED once no running steps;
FAILED if any unrecovered failure; COMPLETED if nothing left running.

**Retries**: `errorHandlingOptions.retryOnFailure` is part of step settings and
honored by the BullMQ-backed driver/error path; `continueOnFailure` converts a
hard failure into `FAILED_SAFELY` so the run proceeds. Usage metering emits a
`USAGE_RECORDED` event (100 credit-micros per executed non-skipped node) and
decrements cached billing credits when billing is enabled.

### 5.4 Variable Resolution / Interpolation

Shared util `twenty-shared/src/utils/variable-resolver.ts` (`resolveInput`):

- Recursively walks strings, arrays, and objects (keys *and* values).
- Variable syntax is `{{ ... }}` (`/\{\{([^{}]+)\}\}/g`).
- If a string is **exactly one** `{{token}}`, the resolved value is returned with
  its native type (object/array/number preserved). Otherwise tokens are
  string-interpolated into the surrounding text.
- Each token is evaluated by `evalFromContext(token, context)` against the run
  context (prior step outputs + trigger payload). Helper utilities
  (`extractRawVariableNameParts`, `variable-path.util`) split a path like
  `stepId.field.subfield` into step id / selected field for builder UI + schema
  computation. Every action calls `resolveInput(step.settings.input, context)`
  before executing.

---

## 6. AI, Tools, and Logic Functions

### 6.1 AI Agents (`engine/metadata-modules/ai/`)

(There is no `core-modules/ai`; agents are metadata-level entities.) Submodules:
`ai-agent`, `ai-agent-execution`, `ai-agent-role`, `ai-agent-monitor`.

`AgentEntity` (core `agent` table) fields include: `id`, `name`, `label`,
`icon?`, `description?`, `prompt` (system prompt), `modelId` (default
`AUTO_SELECT_SMART_MODEL_ID`), `responseFormat` (jsonb, default text),
`modelConfiguration?` (jsonb), `isCustom`, plus a text-array column (roles/tools)
and timestamps. `AgentAsyncExecutorService.executeAgent` runs a tool-calling LLM
loop with usage/credit gating (operation type `AI_WORKFLOW_TOKEN` when invoked
from a workflow), returning a result + `hasNoMoreAvailableCredits` flag.

### 6.2 Tool core module (`engine/core-modules/tool` + `tool-provider`)

A generic LLM tool-calling abstraction shared by agents, the AI chat assistant,
and the workflow `ToolExecutorWorkflowAction`.

- **`Tool`** type: `{ description, inputSchema (AI-SDK FlexibleSchema), execute(input, context), flag? (permission) }`.
- **`ToolType`** enum: `HTTP_REQUEST`, `SEND_EMAIL`, `SEARCH_HELP_CENTER`,
  `CODE_INTERPRETER`, `NAVIGATE_APP`. Concrete tools live under
  `tool/tools/*` (http-tool, email-tool with composer service, code-interpreter-tool,
  navigate-app-tool, search-help-center-tool).
- **`tool-provider`** is a registry/retrieval layer: providers
  (`database-tool`, `workflow-tool`, `webhook-tool`, `metadata-tool`,
  `view-tool`, `dashboard-tool`, `action-tool`, `navigation-menu-item-tool`,
  `logic-function-tool`) expose catalogs of tools; a `ToolRegistryService` +
  `ToolExecutorService` index, retrieve, and execute them. Higher-order tools
  (`learn-tools`, `load-skill`, `get-tool-catalog`, `execute-tool`) let an agent
  discover/dynamically load tools (MCP-style). Output transforms compact/strip
  results before returning to the model.

### 6.3 Logic Functions (`engine/core-modules/logic-function`) — code sandbox

Twenty's serverless-function feature (user-authored TS run in isolation).

- **Executor** (`LogicFunctionExecutorService.execute`): builds env vars (server
  + workspace variables), throttles per workspace, delegates to the current
  driver, and emits a `LOGIC_FUNCTION_EXECUTED` audit event. `transpile()` builds
  source → runnable artifact.
- **Drivers** (`LogicFunctionDriverType`): `LOCAL` (runs in a local sandbox/
  temp dir with copied executor + common-layer deps), `LAMBDA` (deploys/zips and
  invokes AWS Lambda), `DISABLED`. Selected via `LOGIC_FUNCTION_TYPE` config.
- **Triggers** (`logic-function-trigger`): a function can itself be invoked by a
  database-event, a route (HTTP), or a cron — a parallel, lighter-weight
  automation path distinct from full workflows.

### 6.4 Code Interpreter (`engine/core-modules/code-interpreter`)

A separate Python/document sandbox used by the `CODE_INTERPRETER` tool (not the
TS Logic-Function path).

- **`CodeInterpreterDriverType`**: `LOCAL`, `E_2_B` (E2B remote sandbox),
  `DISABLED`.
- Ships Python `sandbox-scripts/` for docx/pptx/pdf/xlsx manipulation
  (unpack/pack/validate, PDF form filling, thumbnails, recalculation), invoked
  inside the sandbox for document-processing agent tasks.

---

## 7. Queue Infrastructure (`engine/core-modules/message-queue`) + Worker

- **`MessageQueue`** enum (queue names) includes the automation-relevant queues:
  `workflowQueue`, `logicFunctionQueue`, `triggerQueue`, `cronQueue`,
  `delayedJobsQueue`, `aiQueue`, `aiStreamQueue`, plus infra queues
  (`webhookQueue`, `emailQueue`, `entityEventsToDbQueue`, etc.).
- **Drivers**: `bullmq.driver.ts` (Redis-backed BullMQ, production) and
  `sync.driver.ts` (in-process synchronous, for tests/dev). Selected by config.
  Decorators `@Processor` / `@Process` + a metadata explorer auto-register job
  handlers; priorities and worker options are constant-configured.
- **Worker entrypoint** `src/queue-worker/queue-worker.ts` boots a standalone
  Nest app (`QueueWorkerModule`) that consumes the queues — this is the process
  that actually runs `RunWorkflowJob`, delayed-resume jobs, cron jobs, and
  logic-function jobs out-of-band from the API server.
- **Cron core module** is minimal here (`sentry-cron-monitor.decorator.ts`); the
  scheduling cadence itself is driven by cron *commands/jobs* registered in each
  feature (e.g. `WorkflowCronTriggerCronJob`, the run-queue cron commands).

---

## Parity Notes

Baseline today: a Rust `sabcrm-workflows` crate
(`rust/crates/sabcrm-workflows`) that **persists** a workflow as
`{ trigger: Value, steps: Value }` (free-form JSON) and does **inline,
best-effort, synchronous execution** of a small step set —
`create_task`, `send_notification`, `update_field`, `webhook` — directly in the
request handler. No durable run record, no queue, no scheduler, no variable
engine, no versioning.

What real parity with Twenty requires, tagged by effort:

| Capability | Gap vs. Twenty | Tag |
|---|---|---|
| **Typed trigger model** (4 types, structured cron schedule, webhook auth, DB-event field filters) | We store a free-form `trigger` blob; need the 4-type discriminated union + per-type settings. | **SIMPLE** |
| **Versioning** (immutable `WorkflowVersion`: DRAFT/ACTIVE/DEACTIVATED/ARCHIVED, draft-from-version clone, `lastPublishedVersionId`) | We mutate a single workflow row. Needs a version table + activation lifecycle. | **SIMPLE–MEDIUM** |
| **Durable `WorkflowRun` + state machine** (run row with `state = {flow, stepInfos}`, 7 run statuses, 7 step statuses, resume cursor in `stepInfos`) | We have no run persistence at all. This is the core data model to add first. | **MEDIUM** |
| **Variable resolution engine** (`{{ }}` interpolation, single-token type preservation, path extraction, per-step `resolveInput`) | We have no interpolation; steps read literal config. Port `resolveInput` + a context builder of prior step outputs. | **MEDIUM** |
| **Expanded action library** (record CRUD ×5, FILTER, IF_ELSE multi-branch, ITERATOR loops, DELAY, FORM human-in-the-loop, HTTP, SEND/DRAFT_EMAIL, CODE/LOGIC_FUNCTION, AI_AGENT, EMPTY) | We have ~4 inline actions. Branching/iteration/delay/form each need executor support, not just a handler. | **MEDIUM** (CRUD/HTTP/filter) → **RUNTIME-HEAVY** (iterator, if-else, delay, form, code) |
| **Queue worker + async executor** (BullMQ `workflow-queue`, request-scoped run job, parallel frontier execution, 20-step chunked re-enqueue, system auth context) | Inline synchronous execution only. Needs a real job queue + out-of-band worker process. | **RUNTIME-HEAVY** |
| **Trigger firing infra** — DB-event batch listener matching materialized triggers; cron scheduler (`shouldRunNow`) with per-workspace cache; webhook controller; manual command-menu items | We have none of the dispatch plumbing; triggers don't auto-fire. | **RUNTIME-HEAVY** |
| **Run lifecycle housekeeping** (throttling, NOT_STARTED→ENQUEUED promotion, staled-run reaping @1h, retention cleanup @1000 runs / 14 days) | Absent. | **MEDIUM** (depends on durable runs + queue) |
| **Error handling semantics** (`retryOnFailure`, `continueOnFailure`→FAILED_SAFELY, iterator continue-on-iteration-failure, user-vs-system error split + metrics) | We do best-effort with no retry/continue model. | **MEDIUM** |
| **AI agent step + tool-calling** (`AgentEntity`, async agent executor, tool registry/providers, credit gating) | Out of scope for v1; large surface (LLM loop, tool catalog, MCP-style dynamic tools). | **RUNTIME-HEAVY** |
| **Code/Logic-Function + Code-Interpreter sandboxes** (LOCAL/LAMBDA/E2B drivers, transpile, per-step build-from-source) | Out of scope for v1; requires sandbox infrastructure. | **RUNTIME-HEAVY** |

**Suggested sequencing:** (1) durable run + step-status state machine, (2)
typed triggers + versioning, (3) variable engine, (4) the non-async action set
(CRUD/HTTP/filter/if-else), (5) queue worker to make execution async +
resumable, then (6) iterator/delay/form, deferring AI and code sandboxes to a
later phase.
