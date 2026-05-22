use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct ClockifyNode;

#[async_trait]
impl Node for ClockifyNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "clockify",
            "Clockify",
            "Time tracking",
            NodeCategory::Productivity,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for clockify
        Ok(NodeOutput::single(input.items))
    }
}
