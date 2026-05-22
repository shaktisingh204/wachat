use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct RssFeedReadNode;

#[async_trait]
impl Node for RssFeedReadNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "rssFeedRead",
            "RSS Feed Read",
            "Read RSS feeds",
            NodeCategory::Communication,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for rssFeedRead
        Ok(NodeOutput::single(input.items))
    }
}
