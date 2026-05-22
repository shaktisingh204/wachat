//! HumanticAI node.
//! Auto-generated.

use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor},
    error::NodeResult,
    node::Node,
};

pub struct HumanticAiNode;

#[async_trait]
impl Node for HumanticAiNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "humanticAi",
            "HumanticAI",
            "Personality AI",
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
