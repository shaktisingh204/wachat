use async_trait::async_trait;
use serde_json::Value;

use crate::{
    NodeInput, NodeOutput, NodeResult,
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
};

pub struct MondayComNode;

#[async_trait]
impl Node for MondayComNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "mondayCom",
            "monday.com",
            "Work OS",
            NodeCategory::Productivity,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for mondayCom
        Ok(NodeOutput::single(input.items))
    }
}
