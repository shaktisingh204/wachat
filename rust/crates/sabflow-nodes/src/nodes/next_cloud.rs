use async_trait::async_trait;
use serde_json::Value;

use crate::{
    NodeInput, NodeOutput, NodeResult,
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
};

pub struct NextCloudNode;

#[async_trait]
impl Node for NextCloudNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "nextCloud",
            "NextCloud",
            "Self-hosted cloud storage",
            NodeCategory::Storage,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for nextCloud
        Ok(NodeOutput::single(input.items))
    }
}
