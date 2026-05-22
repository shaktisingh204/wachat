use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct ZoomNode;

#[async_trait]
impl Node for ZoomNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "zoom",
            "Zoom",
            "Video conferencing",
            NodeCategory::Communication,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for zoom
        Ok(NodeOutput::single(input.items))
    }
}
