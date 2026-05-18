//! Workflow node — n8n parity.
//!
//! Origin: `n8n-nodes-base.workflow`. n8n exposes a node that lets a flow
//! read metadata about itself or another workflow (id, name, active, etc.).
//! It also doubles as the sub-workflow accessor in some older catalogues.
//!
//! SabFlow's engine doesn't push a structured workflow descriptor into the
//! node context yet, so this node emits whatever the engine *has* seeded on
//! `ctx.variables` (key prefix `workflow.`) plus the execution id. When the
//! engine starts threading workflow metadata through, this node will pick
//! it up automatically.
//!
//! For full sub-workflow *invocation* see the `executeWorkflow` block — this
//! node is purely a metadata accessor.

use async_trait::async_trait;
use serde_json::{json, Map, Value};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor, NodeProperty, NodePropertyType},
    error::NodeResult,
    node::Node,
};

pub struct WorkflowNode;

#[async_trait]
impl Node for WorkflowNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "workflow",
            "Workflow",
            "Read metadata about the current sub-workflow",
            NodeCategory::Developer,
        )
        .icon("workflow")
        .color("#6366f1")
        .properties(vec![NodeProperty::new(
            "field",
            "Field",
            NodePropertyType::String,
        )
        .default(json!(""))
        .description(
            "Optional dotted field path (e.g. `id`, `name`). When empty, the \
             full metadata object is emitted.",
        )])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Build a metadata view from whatever the engine has seeded.
        let mut meta = Map::new();
        meta.insert(
            "executionId".into(),
            Value::String(ctx.execution_id.clone()),
        );
        for key in ["workflowId", "workflowName", "workflowActive"] {
            if let Some(v) = ctx.variables.get(key) {
                meta.insert(key.to_string(), v.clone());
            }
        }
        // Nested `workflow.*` convention some callers prefer.
        if let Some(Value::Object(nested)) = ctx.variables.get("workflow") {
            for (k, v) in nested {
                meta.insert(k.clone(), v.clone());
            }
        }
        let full = Value::Object(meta);

        let field = ctx.param_str_opt(params, "field").unwrap_or_default();
        if field.is_empty() {
            return Ok(NodeOutput::single(vec![full]));
        }

        let mut cur = &full;
        for part in field.split('.') {
            match cur.get(part) {
                Some(v) => cur = v,
                None => {
                    return Ok(NodeOutput::single(vec![Value::Null]));
                }
            }
        }
        Ok(NodeOutput::single(vec![cur.clone()]))
    }
}
