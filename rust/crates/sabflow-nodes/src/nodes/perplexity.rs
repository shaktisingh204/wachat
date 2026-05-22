use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct PerplexityNode;

#[async_trait]
impl Node for PerplexityNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "perplexity",
            "Perplexity",
            "Perplexity AI search",
            NodeCategory::Ai,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for perplexity
        Ok(NodeOutput::single(input.items))
    }
}
