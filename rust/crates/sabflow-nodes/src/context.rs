//! Execution context — what each node receives at runtime.

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::sync::{
    Arc,
    atomic::{AtomicU64, Ordering},
};

use crate::error::{NodeError, NodeResult};

/// Re-entrant sub-flow invoker — implemented by the engine (e.g.
/// `sabflow-engine-runtime::FlowEngine`) and surfaced on the
/// [`ExecutionContext`] so the `ExecuteWorkflow` node can call back into a
/// child flow without depending on the engine crate directly (which would
/// otherwise be a dependency cycle — the engine depends on `sabflow-nodes`,
/// not the other way around).
///
/// The `caller_stack` passed in is the chain of workflow ids currently
/// executing.  Implementations are responsible for appending the target id
/// before kicking off the child run, so deeper sub-flows can detect cycles.
#[async_trait]
pub trait SubFlowInvoker: Send + Sync {
    /// Run `workflow_id` with the given input items, returning the child
    /// flow's final output items.
    ///
    /// Implementations must:
    /// - Verify ownership / tenancy (the caller context already carries
    ///   `execution_id`; the engine knows the user / tenant out-of-band).
    /// - Refuse to start the child if `caller_stack` already contains
    ///   `workflow_id` (cycle).  Nodes also pre-check, but the engine is the
    ///   authoritative gate.
    /// - Forward credentials / variables as appropriate.
    async fn invoke_sub_flow(
        &self,
        workflow_id: &str,
        inputs: Vec<Value>,
        caller_stack: Vec<String>,
    ) -> NodeResult<Vec<Value>>;
}

/// Re-entrant wait-resume registrar — implemented by the engine and used by
/// the `Wait` node's `webhook` / `dateTime` resume modes.  The node returns
/// the resume URL / ISO target back to upstream callers via its output item
/// and the engine parks the execution; an external HTTP receiver (or a
/// scheduled tick) reconciles `resume_token` later.
#[async_trait]
pub trait WaitResumer: Send + Sync {
    /// Register an intent-to-resume.  Returns a publicly-callable resume URL
    /// (for webhook mode) or echoes back the registered token (for dateTime
    /// mode).  The engine persists the wait-state so the run survives worker
    /// crashes.
    async fn register_wait(
        &self,
        execution_id: &str,
        mode: WaitMode,
    ) -> NodeResult<WaitRegistration>;
}

/// How a Wait node parks an execution.
#[derive(Debug, Clone)]
pub enum WaitMode {
    /// Block on an HTTP callback to a generated URL.
    Webhook {
        http_method: String,
        path_hint: Option<String>,
    },
    /// Block until the given ISO-8601 instant.
    DateTime { resume_at_iso: String },
}

/// What the engine returns once a wait is registered.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WaitRegistration {
    /// Token / opaque id the engine uses to reconcile the resume event.
    pub resume_token: String,
    /// Publicly-callable URL (webhook mode) or `None` for dateTime mode.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resume_url: Option<String>,
    /// ISO-8601 instant the engine plans to resume at (dateTime mode), or
    /// `None` for webhook mode.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resume_at_iso: Option<String>,
}

/// Items flowing in/out of a node — n8n's `INodeExecutionData[][]` shape.
/// Each item is `{ json, binary? }`.  Outer slice is for items, inner for branches.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct NodeInput {
    /// Items currently flowing through this connection.
    #[serde(default)]
    pub items: Vec<Value>,
}

impl NodeInput {
    pub fn empty() -> Self {
        Self { items: vec![] }
    }
    pub fn one(item: Value) -> Self {
        Self { items: vec![item] }
    }
    pub fn many(items: Vec<Value>) -> Self {
        Self { items }
    }
}

/// What a node returns: a list of branches, each with its items.
/// Most nodes return one branch (`vec![NodeInput { items }]`).
/// IF returns two branches: \[true, false\]. Switch returns N branches.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct NodeOutput {
    pub branches: Vec<NodeInput>,
}

impl NodeOutput {
    pub fn single(items: Vec<Value>) -> Self {
        Self {
            branches: vec![NodeInput { items }],
        }
    }
    pub fn multi(branches: Vec<Vec<Value>>) -> Self {
        Self {
            branches: branches
                .into_iter()
                .map(|items| NodeInput { items })
                .collect(),
        }
    }
    pub fn empty() -> Self {
        Self::default()
    }
}

/// A decrypted credential record passed to nodes via the context.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Credential {
    pub id: String,
    pub credential_type: String,
    /// Decrypted secret fields keyed by credential schema property name.
    pub data: HashMap<String, String>,
}

/// Counters surfaced to the C.1.8 metrics dashboard.
///
/// Cheap, lock-free, shareable across tasks. `Arc<NodeMetrics>` is cloned
/// onto every per-item future so the helper can bump counters without
/// touching the parent context.
#[derive(Debug, Default)]
pub struct NodeMetrics {
    /// Number of per-item failures that were swallowed by
    /// [`crate::continue_on_fail::try_with_continue_on_fail`].
    /// Surfaced verbatim on the executor dashboard (C.1.8).
    pub continue_on_fail_count: AtomicU64,
}

impl NodeMetrics {
    pub fn new() -> Self {
        Self::default()
    }

    /// Atomic increment — safe to call from any tokio task.
    pub fn incr_continue_on_fail(&self) {
        self.continue_on_fail_count.fetch_add(1, Ordering::Relaxed);
    }

    /// Snapshot reader for tests and the metrics endpoint.
    pub fn continue_on_fail_count(&self) -> u64 {
        self.continue_on_fail_count.load(Ordering::Relaxed)
    }
}

/// Runtime context handed to every [`crate::Node::execute`] call.
///
/// This is the canonical Rust-side mirror of n8n's `IExecuteFunctions`.
/// The plan and forward-looking ADRs refer to it as `NodeContext`; the
/// alias is exported alongside so SDK helpers can use the shorter name
/// without breaking the existing call sites.
pub struct ExecutionContext {
    /// Flow / session variables (mutable across the run).
    pub variables: HashMap<String, Value>,
    /// Available credentials, keyed by credential id.
    pub credentials: HashMap<String, Credential>,
    /// Shared HTTP client (rustls, gzip) reused across all nodes.
    pub http: Arc<reqwest::Client>,
    /// Optional MongoDB handle for nodes that need database access.
    pub mongo: Option<sabnode_db::mongo::MongoHandle>,
    /// Trigger payload for the execution (webhook body, manual data, etc.).
    pub trigger_data: Option<Value>,
    /// Items emitted upstream by previous nodes (keyed by block id).
    pub node_outputs: HashMap<String, NodeOutput>,
    /// Execution id — useful for logging and idempotency.
    pub execution_id: String,
    /// Chain of workflow ids currently executing — the workflow that
    /// triggered the run is first, sub-flows pushed on top.  Used by the
    /// `ExecuteWorkflow` node for cycle detection.
    pub caller_stack: Vec<String>,
    /// Optional bridge so `ExecuteWorkflow` can call back into the engine
    /// without a direct dependency on `sabflow-engine-runtime`.
    pub sub_flow_invoker: Option<Arc<dyn SubFlowInvoker>>,
    /// Optional bridge so the `Wait` node can park execution on a webhook /
    /// scheduled-resume — populated by the engine.
    pub wait_resumer: Option<Arc<dyn WaitResumer>>,
    /// Whether this node should swallow per-item errors (n8n continueOnFail).
    pub continue_on_fail: bool,
    /// Shared execution metrics (audit counters for C.1.8 dashboard).
    pub metrics: Arc<NodeMetrics>,
}

/// Alias matching the public name used in the PLAN-sabflow-coverage.md C.2
/// task list and the (pending) `docs/adr/sabflow-executor-rust-errors.md`
/// ADR. Forward-declaration — the SDK helpers prefer this name.
pub type NodeContext = ExecutionContext;

impl ExecutionContext {
    pub fn new(execution_id: String, http: Arc<reqwest::Client>) -> Self {
        Self {
            variables: HashMap::new(),
            credentials: HashMap::new(),
            http,
            mongo: None,
            trigger_data: None,
            node_outputs: HashMap::new(),
            execution_id,
            caller_stack: Vec::new(),
            sub_flow_invoker: None,
            wait_resumer: None,
            continue_on_fail: false,
            metrics: Arc::new(NodeMetrics::default()),
        }
    }
    pub fn with_mongo(mut self, m: sabnode_db::mongo::MongoHandle) -> Self {
        self.mongo = Some(m);
        self
    }
    pub fn with_trigger_data(mut self, v: Value) -> Self {
        self.trigger_data = Some(v);
        self
    }
    pub fn with_variables(mut self, v: HashMap<String, Value>) -> Self {
        self.variables = v;
        self
    }
    pub fn with_credentials(mut self, c: HashMap<String, Credential>) -> Self {
        self.credentials = c;
        self
    }
    pub fn with_caller_stack(mut self, stack: Vec<String>) -> Self {
        self.caller_stack = stack;
        self
    }
    pub fn with_sub_flow_invoker(mut self, inv: Arc<dyn SubFlowInvoker>) -> Self {
        self.sub_flow_invoker = Some(inv);
        self
    }
    pub fn with_wait_resumer(mut self, w: Arc<dyn WaitResumer>) -> Self {
        self.wait_resumer = Some(w);
        self
    }

    /// Mark this dispatch as `continueOnFail`. Builder counterpart to the
    /// `continue_on_fail` field; preferred when constructing a context
    /// outside the runtime (tests, embedded calls).
    pub fn with_continue_on_fail(mut self, on: bool) -> Self {
        self.continue_on_fail = on;
        self
    }

    /// Look up a credential by id — error if missing.
    pub fn credential(&self, id: &str) -> NodeResult<&Credential> {
        self.credentials
            .get(id)
            .ok_or_else(|| NodeError::MissingCredential(id.to_string()))
    }

    /// Get a string field from a node-params object, with substitution.
    pub fn param_str(&self, params: &Value, key: &str) -> NodeResult<String> {
        params
            .get(key)
            .and_then(|v| v.as_str())
            .map(|s| self.substitute(s))
            .ok_or_else(|| NodeError::MissingParameter(key.to_string()))
    }

    /// Optional string param — None if absent or null.
    pub fn param_str_opt(&self, params: &Value, key: &str) -> Option<String> {
        params
            .get(key)
            .and_then(|v| v.as_str())
            .map(|s| self.substitute(s))
    }

    /// Bool param with default.
    pub fn param_bool(&self, params: &Value, key: &str, default: bool) -> bool {
        params.get(key).and_then(|v| v.as_bool()).unwrap_or(default)
    }

    /// Number param.
    pub fn param_f64(&self, params: &Value, key: &str) -> Option<f64> {
        params.get(key).and_then(|v| v.as_f64())
    }

    /// Substitute `{{var}}` and `{{$json.field}}` tokens in a string.
    /// Best-effort: unknown tokens render as empty string.
    pub fn substitute(&self, raw: &str) -> String {
        let mut out = String::with_capacity(raw.len());
        let bytes = raw.as_bytes();
        let mut i = 0;
        while i < bytes.len() {
            if i + 1 < bytes.len() && bytes[i] == b'{' && bytes[i + 1] == b'{' {
                // find matching }}
                if let Some(end) = raw[i + 2..].find("}}") {
                    let tok = raw[i + 2..i + 2 + end].trim();
                    out.push_str(&self.resolve_token(tok));
                    i = i + 2 + end + 2;
                    continue;
                }
            }
            out.push(bytes[i] as char);
            i += 1;
        }
        out
    }

    fn resolve_token(&self, tok: &str) -> String {
        // Patterns:
        //   $json            → entire trigger payload as JSON
        //   $json.foo.bar    → deep field
        //   $trigger.foo     → alias for $json
        //   varName          → variables[name]
        if let Some(rest) = tok.strip_prefix("$json") {
            let path = rest.strip_prefix('.').unwrap_or(rest);
            if let Some(td) = &self.trigger_data {
                return value_at_path(td, path)
                    .map(value_to_string)
                    .unwrap_or_default();
            }
            return String::new();
        }
        if let Some(rest) = tok.strip_prefix("$trigger") {
            let path = rest.strip_prefix('.').unwrap_or(rest);
            if let Some(td) = &self.trigger_data {
                return value_at_path(td, path)
                    .map(value_to_string)
                    .unwrap_or_default();
            }
            return String::new();
        }
        // Plain variable lookup
        if let Some(v) = self.variables.get(tok) {
            return value_to_string(v);
        }
        String::new()
    }
}

/// Navigate a dotted path inside a JSON value.
pub fn value_at_path<'a>(v: &'a Value, path: &str) -> Option<&'a Value> {
    if path.is_empty() {
        return Some(v);
    }
    let mut cur = v;
    for part in path.split('.') {
        cur = cur.get(part)?;
    }
    Some(cur)
}

pub fn value_to_string(v: &Value) -> String {
    match v {
        Value::String(s) => s.clone(),
        Value::Null => String::new(),
        other => other.to_string(),
    }
}
