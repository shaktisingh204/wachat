//! # SabFlow Executor — Error Taxonomy (Rust side)
//!
//! Track B Phase C.2 sub-task #5: Rust mirror of the TypeScript executor
//! error taxonomy at `src/lib/sabflow/executor/errors.ts`.
//!
//! ## Why a second module?
//!
//! The sibling [`crate::error`] module hosts the local-only `NodeError`
//! enum used by built-in node implementations to short-circuit out of a
//! single node invocation. That is fine for in-crate use but does **not**
//! match the wire shape n8n workflows expect.
//!
//! This module hosts [`ExecutorError`] — the wire-compatible Rust dual of
//! the TS `ExecutorError` discriminated union. Every variant here maps
//! 1:1 with an n8n-shaped error class (`NodeApiError`, `NodeOperationError`,
//! `WorkflowOperationError`, etc.) and carries a stable string [`code`]
//! that workflow `Error Trigger` nodes match against.
//!
//! ## Wire format
//!
//! Serialised via `serde` into a JSON object that matches the TS
//! [`WireError`](../../../../../../../src/lib/sabflow/executor/errors.ts)
//! shape **verbatim**:
//!
//! ```json
//! {
//!   "code": "NODE_API",
//!   "message": "HTTP 502 from upstream",
//!   "retryable": true,
//!   "httpStatus": 502,
//!   "nodeId": "node-1",
//!   "nodeType": "n8n-nodes-base.httpRequest",
//!   "workflowId": "wf-1",
//!   "executionId": "exec-1",
//!   "details": { "retryAfter": "30", "url": "https://api.example.com", "method": "GET" }
//! }
//! ```
//!
//! The Node side reconstructs the typed error via `fromWireError(wire)`.
//!
//! ## Stable codes registry
//!
//! See [`codes`] — the public contract that the Error-Trigger node and
//! audit-log consumers match against. These codes are **append-only**:
//! once shipped, a code's meaning never changes (see ADR §4).
//!
//! [`code`]: ExecutorError::code

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use thiserror::Error;

/* ------------------------------------------------------------------ */
/* Stable code registry                                                */
/* ------------------------------------------------------------------ */

/// Stable string codes that survive IPC between Node and the Rust
/// executor. Append-only — once shipped, never repurposed.
///
/// Granular sub-codes (e.g. `node.api.401`, `node.op.bad_param`,
/// `credentials.missing`) are the public contract that workflow
/// `Error Trigger` nodes match against. The top-level wire `code` field
/// is the coarse [`ExecutorErrorCode`]; sub-codes ride in `details.code`.
pub mod codes {
    // --- Coarse wire codes (top-level `code`) -------------------------
    pub const EXECUTOR_GENERIC: &str = "EXECUTOR_GENERIC";
    pub const NODE_API: &str = "NODE_API";
    pub const NODE_OPERATION: &str = "NODE_OPERATION";
    pub const WORKFLOW_OPERATION: &str = "WORKFLOW_OPERATION";
    pub const EXPRESSION: &str = "EXPRESSION";
    pub const CREDENTIALS: &str = "CREDENTIALS";
    pub const EXECUTION_TIMEOUT: &str = "EXECUTION_TIMEOUT";
    pub const RESOURCE_LIMIT: &str = "RESOURCE_LIMIT";
    pub const WORKFLOW_VALIDATION: &str = "WORKFLOW_VALIDATION";
    pub const SUBWORKFLOW: &str = "SUBWORKFLOW";
    pub const CONTINUE_ON_FAIL: &str = "CONTINUE_ON_FAIL";

    // --- Granular sub-codes (ride in `details.code`) -----------------
    // NodeApiError sub-codes — HTTP status keyed.
    pub const NODE_API_400: &str = "node.api.400";
    pub const NODE_API_401: &str = "node.api.401";
    pub const NODE_API_403: &str = "node.api.403";
    pub const NODE_API_404: &str = "node.api.404";
    pub const NODE_API_408: &str = "node.api.408";
    pub const NODE_API_409: &str = "node.api.409";
    pub const NODE_API_422: &str = "node.api.422";
    pub const NODE_API_429: &str = "node.api.429";
    pub const NODE_API_5XX: &str = "node.api.5xx";
    pub const NODE_API_UNKNOWN: &str = "node.api.unknown";

    // NodeOperationError sub-codes — deterministic node-author / user mistakes.
    pub const NODE_OP_BAD_PARAM: &str = "node.op.bad_param";
    pub const NODE_OP_MISSING_PARAM: &str = "node.op.missing_param";
    pub const NODE_OP_TYPE_MISMATCH: &str = "node.op.type_mismatch";
    pub const NODE_OP_UNSUPPORTED: &str = "node.op.unsupported";
    pub const NODE_OP_OTHER: &str = "node.op.other";

    // WorkflowOperationError sub-codes — workflow-level operational faults.
    pub const WF_OP_CANCELED: &str = "workflow.op.canceled";
    pub const WF_OP_PAUSED: &str = "workflow.op.paused";
    pub const WF_OP_DEADLOCK: &str = "workflow.op.deadlock";
    pub const WF_OP_FATAL: &str = "workflow.op.fatal";

    // CredentialsError sub-codes — owned by Phase B.5, mirrored here.
    pub const CRED_MISSING: &str = "credentials.missing";
    pub const CRED_DENIED: &str = "credentials.denied";
    pub const CRED_DECRYPT_FAILED: &str = "credentials.decrypt_failed";
    pub const CRED_REFRESH_FAILED: &str = "credentials.refresh_failed";

    // ContinueOnFail sentinel — branch marker, not a real failure.
    pub const CONTINUE_ON_FAIL_MARKER: &str = "continue_on_fail.marker";
}

/// Coarse top-level wire codes — the value of the `code` JSON field.
///
/// Append-only. New variants land at the bottom. Removal or rename is a
/// breaking change to the wire contract (see ADR §4).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ExecutorErrorCode {
    #[serde(rename = "EXECUTOR_GENERIC")]
    ExecutorGeneric,
    #[serde(rename = "NODE_API")]
    NodeApi,
    #[serde(rename = "NODE_OPERATION")]
    NodeOperation,
    #[serde(rename = "WORKFLOW_OPERATION")]
    WorkflowOperation,
    #[serde(rename = "EXPRESSION")]
    Expression,
    #[serde(rename = "CREDENTIALS")]
    Credentials,
    #[serde(rename = "EXECUTION_TIMEOUT")]
    ExecutionTimeout,
    #[serde(rename = "RESOURCE_LIMIT")]
    ResourceLimit,
    #[serde(rename = "WORKFLOW_VALIDATION")]
    WorkflowValidation,
    #[serde(rename = "SUBWORKFLOW")]
    Subworkflow,
    #[serde(rename = "CONTINUE_ON_FAIL")]
    ContinueOnFail,
}

impl ExecutorErrorCode {
    /// The string literal — same value [`codes`] exposes.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::ExecutorGeneric => codes::EXECUTOR_GENERIC,
            Self::NodeApi => codes::NODE_API,
            Self::NodeOperation => codes::NODE_OPERATION,
            Self::WorkflowOperation => codes::WORKFLOW_OPERATION,
            Self::Expression => codes::EXPRESSION,
            Self::Credentials => codes::CREDENTIALS,
            Self::ExecutionTimeout => codes::EXECUTION_TIMEOUT,
            Self::ResourceLimit => codes::RESOURCE_LIMIT,
            Self::WorkflowValidation => codes::WORKFLOW_VALIDATION,
            Self::Subworkflow => codes::SUBWORKFLOW,
            Self::ContinueOnFail => codes::CONTINUE_ON_FAIL,
        }
    }
}

/* ------------------------------------------------------------------ */
/* Wire payload                                                        */
/* ------------------------------------------------------------------ */

/// Serialised form of an [`ExecutorError`] — what the Rust crate emits
/// over IPC and what the Node side ships in API responses.
///
/// Field names use `camelCase` so the JSON shape matches the TS
/// `WireError` interface verbatim.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WireError {
    pub code: ExecutorErrorCode,
    pub message: String,
    pub retryable: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub http_status: Option<u16>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub node_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub node_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub workflow_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub execution_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<BTreeMap<String, serde_json::Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stack: Option<String>,
}

/* ------------------------------------------------------------------ */
/* Sub-payload kinds                                                   */
/* ------------------------------------------------------------------ */

/// Reason a credential lookup failed. Mirrors the TS
/// `CredentialsError.reason` union but split into four canonical
/// sub-variants that match Phase B.5's credential resolver outcomes.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CredentialFailure {
    /// No credential bound for the node, or bound id no longer exists.
    Missing,
    /// RBAC / scope rejected access (Phase B.5 `scoping.ts`).
    Denied,
    /// KMS unwrap failed or DEK mismatch.
    DecryptFailed,
    /// OAuth2 refresh attempt failed (token store rejected the refresh).
    RefreshFailed,
}

impl CredentialFailure {
    pub fn code(self) -> &'static str {
        match self {
            Self::Missing => codes::CRED_MISSING,
            Self::Denied => codes::CRED_DENIED,
            Self::DecryptFailed => codes::CRED_DECRYPT_FAILED,
            Self::RefreshFailed => codes::CRED_REFRESH_FAILED,
        }
    }
}

/// Workflow-level operational fault classification.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WorkflowFaultKind {
    Canceled,
    Paused,
    Deadlock,
    Fatal,
}

impl WorkflowFaultKind {
    pub fn code(self) -> &'static str {
        match self {
            Self::Canceled => codes::WF_OP_CANCELED,
            Self::Paused => codes::WF_OP_PAUSED,
            Self::Deadlock => codes::WF_OP_DEADLOCK,
            Self::Fatal => codes::WF_OP_FATAL,
        }
    }
}

/// Why a [`ExecutorError::NodeOperation`] fired.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NodeOperationReason {
    BadParam,
    MissingParam,
    TypeMismatch,
    Unsupported,
    Other,
}

impl NodeOperationReason {
    pub fn code(self) -> &'static str {
        match self {
            Self::BadParam => codes::NODE_OP_BAD_PARAM,
            Self::MissingParam => codes::NODE_OP_MISSING_PARAM,
            Self::TypeMismatch => codes::NODE_OP_TYPE_MISMATCH,
            Self::Unsupported => codes::NODE_OP_UNSUPPORTED,
            Self::Other => codes::NODE_OP_OTHER,
        }
    }
}

/// Common provenance fields every variant carries. Kept in one place so
/// adding a new field is a single struct change.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ErrorContext {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub node_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub node_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub workflow_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub execution_id: Option<String>,
}

/* ------------------------------------------------------------------ */
/* The error enum                                                      */
/* ------------------------------------------------------------------ */

/// Wire-compatible Rust mirror of the TS `ExecutorError` hierarchy.
///
/// Use [`ExecutorError::to_wire`] to serialise into the Node-side
/// `WireError` shape; use [`ExecutorError::from_wire`] for the reverse.
#[derive(Debug, Clone, Error, PartialEq)]
pub enum ExecutorError {
    /// A 3rd-party API called by a node failed — n8n's `NodeApiError`.
    #[error("upstream API error: HTTP {http_status:?} — {message}")]
    NodeApi {
        message: String,
        /// Upstream HTTP status, when known.
        http_status: Option<u16>,
        /// Raw body / parsed envelope from the upstream — passed through.
        body: Option<serde_json::Value>,
        /// `true` for 5xx / 429 / 408; `false` for 4xx; `None` defers to
        /// the auto-rule keyed on `http_status`.
        retryable: Option<bool>,
        /// `Retry-After` header value (seconds or HTTP-date string).
        retry_after: Option<String>,
        /// Upstream URL — strip secrets before constructing.
        url: Option<String>,
        method: Option<String>,
        context: ErrorContext,
    },

    /// Bad params / schema violation / deterministic node-author or
    /// user mistake — n8n's `NodeOperationError`. NEVER retryable.
    #[error("node operation error ({reason:?}): {message}")]
    NodeOperation {
        message: String,
        reason: NodeOperationReason,
        details: Option<serde_json::Value>,
        item_index: Option<usize>,
        run_index: Option<usize>,
        context: ErrorContext,
    },

    /// Workflow-level operational fault — n8n's `WorkflowOperationError`.
    /// `blocking` controls whether the executor halts the whole run or
    /// just the offending branch.
    #[error("workflow operation error ({reason:?}): {message}")]
    WorkflowOperation {
        message: String,
        reason: WorkflowFaultKind,
        /// `true` halts the whole execution; `false` only the branch.
        blocking: bool,
        context: ErrorContext,
    },

    /// Expression engine failure — parse error, type mismatch, missing
    /// reference. NEVER retryable.
    #[error("expression error: {message}")]
    Expression {
        message: String,
        expression: Option<String>,
        position: Option<usize>,
        context: ErrorContext,
    },

    /// Credential resolution / unwrap / refresh failure. Owned by Phase
    /// B.5; reproduced here so this enum is closed over the wire shape.
    #[error("credentials error ({failure:?}): {message}")]
    Credentials {
        message: String,
        failure: CredentialFailure,
        credential_id: Option<String>,
        credential_type: Option<String>,
        context: ErrorContext,
    },

    /// Workflow- or node-level timeout exceeded.
    #[error("execution timeout: {message}")]
    ExecutionTimeout {
        message: String,
        /// `"workflow"` or `"node"`.
        scope: Option<String>,
        timeout_ms: Option<u64>,
        elapsed_ms: Option<u64>,
        context: ErrorContext,
    },

    /// Memory / CPU / concurrency / plan-quota cap exceeded.
    #[error("resource limit: {message}")]
    ResourceLimit {
        message: String,
        resource: Option<String>,
        /// `"transient"` (retry helps) vs `"permanent"` (only an upgrade does).
        kind: Option<String>,
        limit: Option<u64>,
        observed: Option<u64>,
        context: ErrorContext,
    },

    /// Workflow IR / JSON failed pre-flight validation. NEVER retryable.
    #[error("workflow validation: {message}")]
    WorkflowValidation {
        message: String,
        issues: Vec<serde_json::Value>,
        context: ErrorContext,
    },

    /// A sub-workflow execution failed; wraps the inner wire error so
    /// callers can decide retry semantics from the inner cause.
    #[error("sub-workflow failed: {message}")]
    Subworkflow {
        message: String,
        sub_workflow_id: Option<String>,
        sub_execution_id: Option<String>,
        inner_error: Option<Box<WireError>>,
        context: ErrorContext,
    },

    /// Sentinel the executor branches on when a node opts into
    /// `continueOnFail`. Not a real failure — the dispatcher converts
    /// this into a routed item on the node's `error` output instead of
    /// propagating it up the call stack.
    #[error("continue-on-fail marker (node={node_id:?})")]
    ContinueOnFailMarker {
        node_id: String,
        /// The error that *would* have propagated had `continueOnFail`
        /// been false. Carried through so audit logs still see it.
        wrapped: Box<WireError>,
    },

    /// Catch-all for anything we don't classify yet. Try hard not to
    /// reach for this — it's the wire equivalent of `unknown`.
    #[error("executor error: {0}")]
    Generic(String),
}

impl ExecutorError {
    /// Top-level wire code for this variant.
    pub fn code(&self) -> ExecutorErrorCode {
        match self {
            Self::NodeApi { .. } => ExecutorErrorCode::NodeApi,
            Self::NodeOperation { .. } => ExecutorErrorCode::NodeOperation,
            Self::WorkflowOperation { .. } => ExecutorErrorCode::WorkflowOperation,
            Self::Expression { .. } => ExecutorErrorCode::Expression,
            Self::Credentials { .. } => ExecutorErrorCode::Credentials,
            Self::ExecutionTimeout { .. } => ExecutorErrorCode::ExecutionTimeout,
            Self::ResourceLimit { .. } => ExecutorErrorCode::ResourceLimit,
            Self::WorkflowValidation { .. } => ExecutorErrorCode::WorkflowValidation,
            Self::Subworkflow { .. } => ExecutorErrorCode::Subworkflow,
            Self::ContinueOnFailMarker { .. } => ExecutorErrorCode::ContinueOnFail,
            Self::Generic(_) => ExecutorErrorCode::ExecutorGeneric,
        }
    }

    /// Stable granular sub-code — what `Error Trigger` nodes match.
    /// Always present; for variants without a sub-classification this
    /// returns the same string as [`Self::code`].
    pub fn stable_code(&self) -> &'static str {
        match self {
            Self::NodeApi { http_status, .. } => match *http_status {
                Some(400) => codes::NODE_API_400,
                Some(401) => codes::NODE_API_401,
                Some(403) => codes::NODE_API_403,
                Some(404) => codes::NODE_API_404,
                Some(408) => codes::NODE_API_408,
                Some(409) => codes::NODE_API_409,
                Some(422) => codes::NODE_API_422,
                Some(429) => codes::NODE_API_429,
                Some(s) if (500..600).contains(&s) => codes::NODE_API_5XX,
                _ => codes::NODE_API_UNKNOWN,
            },
            Self::NodeOperation { reason, .. } => reason.code(),
            Self::WorkflowOperation { reason, .. } => reason.code(),
            Self::Credentials { failure, .. } => failure.code(),
            Self::Expression { .. } => codes::EXPRESSION,
            Self::ExecutionTimeout { .. } => codes::EXECUTION_TIMEOUT,
            Self::ResourceLimit { .. } => codes::RESOURCE_LIMIT,
            Self::WorkflowValidation { .. } => codes::WORKFLOW_VALIDATION,
            Self::Subworkflow { .. } => codes::SUBWORKFLOW,
            Self::ContinueOnFailMarker { .. } => codes::CONTINUE_ON_FAIL_MARKER,
            Self::Generic(_) => codes::EXECUTOR_GENERIC,
        }
    }

    /// Whether the dispatcher should retry. Same rule set as the TS
    /// `isRetryable()` helper in `src/lib/sabflow/executor/errors.ts`.
    pub fn is_retryable(&self) -> bool {
        match self {
            Self::NodeApi {
                retryable,
                http_status,
                ..
            } => retryable.unwrap_or_else(
                || matches!(http_status, Some(s) if *s >= 500 || *s == 429 || *s == 408),
            ),
            Self::NodeOperation { .. }
            | Self::Credentials { .. }
            | Self::Expression { .. }
            | Self::WorkflowValidation { .. } => false,
            Self::WorkflowOperation { reason, .. } => {
                // Canceled / Paused / Fatal are not retryable; Deadlock
                // sometimes resolves on retry.
                matches!(reason, WorkflowFaultKind::Deadlock)
            }
            Self::ExecutionTimeout { .. } => true,
            Self::ResourceLimit { kind, .. } => kind.as_deref() == Some("transient"),
            Self::Subworkflow { inner_error, .. } => {
                inner_error.as_ref().map(|e| e.retryable).unwrap_or(false)
            }
            Self::ContinueOnFailMarker { .. } => false,
            Self::Generic(_) => false,
        }
    }

    /// Borrow the provenance context.
    pub fn context(&self) -> Option<&ErrorContext> {
        match self {
            Self::NodeApi { context, .. }
            | Self::NodeOperation { context, .. }
            | Self::WorkflowOperation { context, .. }
            | Self::Expression { context, .. }
            | Self::Credentials { context, .. }
            | Self::ExecutionTimeout { context, .. }
            | Self::ResourceLimit { context, .. }
            | Self::WorkflowValidation { context, .. }
            | Self::Subworkflow { context, .. } => Some(context),
            Self::ContinueOnFailMarker { .. } | Self::Generic(_) => None,
        }
    }

    /// Human-readable summary (mirrors `Display`).
    pub fn message(&self) -> String {
        self.to_string()
    }

    /// Serialise into the [`WireError`] shape — exact JSON parity with
    /// the TS `toWireError()` output.
    pub fn to_wire(&self) -> WireError {
        let ctx = self.context().cloned().unwrap_or_default();
        let mut details: BTreeMap<String, serde_json::Value> = BTreeMap::new();
        let mut http_status: Option<u16> = None;
        let message = match self {
            Self::NodeApi {
                message,
                http_status: s,
                body,
                retry_after,
                url,
                method,
                ..
            } => {
                http_status = *s;
                if let Some(b) = body {
                    details.insert("body".into(), b.clone());
                }
                if let Some(r) = retry_after {
                    details.insert("retryAfter".into(), serde_json::Value::String(r.clone()));
                }
                if let Some(u) = url {
                    details.insert("url".into(), serde_json::Value::String(u.clone()));
                }
                if let Some(m) = method {
                    details.insert("method".into(), serde_json::Value::String(m.clone()));
                }
                details.insert(
                    "code".into(),
                    serde_json::Value::String(self.stable_code().into()),
                );
                message.clone()
            }
            Self::NodeOperation {
                message,
                reason,
                details: extra,
                item_index,
                run_index,
                ..
            } => {
                if let Some(i) = item_index {
                    details.insert("itemIndex".into(), serde_json::json!(i));
                }
                if let Some(r) = run_index {
                    details.insert("runIndex".into(), serde_json::json!(r));
                }
                details.insert(
                    "reason".into(),
                    serde_json::to_value(reason).unwrap_or(serde_json::Value::Null),
                );
                if let Some(e) = extra {
                    details.insert("extra".into(), e.clone());
                }
                details.insert(
                    "code".into(),
                    serde_json::Value::String(self.stable_code().into()),
                );
                message.clone()
            }
            Self::WorkflowOperation {
                message,
                reason,
                blocking,
                ..
            } => {
                details.insert(
                    "reason".into(),
                    serde_json::to_value(reason).unwrap_or(serde_json::Value::Null),
                );
                details.insert("blocking".into(), serde_json::json!(*blocking));
                details.insert(
                    "code".into(),
                    serde_json::Value::String(self.stable_code().into()),
                );
                message.clone()
            }
            Self::Expression {
                message,
                expression,
                position,
                ..
            } => {
                if let Some(e) = expression {
                    details.insert("expression".into(), serde_json::Value::String(e.clone()));
                }
                if let Some(p) = position {
                    details.insert("position".into(), serde_json::json!(p));
                }
                details.insert(
                    "code".into(),
                    serde_json::Value::String(self.stable_code().into()),
                );
                message.clone()
            }
            Self::Credentials {
                message,
                failure,
                credential_id,
                credential_type,
                ..
            } => {
                details.insert(
                    "failure".into(),
                    serde_json::to_value(failure).unwrap_or(serde_json::Value::Null),
                );
                if let Some(id) = credential_id {
                    details.insert("credentialId".into(), serde_json::Value::String(id.clone()));
                }
                if let Some(t) = credential_type {
                    details.insert(
                        "credentialType".into(),
                        serde_json::Value::String(t.clone()),
                    );
                }
                // TS expects `reason: 'missing' | 'invalid' | 'expired'`
                // — collapse our 4 sub-variants into that 3-value space
                // for cross-compat. `denied`+`decrypt_failed` → 'invalid';
                // `refresh_failed` → 'expired'; `missing` → 'missing'.
                let ts_reason = match failure {
                    CredentialFailure::Missing => "missing",
                    CredentialFailure::Denied => "invalid",
                    CredentialFailure::DecryptFailed => "invalid",
                    CredentialFailure::RefreshFailed => "expired",
                };
                details.insert("reason".into(), serde_json::Value::String(ts_reason.into()));
                details.insert(
                    "code".into(),
                    serde_json::Value::String(self.stable_code().into()),
                );
                message.clone()
            }
            Self::ExecutionTimeout {
                message,
                scope,
                timeout_ms,
                elapsed_ms,
                ..
            } => {
                if let Some(s) = scope {
                    details.insert("scope".into(), serde_json::Value::String(s.clone()));
                }
                if let Some(t) = timeout_ms {
                    details.insert("timeoutMs".into(), serde_json::json!(t));
                }
                if let Some(e) = elapsed_ms {
                    details.insert("elapsedMs".into(), serde_json::json!(e));
                }
                message.clone()
            }
            Self::ResourceLimit {
                message,
                resource,
                kind,
                limit,
                observed,
                ..
            } => {
                if let Some(r) = resource {
                    details.insert("resource".into(), serde_json::Value::String(r.clone()));
                }
                if let Some(k) = kind {
                    details.insert("kind".into(), serde_json::Value::String(k.clone()));
                }
                if let Some(l) = limit {
                    details.insert("limit".into(), serde_json::json!(l));
                }
                if let Some(o) = observed {
                    details.insert("observed".into(), serde_json::json!(o));
                }
                message.clone()
            }
            Self::WorkflowValidation {
                message, issues, ..
            } => {
                details.insert("issues".into(), serde_json::Value::Array(issues.clone()));
                message.clone()
            }
            Self::Subworkflow {
                message,
                sub_workflow_id,
                sub_execution_id,
                inner_error,
                ..
            } => {
                if let Some(id) = sub_workflow_id {
                    details.insert(
                        "subWorkflowId".into(),
                        serde_json::Value::String(id.clone()),
                    );
                }
                if let Some(id) = sub_execution_id {
                    details.insert(
                        "subExecutionId".into(),
                        serde_json::Value::String(id.clone()),
                    );
                }
                if let Some(inner) = inner_error {
                    details.insert(
                        "innerError".into(),
                        serde_json::to_value(inner.as_ref()).unwrap_or(serde_json::Value::Null),
                    );
                }
                message.clone()
            }
            Self::ContinueOnFailMarker { node_id, wrapped } => {
                details.insert("nodeId".into(), serde_json::Value::String(node_id.clone()));
                details.insert(
                    "wrapped".into(),
                    serde_json::to_value(wrapped.as_ref()).unwrap_or(serde_json::Value::Null),
                );
                details.insert(
                    "code".into(),
                    serde_json::Value::String(self.stable_code().into()),
                );
                format!("continue-on-fail marker (node={node_id})")
            }
            Self::Generic(msg) => msg.clone(),
        };

        WireError {
            code: self.code(),
            message,
            retryable: self.is_retryable(),
            http_status,
            node_id: ctx.node_id.clone(),
            node_type: ctx.node_type.clone(),
            workflow_id: ctx.workflow_id.clone(),
            execution_id: ctx.execution_id.clone(),
            details: if details.is_empty() {
                None
            } else {
                Some(details)
            },
            stack: None,
        }
    }

    /// Reconstruct from a [`WireError`] — inverse of [`Self::to_wire`].
    ///
    /// Unknown / future codes degrade to [`ExecutorError::Generic`] so
    /// rolling out a new variant on one side doesn't crash the other.
    pub fn from_wire(wire: &WireError) -> Self {
        let ctx = ErrorContext {
            node_id: wire.node_id.clone(),
            node_type: wire.node_type.clone(),
            workflow_id: wire.workflow_id.clone(),
            execution_id: wire.execution_id.clone(),
        };
        let details = wire.details.clone().unwrap_or_default();
        let get_str = |k: &str| details.get(k).and_then(|v| v.as_str()).map(String::from);
        let get_u64 = |k: &str| details.get(k).and_then(|v| v.as_u64());

        match wire.code {
            ExecutorErrorCode::NodeApi => Self::NodeApi {
                message: wire.message.clone(),
                http_status: wire.http_status,
                body: details.get("body").cloned(),
                retryable: Some(wire.retryable),
                retry_after: get_str("retryAfter"),
                url: get_str("url"),
                method: get_str("method"),
                context: ctx,
            },
            ExecutorErrorCode::NodeOperation => {
                let reason = details
                    .get("reason")
                    .and_then(|v| serde_json::from_value::<NodeOperationReason>(v.clone()).ok())
                    .unwrap_or(NodeOperationReason::Other);
                Self::NodeOperation {
                    message: wire.message.clone(),
                    reason,
                    details: details.get("extra").cloned(),
                    item_index: details
                        .get("itemIndex")
                        .and_then(|v| v.as_u64())
                        .map(|n| n as usize),
                    run_index: details
                        .get("runIndex")
                        .and_then(|v| v.as_u64())
                        .map(|n| n as usize),
                    context: ctx,
                }
            }
            ExecutorErrorCode::WorkflowOperation => {
                let reason = details
                    .get("reason")
                    .and_then(|v| serde_json::from_value::<WorkflowFaultKind>(v.clone()).ok())
                    .unwrap_or(WorkflowFaultKind::Fatal);
                let blocking = details
                    .get("blocking")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(true);
                Self::WorkflowOperation {
                    message: wire.message.clone(),
                    reason,
                    blocking,
                    context: ctx,
                }
            }
            ExecutorErrorCode::Expression => Self::Expression {
                message: wire.message.clone(),
                expression: get_str("expression"),
                position: details
                    .get("position")
                    .and_then(|v| v.as_u64())
                    .map(|n| n as usize),
                context: ctx,
            },
            ExecutorErrorCode::Credentials => {
                let failure = details
                    .get("failure")
                    .and_then(|v| serde_json::from_value::<CredentialFailure>(v.clone()).ok())
                    .or_else(|| {
                        // Fall back to the 3-value TS `reason` field.
                        details
                            .get("reason")
                            .and_then(|v| v.as_str())
                            .map(|s| match s {
                                "missing" => CredentialFailure::Missing,
                                "expired" => CredentialFailure::RefreshFailed,
                                _ => CredentialFailure::DecryptFailed,
                            })
                    })
                    .unwrap_or(CredentialFailure::Missing);
                Self::Credentials {
                    message: wire.message.clone(),
                    failure,
                    credential_id: get_str("credentialId"),
                    credential_type: get_str("credentialType"),
                    context: ctx,
                }
            }
            ExecutorErrorCode::ExecutionTimeout => Self::ExecutionTimeout {
                message: wire.message.clone(),
                scope: get_str("scope"),
                timeout_ms: get_u64("timeoutMs"),
                elapsed_ms: get_u64("elapsedMs"),
                context: ctx,
            },
            ExecutorErrorCode::ResourceLimit => Self::ResourceLimit {
                message: wire.message.clone(),
                resource: get_str("resource"),
                kind: get_str("kind"),
                limit: get_u64("limit"),
                observed: get_u64("observed"),
                context: ctx,
            },
            ExecutorErrorCode::WorkflowValidation => Self::WorkflowValidation {
                message: wire.message.clone(),
                issues: details
                    .get("issues")
                    .and_then(|v| v.as_array().cloned())
                    .unwrap_or_default(),
                context: ctx,
            },
            ExecutorErrorCode::Subworkflow => {
                let inner_error = details
                    .get("innerError")
                    .and_then(|v| serde_json::from_value::<WireError>(v.clone()).ok())
                    .map(Box::new);
                Self::Subworkflow {
                    message: wire.message.clone(),
                    sub_workflow_id: get_str("subWorkflowId"),
                    sub_execution_id: get_str("subExecutionId"),
                    inner_error,
                    context: ctx,
                }
            }
            ExecutorErrorCode::ContinueOnFail => {
                let wrapped = details
                    .get("wrapped")
                    .and_then(|v| serde_json::from_value::<WireError>(v.clone()).ok())
                    .map(Box::new)
                    .unwrap_or_else(|| {
                        Box::new(WireError {
                            code: ExecutorErrorCode::ExecutorGeneric,
                            message: "(missing wrapped error)".into(),
                            retryable: false,
                            http_status: None,
                            node_id: None,
                            node_type: None,
                            workflow_id: None,
                            execution_id: None,
                            details: None,
                            stack: None,
                        })
                    });
                let node_id = get_str("nodeId").unwrap_or_default();
                Self::ContinueOnFailMarker { node_id, wrapped }
            }
            ExecutorErrorCode::ExecutorGeneric => Self::Generic(wire.message.clone()),
        }
    }
}

/* ------------------------------------------------------------------ */
/* Constructors — sugar to match the TS ergonomics                     */
/* ------------------------------------------------------------------ */

impl ExecutorError {
    /// Construct a [`Self::NodeApi`] from an HTTP status + message.
    pub fn node_api(status: u16, message: impl Into<String>) -> Self {
        Self::NodeApi {
            message: message.into(),
            http_status: Some(status),
            body: None,
            retryable: None,
            retry_after: None,
            url: None,
            method: None,
            context: ErrorContext::default(),
        }
    }

    /// Construct a [`Self::NodeOperation`].
    pub fn node_operation(reason: NodeOperationReason, message: impl Into<String>) -> Self {
        Self::NodeOperation {
            message: message.into(),
            reason,
            details: None,
            item_index: None,
            run_index: None,
            context: ErrorContext::default(),
        }
    }

    /// Construct a [`Self::WorkflowOperation`].
    pub fn workflow_operation(
        reason: WorkflowFaultKind,
        blocking: bool,
        message: impl Into<String>,
    ) -> Self {
        Self::WorkflowOperation {
            message: message.into(),
            reason,
            blocking,
            context: ErrorContext::default(),
        }
    }

    /// Construct a [`Self::Credentials`] failure.
    pub fn credentials(failure: CredentialFailure, message: impl Into<String>) -> Self {
        Self::Credentials {
            message: message.into(),
            failure,
            credential_id: None,
            credential_type: None,
            context: ErrorContext::default(),
        }
    }

    /// Wrap an inner wire error as a continue-on-fail sentinel.
    pub fn continue_on_fail(node_id: impl Into<String>, wrapped: WireError) -> Self {
        Self::ContinueOnFailMarker {
            node_id: node_id.into(),
            wrapped: Box::new(wrapped),
        }
    }
}

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn code_strings_match_registry() {
        assert_eq!(ExecutorErrorCode::NodeApi.as_str(), codes::NODE_API);
        assert_eq!(
            ExecutorErrorCode::ContinueOnFail.as_str(),
            codes::CONTINUE_ON_FAIL
        );
    }

    #[test]
    fn node_api_5xx_is_retryable_by_default() {
        let err = ExecutorError::node_api(502, "Bad Gateway");
        assert!(err.is_retryable());
        assert_eq!(err.stable_code(), codes::NODE_API_5XX);
    }

    #[test]
    fn node_api_4xx_is_not_retryable() {
        let err = ExecutorError::node_api(404, "Not Found");
        assert!(!err.is_retryable());
        assert_eq!(err.stable_code(), codes::NODE_API_404);
    }

    #[test]
    fn node_operation_never_retryable() {
        let err = ExecutorError::node_operation(NodeOperationReason::MissingParam, "no url");
        assert!(!err.is_retryable());
        assert_eq!(err.stable_code(), codes::NODE_OP_MISSING_PARAM);
    }

    #[test]
    fn wire_roundtrip_preserves_classification() {
        let err = ExecutorError::node_api(429, "Too Many Requests");
        let wire = err.to_wire();
        let back = ExecutorError::from_wire(&wire);
        assert_eq!(back.code(), ExecutorErrorCode::NodeApi);
        assert!(back.is_retryable());
    }
}
