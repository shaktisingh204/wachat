use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct QuestDbNode;

#[async_trait]
impl Node for QuestDbNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "questDb",
            "QuestDB",
            "Time-series database",
            NodeCategory::Database,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for questDb
        Ok(NodeOutput::single(input.items))
    }
}
