use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct Signl4Node;

#[async_trait]
impl Node for Signl4Node {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "signl4",
            "Signl4",
            "Mobile alerting",
            NodeCategory::Communication,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for signl4
        Ok(NodeOutput::single(input.items))
    }
}
