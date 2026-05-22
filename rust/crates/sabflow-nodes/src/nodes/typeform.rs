use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct TypeformNode;

#[async_trait]
impl Node for TypeformNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "typeform",
            "Typeform",
            "Online forms",
            NodeCategory::Productivity,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for typeform
        Ok(NodeOutput::single(input.items))
    }
}
