//! LingvaNex node.
//! Auto-generated.

use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor},
    error::NodeResult,
    node::Node,
};

pub struct LingvaNexNode;

#[async_trait]
impl Node for LingvaNexNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new("lingvaNex", "LingvaNex", "Translation", NodeCategory::Ai)
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
