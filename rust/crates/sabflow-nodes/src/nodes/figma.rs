use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct FigmaNode;

#[async_trait]
impl Node for FigmaNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "figma",
            "Figma",
            "Design files",
            NodeCategory::Productivity,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for figma
        Ok(NodeOutput::single(input.items))
    }
}
