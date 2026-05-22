//! Mistral AI node.
//! Auto-generated.

use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor},
    error::NodeResult,
    node::Node,
};

pub struct MistralAiNode;

#[async_trait]
impl Node for MistralAiNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "mistralAi",
            "Mistral AI",
            "Mistral language models",
            NodeCategory::Ai,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fallback pass-through implementation
        // The frontend uses the forge fallback when available.
        Ok(NodeOutput::single(input.items))
    }
}
