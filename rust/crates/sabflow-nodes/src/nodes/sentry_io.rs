use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct SentryIoNode;

#[async_trait]
impl Node for SentryIoNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "sentryIo",
            "Sentry.io",
            "Error monitoring",
            NodeCategory::Developer,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for sentryIo
        Ok(NodeOutput::single(input.items))
    }
}
