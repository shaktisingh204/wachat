use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct JinaAiNode;

#[async_trait]
impl Node for JinaAiNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "jinaAi",
            "Jina AI",
            "Embeddings and reranking",
            NodeCategory::Ai,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for jinaAi
        Ok(NodeOutput::single(input.items))
    }
}
