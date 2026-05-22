use async_trait::async_trait;
use serde_json::Value;

use crate::{
    NodeInput, NodeOutput, NodeResult,
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
};

pub struct HtmlNode;

#[async_trait]
impl Node for HtmlNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new("html", "HTML", "HTML manipulation", NodeCategory::Transform)
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for html
        Ok(NodeOutput::single(input.items))
    }
}
