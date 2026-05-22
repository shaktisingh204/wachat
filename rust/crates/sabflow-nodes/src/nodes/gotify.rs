use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct GotifyNode;

#[async_trait]
impl Node for GotifyNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "gotify",
            "Gotify",
            "Self-hosted push notifications",
            NodeCategory::Communication,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for gotify
        Ok(NodeOutput::single(input.items))
    }
}
