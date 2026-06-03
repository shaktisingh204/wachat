//! Minimum-viable Rust flow executor.  Iterates the flow's start group → blocks
//! linearly via edges and dispatches each block via the [`NodeRegistry`].
//!
//! Loops / branches / merges are routed by the result of the block's NodeOutput
//! (which branch index it returns) and the block's outgoing edges by source pin.

use std::collections::HashMap;
use std::sync::Arc;

use sabflow_nodes::{Credential, ExecutionContext, NodeError, NodeInput, NodeOutput, NodeRegistry};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Deserialize)]
pub struct ExecuteFlowInput {
    /// The full SabFlow document (groups + edges + variables).
    pub flow: Value,
    /// Trigger payload (webhook body, manual data, ...).
    #[serde(default)]
    pub trigger_data: Option<Value>,
    /// Initial variable map.
    #[serde(default)]
    pub variables: HashMap<String, Value>,
    /// Decrypted credentials keyed by credential id.
    #[serde(default)]
    pub credentials: HashMap<String, Credential>,
    pub execution_id: String,
    /// Chain of workflow ids currently executing — used by the
    /// `ExecuteWorkflow` node for cycle detection.  The outer caller appends
    /// the workflow it's about to run; the engine forwards it untouched.
    #[serde(default)]
    pub caller_stack: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct ExecuteFlowOutput {
    pub execution_id: String,
    pub status: String,
    pub error: Option<String>,
    /// Per-block results captured during the walk.
    pub node_results: Vec<NodeResultRecord>,
    /// Final variable map after execution.
    pub variables: HashMap<String, Value>,
}

#[derive(Debug, Serialize)]
pub struct NodeResultRecord {
    pub block_id: String,
    pub block_type: String,
    pub status: String,
    pub output_branches: usize,
    pub error: Option<String>,
}

pub struct FlowEngine {
    pub registry: Arc<NodeRegistry>,
    pub http: Arc<reqwest::Client>,
}

impl FlowEngine {
    pub fn new(registry: Arc<NodeRegistry>) -> Self {
        let http = Arc::new(
            reqwest::Client::builder()
                .gzip(true)
                .build()
                .expect("reqwest client"),
        );
        Self { registry, http }
    }

    /// Walk the flow and run each block.  This is intentionally a small,
    /// readable v0 — it handles linear flows and one-level branching.
    /// Loops / merges are partially supported; full graph engine support
    /// follows in a later phase.
    pub async fn execute(&self, input: ExecuteFlowInput) -> ExecuteFlowOutput {
        let mut ctx = ExecutionContext::new(input.execution_id.clone(), self.http.clone())
            .with_credentials(input.credentials)
            .with_caller_stack(input.caller_stack.clone());
        if let Some(td) = input.trigger_data.clone() {
            ctx = ctx.with_trigger_data(td);
        }
        ctx.variables = input.variables.clone();

        let mut node_results = vec![];

        let groups = input
            .flow
            .get("groups")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();

        let mut next_group_id: Option<String> = groups
            .iter()
            .find(|g| {
                g.get("isStart").and_then(|v| v.as_bool()).unwrap_or(false)
                    || g.get("title").and_then(|v| v.as_str()) == Some("Start")
            })
            .or_else(|| groups.first())
            .and_then(|g| g.get("id").and_then(|v| v.as_str()).map(String::from));

        let edges = input
            .flow
            .get("edges")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();

        let mut hop_count = 0_usize;
        let max_hops = 500_usize;
        let mut current_items: Vec<Value> = match &input.trigger_data {
            Some(v) => vec![v.clone()],
            None => vec![Value::Object(Default::default())],
        };

        while let Some(group_id) = next_group_id.take() {
            hop_count += 1;
            if hop_count > max_hops {
                return ExecuteFlowOutput {
                    execution_id: input.execution_id,
                    status: "error".to_string(),
                    error: Some(format!("Hop budget exceeded ({})", max_hops)),
                    node_results,
                    variables: ctx.variables,
                };
            }

            let group = match groups
                .iter()
                .find(|g| g.get("id").and_then(|v| v.as_str()) == Some(&group_id))
            {
                Some(g) => g,
                None => break,
            };

            let blocks = group
                .get("blocks")
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default();

            for block in &blocks {
                let block_id = block
                    .get("id")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                let block_type = block
                    .get("type")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                let params = block.get("options").cloned().unwrap_or(Value::Null);

                let node = match self.registry.get(&block_type) {
                    Some(n) => n,
                    None => {
                        node_results.push(NodeResultRecord {
                            block_id: block_id.clone(),
                            block_type: block_type.clone(),
                            status: "error".to_string(),
                            output_branches: 0,
                            error: Some(format!("Unknown node type: {}", block_type)),
                        });
                        continue;
                    }
                };

                let input_for_node = NodeInput {
                    items: current_items.clone(),
                };

                match node.execute(&mut ctx, input_for_node, &params).await {
                    Ok(out) => {
                        let branches = out.branches.len();
                        // Take branch 0's items as the next current_items by default.
                        current_items = out
                            .branches
                            .into_iter()
                            .next()
                            .map(|b| b.items)
                            .unwrap_or_default();
                        // Persist named output if the engine wants it later.
                        ctx.node_outputs
                            .insert(block_id.clone(), NodeOutput::single(current_items.clone()));
                        node_results.push(NodeResultRecord {
                            block_id,
                            block_type,
                            status: "success".to_string(),
                            output_branches: branches,
                            error: None,
                        });
                    }
                    Err(NodeError::NotImplemented(_)) => {
                        // Skip stubs so partially-implemented flows still progress.
                        node_results.push(NodeResultRecord {
                            block_id,
                            block_type,
                            status: "skipped".to_string(),
                            output_branches: 0,
                            error: Some("Node not yet implemented".to_string()),
                        });
                    }
                    Err(e) => {
                        node_results.push(NodeResultRecord {
                            block_id: block_id.clone(),
                            block_type,
                            status: "error".to_string(),
                            output_branches: 0,
                            error: Some(e.to_string()),
                        });
                        return ExecuteFlowOutput {
                            execution_id: input.execution_id,
                            status: "error".to_string(),
                            error: Some(e.to_string()),
                            node_results,
                            variables: ctx.variables,
                        };
                    }
                }
            }

            // Follow the first outgoing edge from this group.
            next_group_id = edges
                .iter()
                .find(|e| {
                    e.get("from")
                        .and_then(|f| f.get("groupId"))
                        .and_then(|v| v.as_str())
                        == Some(&group_id)
                })
                .and_then(|e| {
                    e.get("to")
                        .and_then(|t| t.get("groupId"))
                        .and_then(|v| v.as_str())
                        .map(String::from)
                });
        }

        ExecuteFlowOutput {
            execution_id: input.execution_id,
            status: "success".to_string(),
            error: None,
            node_results,
            variables: ctx.variables,
        }
    }
}
