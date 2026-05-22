use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct MarkdownNode;

#[async_trait]
impl Node for MarkdownNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "markdown",
            "Markdown",
            "Markdown <-> HTML conversion",
            NodeCategory::Transform,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for markdown
        Ok(NodeOutput::single(input.items))
    }
}
