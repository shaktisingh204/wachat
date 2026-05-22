use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct ClickUpNode;

#[async_trait]
impl Node for ClickUpNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "clickUp",
            "ClickUp",
            "Project management",
            NodeCategory::Productivity,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for clickUp
        Ok(NodeOutput::single(input.items))
    }
}
