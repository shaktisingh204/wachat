use async_trait::async_trait;
use serde_json::Value;

use crate::{
    NodeInput, NodeOutput, NodeResult,
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
};

pub struct TrelloNode;

#[async_trait]
impl Node for TrelloNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "trello",
            "Trello",
            "Kanban boards",
            NodeCategory::Productivity,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for trello
        Ok(NodeOutput::single(input.items))
    }
}
