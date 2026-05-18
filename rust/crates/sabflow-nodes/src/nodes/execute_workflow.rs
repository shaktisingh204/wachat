//! Execute Workflow node (`executeWorkflow`).
//!
//! Invokes a sub-workflow by id, passing through items, returning whatever
//! items the child flow emits.  Parity with n8n's
//! `n8n-nodes-base.executeWorkflow` and the TypeScript forge fallback at
//! `src/lib/sabflow/forge/blocks/n8n/internals/execute_workflow.ts`.
//!
//! ## Cycle detection
//!
//! Maintained as the authoritative gate before the sub-flow even starts:
//!
//! 1. The node reads the caller stack from
//!    [`ExecutionContext::caller_stack`] (populated by the engine).
//! 2. If `workflow_id` is already present anywhere on the stack, it fails
//!    immediately with [`NodeError::SubWorkflowCycle`] — there is no
//!    in-band way to "unwind safely" from a recursive call, so we refuse to
//!    start it.
//! 3. Otherwise, it appends `workflow_id` to a fresh copy of the stack and
//!    passes that to the [`SubFlowInvoker`].  Deeper sub-flows then see the
//!    growing chain and can detect cycles too.
//!
//! ## Mode parity
//!
//! n8n supports three "source" modes for picking the sub-workflow:
//! `database` (by id), `parameter` (inline JSON document — rarely used in
//! production), and `url` (load from URL).  This Rust impl supports the
//! `database` mode only — the inline / URL modes return
//! [`NodeError::NotImplemented`] until there's demonstrated demand.
//!
//! ## Dependency direction
//!
//! `sabflow-engine-runtime` depends on `sabflow-nodes`, not the other way
//! around — so this node cannot call `FlowEngine::execute` directly.  The
//! engine attaches a [`SubFlowInvoker`] to the [`ExecutionContext`] before
//! every node runs.  When the invoker is absent (tests, embedded tooling),
//! the node returns [`NodeError::NotImplemented`].

use async_trait::async_trait;
use serde_json::{json, Value};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption, NodePropertyType},
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct ExecuteWorkflowNode;

#[async_trait]
impl Node for ExecuteWorkflowNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "executeWorkflow",
            "Execute Sub-workflow",
            "Invoke another workflow as a sub-routine",
            NodeCategory::Logic,
        )
        .icon("workflow")
        .color("#6366f1")
        .properties(vec![
            NodeProperty::new("source", "Source", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "Database".into(),
                        value: json!("database"),
                        description: Some("Pick a workflow from the user's library".into()),
                    },
                    NodePropertyOption {
                        name: "Parameter (inline JSON)".into(),
                        value: json!("parameter"),
                        description: Some(
                            "Define the sub-flow inline — not yet supported in Rust".into(),
                        ),
                    },
                    NodePropertyOption {
                        name: "URL".into(),
                        value: json!("url"),
                        description: Some(
                            "Fetch the sub-flow JSON from a URL — not yet supported in Rust".into(),
                        ),
                    },
                ])
                .default(json!("database"))
                .required(),
            NodeProperty::new("workflowId", "Workflow ID", NodePropertyType::String)
                .placeholder("flw_abc123")
                .show_when("source", &["database"])
                .required()
                .description("ID of the workflow to execute. Same workspace only."),
            NodeProperty::new(
                "executionMode",
                "Execution Mode",
                NodePropertyType::Options,
            )
            .options(vec![
                NodePropertyOption {
                    name: "Run once with each item".into(),
                    value: json!("each"),
                    description: Some("Invoke the sub-flow per input item".into()),
                },
                NodePropertyOption {
                    name: "Run once with all items".into(),
                    value: json!("once"),
                    description: Some(
                        "Invoke the sub-flow a single time, passing all items".into(),
                    ),
                },
            ])
            .default(json!("once")),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let source = ctx
            .param_str_opt(params, "source")
            .unwrap_or_else(|| "database".to_string());
        if source != "database" {
            return Err(NodeError::NotImplemented(format!(
                "ExecuteWorkflow: source mode `{source}` is not implemented (use `database`)"
            )));
        }

        let workflow_id = ctx.param_str(params, "workflowId")?;
        let workflow_id = workflow_id.trim().to_string();
        if workflow_id.is_empty() {
            return Err(NodeError::MissingParameter("workflowId".into()));
        }

        // ── Cycle detection ────────────────────────────────────────────────
        // The caller stack is the authoritative cycle guard — mirrors the TS
        // forge fallback's `ctx.callerStack` check.
        if ctx.caller_stack.iter().any(|id| id == &workflow_id) {
            let chain = ctx
                .caller_stack
                .iter()
                .cloned()
                .chain(std::iter::once(workflow_id.clone()))
                .collect::<Vec<_>>()
                .join(" -> ");
            return Err(NodeError::SubWorkflowCycle(format!(
                "workflow `{workflow_id}` already on caller stack [{chain}]"
            )));
        }

        let mode = ctx
            .param_str_opt(params, "executionMode")
            .unwrap_or_else(|| "once".to_string());

        let invoker = ctx.sub_flow_invoker.clone().ok_or_else(|| {
            NodeError::NotImplemented(
                "ExecuteWorkflow: engine did not provide a SubFlowInvoker on the context"
                    .to_string(),
            )
        })?;

        // Build the next-stack to hand to the engine.
        let mut next_stack = ctx.caller_stack.clone();
        next_stack.push(workflow_id.clone());

        match mode.as_str() {
            "once" => {
                let out = invoker
                    .invoke_sub_flow(&workflow_id, input.items, next_stack)
                    .await?;
                Ok(NodeOutput::single(out))
            }
            "each" => {
                let mut aggregated: Vec<Value> = Vec::with_capacity(input.items.len());
                for item in input.items {
                    let out = invoker
                        .invoke_sub_flow(&workflow_id, vec![item], next_stack.clone())
                        .await?;
                    aggregated.extend(out);
                }
                Ok(NodeOutput::single(aggregated))
            }
            other => Err(NodeError::InvalidParameter {
                name: "executionMode".into(),
                reason: format!("unknown executionMode: {other}"),
            }),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::context::SubFlowInvoker;
    use async_trait::async_trait;
    use std::sync::{
        atomic::{AtomicUsize, Ordering},
        Arc,
    };

    /// Records every invocation; returns a synthetic output item.
    struct RecordingInvoker {
        calls: AtomicUsize,
    }

    #[async_trait]
    impl SubFlowInvoker for RecordingInvoker {
        async fn invoke_sub_flow(
            &self,
            workflow_id: &str,
            inputs: Vec<Value>,
            caller_stack: Vec<String>,
        ) -> NodeResult<Vec<Value>> {
            self.calls.fetch_add(1, Ordering::SeqCst);
            Ok(vec![json!({
                "ok": true,
                "workflowId": workflow_id,
                "inputCount": inputs.len(),
                "callerStack": caller_stack,
            })])
        }
    }

    fn ctx_with_invoker() -> (ExecutionContext, Arc<RecordingInvoker>) {
        let invoker = Arc::new(RecordingInvoker {
            calls: AtomicUsize::new(0),
        });
        let mut ctx = ExecutionContext::new(
            "exec_test".into(),
            Arc::new(reqwest::Client::new()),
        );
        ctx.sub_flow_invoker = Some(invoker.clone());
        (ctx, invoker)
    }

    #[tokio::test]
    async fn missing_workflow_id_errors() {
        let node = ExecuteWorkflowNode;
        let (mut ctx, _) = ctx_with_invoker();
        let params = json!({ "source": "database" });
        let err = node.execute(&mut ctx, NodeInput::empty(), &params).await.unwrap_err();
        assert!(matches!(err, NodeError::MissingParameter(_)));
    }

    #[tokio::test]
    async fn cycle_detection_refuses_self_call() {
        let node = ExecuteWorkflowNode;
        let (mut ctx, invoker) = ctx_with_invoker();
        ctx.caller_stack = vec!["flw_root".into(), "flw_child".into()];
        let params = json!({ "source": "database", "workflowId": "flw_child" });
        let err = node.execute(&mut ctx, NodeInput::empty(), &params).await.unwrap_err();
        match err {
            NodeError::SubWorkflowCycle(msg) => {
                assert!(msg.contains("flw_child"));
                assert!(msg.contains("flw_root -> flw_child -> flw_child"));
            }
            other => panic!("expected SubWorkflowCycle, got: {other:?}"),
        }
        assert_eq!(invoker.calls.load(Ordering::SeqCst), 0);
    }

    #[tokio::test]
    async fn once_mode_calls_invoker_once_with_all_items() {
        let node = ExecuteWorkflowNode;
        let (mut ctx, invoker) = ctx_with_invoker();
        let params = json!({
            "source": "database",
            "workflowId": "flw_xyz",
            "executionMode": "once"
        });
        let input = NodeInput::many(vec![json!({"a": 1}), json!({"a": 2}), json!({"a": 3})]);
        let out = node.execute(&mut ctx, input, &params).await.unwrap();
        assert_eq!(invoker.calls.load(Ordering::SeqCst), 1);
        assert_eq!(out.branches[0].items[0]["inputCount"], 3);
        assert_eq!(out.branches[0].items[0]["callerStack"][0], "flw_xyz");
    }

    #[tokio::test]
    async fn each_mode_calls_invoker_per_item() {
        let node = ExecuteWorkflowNode;
        let (mut ctx, invoker) = ctx_with_invoker();
        let params = json!({
            "source": "database",
            "workflowId": "flw_xyz",
            "executionMode": "each"
        });
        let input = NodeInput::many(vec![json!({"a": 1}), json!({"a": 2})]);
        let out = node.execute(&mut ctx, input, &params).await.unwrap();
        assert_eq!(invoker.calls.load(Ordering::SeqCst), 2);
        assert_eq!(out.branches[0].items.len(), 2);
    }

    #[tokio::test]
    async fn caller_stack_grows_with_each_call() {
        let node = ExecuteWorkflowNode;
        let (mut ctx, _) = ctx_with_invoker();
        ctx.caller_stack = vec!["flw_root".into()];
        let params = json!({ "source": "database", "workflowId": "flw_child" });
        let out = node.execute(&mut ctx, NodeInput::empty(), &params).await.unwrap();
        let stack = out.branches[0].items[0]["callerStack"]
            .as_array()
            .unwrap()
            .iter()
            .map(|v| v.as_str().unwrap().to_string())
            .collect::<Vec<_>>();
        assert_eq!(stack, vec!["flw_root".to_string(), "flw_child".to_string()]);
    }

    #[tokio::test]
    async fn missing_invoker_returns_not_implemented() {
        let node = ExecuteWorkflowNode;
        let mut ctx = ExecutionContext::new(
            "exec_test".into(),
            Arc::new(reqwest::Client::new()),
        );
        // no sub_flow_invoker
        let params = json!({ "source": "database", "workflowId": "flw_x" });
        let err = node.execute(&mut ctx, NodeInput::empty(), &params).await.unwrap_err();
        assert!(matches!(err, NodeError::NotImplemented(_)));
    }

    #[tokio::test]
    async fn unsupported_source_modes_return_not_implemented() {
        let node = ExecuteWorkflowNode;
        let (mut ctx, _) = ctx_with_invoker();
        for src in ["parameter", "url"] {
            let params = json!({ "source": src, "workflowId": "flw_x" });
            let err = node.execute(&mut ctx, NodeInput::empty(), &params).await.unwrap_err();
            assert!(matches!(err, NodeError::NotImplemented(_)));
        }
    }
}
