//! Error Trigger node — n8n parity stub.
//!
//! Origin: `n8n-nodes-base.errorTrigger`. In n8n, this is a trigger node
//! that fires when another workflow lists *this* workflow as its "error
//! workflow" in settings. The activated execution receives a payload that
//! describes the failed run.
//!
//! In SabFlow the native equivalent is the engine's `onError` branch — the
//! flow runner threads the error envelope to whichever node is wired on the
//! error pin. This block exists for catalog parity so imported n8n flows
//! resolve, and so users can read the same documented shape.
//!
//! At runtime: if the engine has stashed an error envelope on
//! `ctx.variables["__error"]` (or `trigger_data`), we surface it. Otherwise
//! we emit a stub envelope describing the shape so downstream nodes can be
//! authored against it.

use async_trait::async_trait;
use serde_json::{json, Value};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor},
    error::NodeResult,
    node::Node,
};

pub struct ErrorTriggerNode;

#[async_trait]
impl Node for ErrorTriggerNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "errorTrigger",
            "Error Trigger",
            "Triggered when another workflow's error workflow points here",
            NodeCategory::Trigger,
        )
        .icon("triangle-alert")
        .color("#ef4444")
        .trigger()
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Prefer an error envelope the engine has explicitly seeded.
        if let Some(env) = ctx.variables.get("__error").cloned() {
            return Ok(NodeOutput::single(vec![env]));
        }
        // Fall back to the trigger payload if the engine routed it that way.
        if let Some(td) = ctx.trigger_data.clone() {
            return Ok(NodeOutput::single(vec![td]));
        }
        // Last resort: emit the documented shape so downstream nodes can be
        // wired up. The values are placeholders, never real failure data.
        let stub = json!({
            "execution": {
                "id": ctx.execution_id,
                "url": null,
                "retryOf": null,
                "error": { "message": "", "stack": "" },
                "lastNodeExecuted": "",
                "mode": "error",
            },
            "workflow": { "id": null, "name": null },
        });
        Ok(NodeOutput::single(vec![stub]))
    }
}
