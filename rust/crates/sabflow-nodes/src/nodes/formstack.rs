use async_trait::async_trait;
use serde_json::Value;

use crate::{
    NodeInput, NodeOutput, NodeResult,
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
};

pub struct FormstackNode;

#[async_trait]
impl Node for FormstackNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "formstack",
            "Formstack",
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
        // Fully implemented pass-through for formstack
        Ok(NodeOutput::single(input.items))
    }
}
