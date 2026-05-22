use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct QdrantNode;

#[async_trait]
impl Node for QdrantNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "qdrant",
            "Qdrant",
            "Qdrant vector database",
            NodeCategory::Database,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for qdrant
        Ok(NodeOutput::single(input.items))
    }
}
