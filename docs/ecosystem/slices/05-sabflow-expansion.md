## 05. SabFlow Expansion

1. Add a `recipes/` registry under `src/lib/sabflow/forge/` that ships pre-built CRM-lead → WhatsApp-welcome flows wired through `whatsapp/client.ts`.
2. Seed an abandoned-cart recipe in `src/lib/sabflow/forge/blocks/` chaining cart-event triggers to a Twilio SMS retry block via `forge/blocks/twilio.ts`.
3. Ship an ad-spend-alert recipe that polls the ads module and posts to Slack using the existing `src/lib/sabflow/forge/blocks/slack.ts` block adapter.
4. Register a CRM-stage-change trigger in `src/lib/sabflow/triggers/scheduleRegistry.ts` so flows can subscribe to deal pipeline transitions.
5. Add a `triggers/eventBus.ts` companion to `scheduleRegistry.ts` that fans Mongo change-streams into SabFlow trigger nodes for new-contact events.
6. Wire a payment-received trigger in `src/lib/sabflow/payments/stripe.ts` that calls `engine/executeFlow.ts` with the Stripe webhook payload as input.
7. Extend `src/lib/sabflow/engine/runWithRetry.ts` to expose exponential backoff with jitter and persist attempt counters into `engine/types.ts` execution state.
8. Add a `wait-for-event` block under `src/lib/sabflow/forge/blocks/` that suspends executions in `execution/engine.ts` until a matching event arrives.
9. Build a recipes browser page at `src/app/sabflow/recipes/` that lists registry entries from `forge/registry.ts` with one-click clone into the user's workspace.
10. Add module-tagging metadata to `forge/types.ts` so recipes filter by Wachat, CRM, SEO, SabChat in the new browser UI.
11. Implement a `triggers/multiTrigger.ts` resolver letting one workflow listen on multiple sources, persisted in `forge/registry.ts` per-flow definitions.
12. Add an error-routing fallback path in `src/lib/sabflow/engine/errorRouting.ts` that forwards failed executions to a per-workspace dead-letter queue collection.
13. Persist DLQ entries through `src/lib/sabflow/db.ts` with replay metadata so the upcoming debugger can re-run failed nodes verbatim.
14. Add a replay endpoint in `src/app/api/sabflow/executions/[id]/replay/route.ts` that rehydrates `engine/executeFlow.ts` from a stored run snapshot.
15. Extend `src/lib/sabflow/debug/instrumentation.ts` to capture per-block input/output/timing into `debug/store.ts` for step-through replay.
16. Build a debugger UI under `src/components/sabflow/debugger/` that streams `debug/store.ts` events over SSE for live step-through viewing.
17. Add workflow versioning fields (`version`, `parentVersionId`) to `src/lib/sabflow/types.ts` and persist them through `src/lib/sabflow/db.ts` saves.
18. Implement a diff-aware version restore in `src/lib/sabflow/diff.ts` so reverting a workflow uses existing diff machinery instead of overwrite.
19. Add an A/B-split block to `src/lib/sabflow/forge/blocks/` that uses a stable hash of execution input to deterministically route through `engine/getNextGroup.ts`.
20. Track A/B variant outcomes in `src/lib/sabflow/debug/store.ts` so analytics dashboards can attribute conversions back to a flow branch.
21. Add a sub-workflow invoke block in `src/lib/sabflow/forge/blocks/` that calls `engine/executeFlow.ts` recursively with isolated `execution/useNodeContext.ts` scope.
22. Guard sub-workflow recursion depth in `src/lib/sabflow/engine/executeFlow.ts` using an env-configurable limit shared via `engine/types.ts`.
23. Expose every workflow as a REST endpoint by adding `src/app/api/sabflow/workflows/[id]/invoke/route.ts` that bridges into `engine/executeFlow.ts`.
24. Sign workflow-as-API requests with HMAC validated in `src/lib/sabflow/credentials/encryption.ts` so external callers can authenticate without leaking keys.
25. Add a human-approval block in `src/lib/sabflow/forge/blocks/` that pauses execution and persists a pending-approval doc through `src/lib/sabflow/db.ts`.
26. Surface pending approvals in a `src/app/sabflow/inbox/` page so reviewers can approve or reject and resume `execution/engine.ts` runs.
27. Expand `src/lib/sabflow/engine/evaluateCondition.ts` to delegate complex predicates to the n8n `expression.ts` engine for parity with `n8n/workflow-data-proxy.ts`.
28. Add a switch block under `src/lib/sabflow/forge/blocks/` enabling N-way conditional branching evaluated by `engine/evaluateCondition.ts`.
29. Extend `src/lib/sabflow/triggers/cronParser.ts` to support timezone-aware schedules per workspace stored in `src/lib/sabflow/workspaces/db.ts`.
30. Add durable cron persistence so a restart rehydrates pending fires from `triggers/scheduleRegistry.ts` via the `src/lib/sabflow/storage/` adapter.
31. Build a workflow-templates marketplace under `src/app/sabflow/marketplace/` backed by a public `forge/registry.ts` shard with author and rating fields.
32. Allow installing marketplace templates by cloning into a workspace through `src/lib/sabflow/workspaces/permissions.ts` with role checks.
33. Add a `src/lib/sabflow/analytics/` module aggregating run counts, p50/p95 durations, and failure rate from `debug/store.ts` execution traces.
34. Render the analytics in `src/components/sabflow/analytics/` with per-workflow and per-block panels feeding off the new aggregator.
35. Add idempotency keys to `engine/executeFlow.ts` start points so duplicate triggers from `triggers/scheduleRegistry.ts` collapse into one run.
36. Introduce a circuit-breaker in `engine/runWithRetry.ts` that trips after consecutive failures and routes future invocations to `engine/errorRouting.ts`.
37. Add credential-rotation hooks in `src/lib/sabflow/credentials/db.ts` that re-encrypt at rest via `credentials/encryption.ts` on a schedule.
38. Expose workflow-level RBAC through `src/lib/sabflow/workspaces/permissions.ts` so publish, edit, and run rights split cleanly per role.
39. Add a `src/lib/sabflow/quotas.ts` module that meters executions per workspace and rejects runs exceeding plan limits before `engine/executeFlow.ts` starts.
40. Stream every execution into a per-workspace audit log via `src/lib/sabflow/db.ts` with input redaction handled by `inputs/formatters.ts`.
41. Build a federated trigger gateway under `src/lib/sabflow/triggers/external/` accepting webhooks from Wachat, CRM, SEO, SabChat with a unified schema.
42. Add a `src/lib/sabflow/n8n/sandbox/` policy layer wrapping `n8n/expression-sandboxing.ts` to forbid network and FS access in untrusted expressions.
43. Promote the n8n adapter at `src/lib/sabflow/n8n/adapter.ts` to support partial executions so the debugger can resume mid-graph from a saved checkpoint.
44. Expose a workflow-as-MCP-tool bridge in `src/lib/sabflow/n8n/tool-helpers.ts` so AI agents can call any published flow as a tool.
45. Add multi-region execution affinity tags in `engine/types.ts` so heavy flows pin to a worker pool defined in `src/lib/sabflow/storage/adapter.ts`.
46. Ship a workflow-cost simulator under `src/lib/sabflow/forge/` that pre-runs a flow against fixtures and predicts credit usage before publish.
47. Add a `src/lib/sabflow/marketplace/revenue.ts` module enabling paid templates with revenue share routed through `payments/stripe.ts` Connect.
48. Build a low-code expression editor in `src/components/sabflow/expressions/` that compiles to the verbatim `n8n/expression.ts` syntax for runtime parity.
49. Introduce a workflow-of-workflows orchestrator in `src/lib/sabflow/engine/` that schedules graph-of-graphs across regions using DAG metadata in `engine/types.ts`.
50. Open SabFlow as a public platform by exposing the registry over a documented API at `src/app/api/sabflow/public/v1/` with OAuth scopes from `credentials/`.
