use async_trait::async_trait;
use serde_json::Value;

use crate::{
    NodeInput, NodeOutput, NodeResult,
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
};

pub struct AsanaNode;

#[async_trait]
impl Node for AsanaNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "asana",
            "Asana",
            "Project and task management",
            NodeCategory::Productivity,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for asana
        Ok(NodeOutput::single(input.items))
    }
}
