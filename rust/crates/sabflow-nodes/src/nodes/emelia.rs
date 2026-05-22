//! Emelia node.
//! Auto-generated.

use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor},
    error::NodeResult,
    node::Node,
};

pub struct EmeliaNode;

#[async_trait]
impl Node for EmeliaNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "emelia",
            "Emelia",
            "Cold email outreach",
            NodeCategory::Marketing,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fallback pass-through implementation
        // The frontend uses the forge fallback when available.
        Ok(NodeOutput::single(input.items))
    }
}
