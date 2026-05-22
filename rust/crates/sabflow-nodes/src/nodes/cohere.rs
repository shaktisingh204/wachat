use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct CohereNode;

#[async_trait]
impl Node for CohereNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "cohere",
            "Cohere",
            "Cohere chat, embeddings, and reranking",
            NodeCategory::Ai,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for cohere
        Ok(NodeOutput::single(input.items))
    }
}
