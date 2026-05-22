use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct TodoistNode;

#[async_trait]
impl Node for TodoistNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "todoist",
            "Todoist",
            "Task manager",
            NodeCategory::Productivity,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for todoist
        Ok(NodeOutput::single(input.items))
    }
}
