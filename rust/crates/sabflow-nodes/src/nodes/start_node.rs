//! Start node — n8n parity.
//!
//! Origin: `n8n-nodes-base.start`. n8n's legacy "manual trigger" entry node.
//! In modern n8n flows this is replaced by Manual Trigger / Webhook /
//! Schedule, but a lot of imported flows still have a Start node at their
//! head. SabFlow treats it as a no-op pass-through that surfaces whatever
//! the engine has placed on `ctx.trigger_data` as the first item.
//!
//! Behaviour:
//!   - If `ctx.trigger_data` is set → emit it as a single item.
//!   - Otherwise → emit a single empty object `{}` so downstream nodes still
//!     see one row to iterate over.

use async_trait::async_trait;
use serde_json::{json, Value};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor},
    error::NodeResult,
    node::Node,
};

pub struct StartNode;

#[async_trait]
impl Node for StartNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "start",
            "Start",
            "Legacy entry node — passes the trigger payload through",
            NodeCategory::Trigger,
        )
        .icon("play")
        .color("#22c55e")
        .trigger()
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        let item = ctx.trigger_data.clone().unwrap_or_else(|| json!({}));
        Ok(NodeOutput::single(vec![item]))
    }
}
