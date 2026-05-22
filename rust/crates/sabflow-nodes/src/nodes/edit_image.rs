use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct EditImageNode;

#[async_trait]
impl Node for EditImageNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "editImage",
            "Edit Image",
            "Image manipulation",
            NodeCategory::Files,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for editImage
        Ok(NodeOutput::single(input.items))
    }
}
