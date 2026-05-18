//! End node — lifecycle stub.
//!
//! Origin: not a first-class n8n node, but several catalogues and imported
//! flows expect an "end" sink. SabFlow exposes it as a no-op terminator
//! that consumes incoming items and emits nothing further. Useful as an
//! explicit "stop here" pin when a flow has multiple branches and you want
//! one of them to be a quiet sink rather than dangling.
//!
//! Behaviour: returns an empty output (`NodeOutput::empty`). Items entering
//! this node are accepted but never re-emitted.

use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor},
    error::NodeResult,
    node::Node,
};

pub struct EndNode;

#[async_trait]
impl Node for EndNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "end",
            "End",
            "Sink that quietly consumes incoming items",
            NodeCategory::Logic,
        )
        .icon("circle-stop")
        .color("#64748b")
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        Ok(NodeOutput::empty())
    }
}
