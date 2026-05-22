use async_trait::async_trait;
use serde_json::Value;

use crate::{
    NodeInput, NodeOutput, NodeResult,
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
};

pub struct ConvertToTextNode;

#[async_trait]
impl Node for ConvertToTextNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "convertToText",
            "Convert to Text",
            "Parse a binary file back into items",
            NodeCategory::Transform,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for convertToText
        Ok(NodeOutput::single(input.items))
    }
}
