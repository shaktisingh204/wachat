# ADR — SabFlow Executor Rust Error Taxonomy

**Status:** Accepted
**Date:** 2026-05-18
**Phase:** Track B Phase C.2 — sub-task #5
**Companion:** `src/lib/sabflow/executor/errors.ts`, `rust/crates/sabflow-nodes/src/errors.rs`

---

## 1. Why this exists

SabFlow's executor runs the same workflow JSON on either a Node worker or a Rust worker. Workflows ship `Error Trigger` nodes that branch on **error code**, audit logs persist the **error code**, and retry policy is keyed on the **error code**. If the Rust side and the Node side disagree about the shape, name, or meaning of any error, an `n8n` workflow ported into SabFlow silently changes behaviour the moment the Rust worker picks up the job. That is unacceptable. This ADR pins the wire-compatible Rust mirror of `src/lib/sabflow/executor/errors.ts`: a closed enum (`ExecutorError`) whose every variant serialises to the **exact** JSON shape `toWireError()` produces on the TS side, a registry of **stable string codes** (`node.api.401`, `node.op.missing_param`, `credentials.missing`, …) that the Error-Trigger node and audit consumers match against, and an executable parity-test suite (`rust/crates/sabflow-nodes/tests/error_parity.rs`) that prevents drift. Codes are **append-only**: once a code ships it never changes meaning or disappears — only new codes land at the bottom. New variants likewise land at the bottom of `ExecutorErrorCode` so old payloads keep parsing. This is the public wire contract; everything downstream — dispatcher retry, observability span attributes, plan-gate-aware audit entries — keys off it.

## 2. Cross-reference — TS variant ↔ Rust variant

| TS class (`src/lib/sabflow/executor/errors.ts`) | Rust variant (`rust/crates/sabflow-nodes/src/errors.rs`) | Top-level wire `code` |
|---|---|---|
| `ExecutorError` (base / catch-all) | `ExecutorError::Generic` | `EXECUTOR_GENERIC` |
| `NodeApiError` | `ExecutorError::NodeApi { http_status, body, retryable, retry_after, url, method }` | `NODE_API` |
| `NodeOperationError` | `ExecutorError::NodeOperation { reason, details, item_index, run_index }` | `NODE_OPERATION` |
| *(n8n parity)* `WorkflowOperationError` | `ExecutorError::WorkflowOperation { reason, blocking }` | `WORKFLOW_OPERATION` |
| `ExpressionError` | `ExecutorError::Expression { expression, position }` | `EXPRESSION` |
| `CredentialsError` | `ExecutorError::Credentials { failure, credential_id, credential_type }` | `CREDENTIALS` |
| `ExecutionTimeoutError` | `ExecutorError::ExecutionTimeout { scope, timeout_ms, elapsed_ms }` | `EXECUTION_TIMEOUT` |
| `ResourceLimitError` | `ExecutorError::ResourceLimit { resource, kind, limit, observed }` | `RESOURCE_LIMIT` |
| `WorkflowValidationError` | `ExecutorError::WorkflowValidation { issues }` | `WORKFLOW_VALIDATION` |
| `SubworkflowError` | `ExecutorError::Subworkflow { sub_workflow_id, sub_execution_id, inner_error }` | `SUBWORKFLOW` |
| *(executor sentinel)* `continueOnFail` branch marker | `ExecutorError::ContinueOnFailMarker { node_id, wrapped }` | `CONTINUE_ON_FAIL` |

`WorkflowOperationError` is the n8n class we ship parity with even though the TS side currently routes it through `ExecutorError` with a `code` override; the Rust side keeps it as its own variant so the IPC layer can stay symmetrical. `ContinueOnFailMarker` is a **sentinel**, not a real failure — the dispatcher unwraps it and routes the wrapped wire payload onto the node's `error` output instead of propagating up the call stack. `CredentialsError` was first shipped in Phase B.5 (`src/lib/sabflow/executor/credentials/resolver.ts`); this ADR references that shape, does not re-author it.

## 3. Stable-code registry

Granular sub-codes ride inside `details.code`. The coarse top-level `code` is the variant; the granular sub-code is what `Error Trigger` matches against.

### 3.1 Top-level wire codes

| Code | Meaning |
|---|---|
| `EXECUTOR_GENERIC` | Catch-all — try not to use. |
| `NODE_API` | Upstream API failure from a node. |
| `NODE_OPERATION` | Deterministic node-author / user mistake. |
| `WORKFLOW_OPERATION` | Workflow-level operational fault. |
| `EXPRESSION` | Expression-engine failure. |
| `CREDENTIALS` | Credential lookup / unwrap / refresh failure. |
| `EXECUTION_TIMEOUT` | Node- or workflow-level timeout exceeded. |
| `RESOURCE_LIMIT` | Memory / CPU / concurrency / plan-quota cap. |
| `WORKFLOW_VALIDATION` | Workflow doc / IR failed pre-flight checks. |
| `SUBWORKFLOW` | A sub-workflow execution failed; inner wire error attached. |
| `CONTINUE_ON_FAIL` | Sentinel for the executor `continueOnFail` branch. |

### 3.2 Granular sub-codes (the Error-Trigger contract)

| Family | Codes |
|---|---|
| `NodeApi` (HTTP-keyed) | `node.api.400`, `node.api.401`, `node.api.403`, `node.api.404`, `node.api.408`, `node.api.409`, `node.api.422`, `node.api.429`, `node.api.5xx`, `node.api.unknown` |
| `NodeOperation` | `node.op.bad_param`, `node.op.missing_param`, `node.op.type_mismatch`, `node.op.unsupported`, `node.op.other` |
| `WorkflowOperation` | `workflow.op.canceled`, `workflow.op.paused`, `workflow.op.deadlock`, `workflow.op.fatal` |
| `Credentials` (Phase B.5) | `credentials.missing`, `credentials.denied`, `credentials.decrypt_failed`, `credentials.refresh_failed` |
| `ContinueOnFail` sentinel | `continue_on_fail.marker` |

The four `credentials.*` codes match Phase B.5's credential-resolver outcomes (`resolver.ts` returns `reason: 'missing' | 'invalid'`, `scoping.ts` returns `denied`, `crypto.ts` returns the decrypt-failed signal, `oauth2-refresh.ts` returns the refresh-failed signal). When the Rust side serialises, `Denied` and `DecryptFailed` both map to the TS `reason: 'invalid'` and `RefreshFailed` maps to `reason: 'expired'` for cross-compat — the granular sub-code under `details.code` carries the precise classification.

### 3.3 Retryability rules

| Variant | Retryable? |
|---|---|
| `NodeApi` | `true` for 5xx / 429 / 408; `false` otherwise (override via `retryable: Some(_)`). |
| `NodeOperation` | Never. |
| `WorkflowOperation` | Only `Deadlock`. |
| `Expression` | Never. |
| `Credentials` | Never (user must re-auth). |
| `ExecutionTimeout` | Always. |
| `ResourceLimit` | Only when `kind == "transient"`. |
| `WorkflowValidation` | Never. |
| `Subworkflow` | Defers to `inner_error.retryable`. |
| `ContinueOnFailMarker` | Never (it's a sentinel, not a failure). |
| `Generic` | Never (fail-closed). |

These rules match the TS `isRetryable()` in `src/lib/sabflow/executor/errors.ts` line-for-line; the parity tests assert it.

## 4. Backwards-compatibility rules

1. **Codes are append-only.** Once a code (top-level or granular sub-code) has shipped on `main`, it must never be removed or repurposed. Renaming counts as remove+add. New codes always land at the bottom of their list in `errors.rs::codes` and in `ExecutorErrorCode`.
2. **Variants are append-only.** New `ExecutorError` variants land at the bottom of the enum. Old serialised payloads must continue to parse via `from_wire()` (unknown top-level codes degrade to `Generic`, unknown sub-codes degrade to the variant default — `NodeOperationReason::Other`, `node.api.unknown`, etc.).
3. **Field additions are additive.** New fields on an existing variant must be `Option` so old payloads (without the field) still deserialise. Removing a field is a breaking change and requires a new variant.
4. **TS ↔ Rust changes ship together.** A change to the wire contract requires synchronous edits to `src/lib/sabflow/executor/errors.ts` (TS) and `rust/crates/sabflow-nodes/src/errors.rs` (Rust) **plus** an updated test in `rust/crates/sabflow-nodes/tests/error_parity.rs`. CI must show all three changed in the same commit; a one-sided change is rejected at review.
5. **Audit log is the source of truth.** Phase B.5's audit log persists the stable code; any rename / removal would break replay of historical executions. This rule has no escape hatch.

## 5. Follow-ups

- Phase C.3 (dispatcher) consumes `ExecutorError::is_retryable()` directly to drive Bull retry decisions; no separate retry table.
- Phase C.4 (observability) records the stable sub-code as an OTEL span attribute `sabflow.error.code` so dashboards can group by it without parsing message text.
- The placeholder crate `rust/crates/sabflow-executor/errors/` (scaffold from Phase B.1) will re-export this taxonomy via `pub use sabflow_nodes::errors::*` rather than duplicate it. The actual error definitions live in one place: `rust/crates/sabflow-nodes/src/errors.rs`.
