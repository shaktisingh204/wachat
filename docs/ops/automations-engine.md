# CRM Automations Engine — Runbook

The CRM automations engine fires user-defined trigger → conditions → actions
pipelines whenever a CRM entity changes. Execution is durable, backed by
**Vercel Workflow DevKit**: every step is retried automatically, every action
result is persisted, and crashes resume from the exact failed step.

This runbook is the on-call reference for: how the engine works, how to debug
a misfiring automation, the dedupe scheme, and how to add new action handlers.

---

## 1. File map

| Path | Purpose |
|------|---------|
| `src/lib/automations/types.ts` | TS shapes for triggers, conditions, actions, events, run-logs. |
| `src/lib/automations/evaluate.ts` | Pure evaluator: `matchesTrigger`, `passesConditions`. |
| `src/lib/automations/dispatch.ts` | `dispatchAutomations(event)` — entry point from CRM mutations. |
| `src/lib/automations/workflow-runtime.ts` | `startAutomationRun()` — wraps `start()` from `workflow/api`. |
| `src/workflows/automation-run.ts` | The durable `runAutomation` workflow. |
| `src/lib/automations/actions/send-email.ts` | `send_email` action (currently structured-logs only). |
| `src/lib/automations/actions/create-task.ts` | `create_task` action (real Mongo insert into `crm_tasks`). |
| `src/lib/automations/actions/update-field.ts` | `update_field` action (real Mongo update). |
| `src/lib/automations/actions/webhook.ts` | `webhook` action (currently structured-logs only). |
| `src/lib/automations/__tests__/evaluate.test.ts` | Evaluator unit tests. |

Mongo collections:

- `crm_automations` — automation definitions.
- `crm_automation_runs` — one row per (automation, entity, event, hour-bucket)
  recording outcome, action results, and the durable workflow `runId`.

---

## 2. End-to-end flow

```
   Entity save (e.g. saveLead)
            ↓ try/catch (non-fatal)
   dispatchAutomations(event)
            ↓ filter & match triggers
   Insert crm_automation_runs row (status: queued, dedupeKey)
            ↓ unique index on dedupeKey prevents dupes
   startAutomationRun() → workflow/api.start(runAutomation, [...])
            ↓ Workflow DevKit
   workflow:runAutomation
     step:load        — fetch automation + fresh entity snapshot
     step:conditions  — passesConditions() gate
     [ optional sleep("Xs") for time_elapsed triggers ]
     for each action:
       step:action    — invoke action handler (retries on failure)
     step:record      — write final status + per-action results to run log
```

Every step has `console.log` entry/exit lines tagged `[automation-run]`.
Watch them via `npx workflow web <runId>` or in your serverless runtime
logs.

---

## 3. Triggers fire from these sites today

Wired:

- `src/app/actions/crm-leads.actions.ts` → `addCrmLead` (both Rust + Mongo
  paths) → `entity_created`.
- `src/app/actions/crm-leads.actions.ts` → `updateCrmLead` → `entity_updated`
  (and `status_changed` when `status` is in the diff).
- `src/app/actions/crm-deals.actions.ts` → `createCrmDeal` (both paths) →
  `entity_created`.
- `src/app/actions/crm-tasks.actions.ts` → `createCrmTask` → `entity_created`.

Not yet wired (do incrementally — same pattern):

- `changeCrmLeadStatus`, `assignCrmLead`, `archiveCrmLead`,
  `updateCrmLeadStage` (lead status/stage transitions).
- `updateCrmDeal`, `updateCrmDealStage`, `archiveCrmDeal`.
- `updateCrmTask`, `completeCrmTask`, `assignCrmTask`.
- Every other CRM entity (contacts, accounts, invoices, forms, etc.).

Pattern for any new emitter (always wrapped in try/catch so a buggy
automation can never break a user-facing save):

```ts
try {
    await dispatchAutomations({
        type: 'entity_updated',
        entityKind: 'lead',
        entityId,
        tenantUserId: String(session.user._id),
        entity: latestSnapshot,
        fieldName,
        fromValue,
        toValue,
        occurredAt: Date.now(),
    });
} catch (err) {
    console.warn('[xxx] automation dispatch failed (non-fatal):', err);
}
```

---

## 4. Dedupe scheme

`crm_automation_runs` has a **unique index on `dedupeKey`** (create the
index out-of-band — `docs/ops/automations-engine.md` mentions it, the
migration job owns it):

```
db.crm_automation_runs.createIndex({ dedupeKey: 1 }, { unique: true })
```

The key shape is:

```
<automationId>:<entityKind>:<entityId>:<eventType>:<hour-bucket>
```

Where `hour-bucket = floor(occurredAt / 3_600_000)`.

Effect: the same automation cannot fire more than once per hour for a
given (entity, event) — even if a buggy `update_field` action causes the
entity to re-emit the same `entity_updated` event in a loop. The
`insertOne` simply fails with E11000 and we no-op.

Operators who need a different cycle size: edit `buildDedupeKey` in
`dispatch.ts`. Lower bucket size = more permissive; larger = stricter.

---

## 5. Reading `crm_automation_runs` for debugging

Each run row is one execution attempt. Useful queries:

**All recent runs for one automation:**
```js
db.crm_automation_runs.find({
    automationId: "AUTO_OBJECT_ID_AS_STRING"
}).sort({ startedAt: -1 }).limit(20)
```

**Why didn't my automation fire on lead X?**
```js
db.crm_automation_runs.find({
    entityKind: "lead",
    entityId: "LEAD_ID",
    startedAt: { $gt: Date.now() - 24 * 3600 * 1000 }
})
```

`status` field values:

| Status | Meaning |
|--------|---------|
| `queued` | Dispatcher accepted the event, workflow handoff in flight. |
| `running` | Workflow is executing actions. |
| `succeeded` | All actions completed. |
| `failed` | An action threw. See `error` + `actions[].error`. |
| `skipped_conditions` | Trigger matched, but `passesConditions` returned false. |
| `skipped_duplicate` | Dedupe collision (already ran this hour). |
| `workflow_devkit_missing` | Workflow DevKit not installed — fallback log only. **Run `npm install workflow @workflow/next`**. |

The `workflowRunId` field carries the Workflow DevKit run id. Use
`npx workflow inspect run <id>` to see step-level detail, or
`npx workflow web <id>` for the visual UI.

---

## 6. Adding a new action handler

1. Add the kind to `AutomationActionKind` and the config interface in
   `src/lib/automations/types.ts`. Extend the `AutomationAction` union.
2. Create `src/lib/automations/actions/<kind>.ts` exporting an async
   handler `(cfg, ctx) => Promise<string>`. Return value is a one-line
   summary stored in the run log. Throw on failure — Workflow DevKit will
   retry the step automatically.
3. Wire the import + `case` branch into the `executeAction` switch in
   `src/workflows/automation-run.ts`.
4. If the action does I/O or calls external services, do it INSIDE the
   handler — the surrounding `executeAction` is a `"use step"` function,
   which gives you full Node.js access and persistent retries.

---

## 7. Wiring TODOs (action stubs)

Two MVP actions are currently **structured-log-only**:

### 7.1 `send_email`

File: `src/lib/automations/actions/send-email.ts`.

Replace the `console.log` block with a call to the existing email dispatcher:

```ts
import { dispatchTransactionalEmail } from '@/lib/email-dispatcher';
await dispatchTransactionalEmail({
    tenantUserId: ctx.automation.userId,
    to: cfg.to,
    subject,
    body,
    templateId: cfg.templateId,
});
```

The dispatcher already handles tenant `EmailSettings` (SMTP / Google /
Outlook fan-out) — see `src/lib/definitions.ts#EmailSettings`.

### 7.2 `webhook`

File: `src/lib/automations/actions/webhook.ts`.

Route through the SabNode outbound webhook dispatcher (TBD module —
`src/lib/webhook-dispatcher.ts` is the proposed home). It must:

- Sign requests with the tenant's webhook secret.
- Retry with exponential backoff on 5xx / network errors.
- Dead-letter to `crm_outbound_webhook_dlq` after N retries.
- Honour the tenant rate limit.

Until that lands the workflow step itself still retries via Workflow
DevKit, but there's no signing or DLQ.

---

## 8. Installing Workflow DevKit

Workflow DevKit is **not yet installed**. To activate durable execution:

```bash
npm install workflow @workflow/next
```

Then register the framework integration per `node_modules/workflow/docs/getting-started/next.mdx`
(typically `withWorkflow` in `next.config.js`). Until this is done,
`startAutomationRun` returns `{ durable: false }` and the run log is
marked `workflow_devkit_missing`. Triggers still emit, actions still
log — but nothing is durably retried.

---

## 9. Safety contract — do not break this

- **Every** `dispatchAutomations(...)` call MUST be wrapped in a
  try/catch in the calling action. A failing automation must NEVER break
  a user-facing CRUD operation.
- **Default `isEnabled: false`** for new automations. Authors opt in
  explicitly from the UI.
- Sensitive fields (`_id`, `userId`, `createdAt`, `lineage`, `audit`)
  are rejected by `update_field` even if an automation tries.
- Workflow runs are per-tenant (filtered by `userId` in `loadEligibleAutomations`).
