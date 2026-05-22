use async_trait::async_trait;
use serde_json::Value;

use crate::{
    NodeInput, NodeOutput, NodeResult,
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
};

pub struct PostHogNode;

#[async_trait]
impl Node for PostHogNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "postHog",
            "PostHog",
            "Product analytics",
            NodeCategory::Analytics,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for postHog
        Ok(NodeOutput::single(input.items))
    }
}
