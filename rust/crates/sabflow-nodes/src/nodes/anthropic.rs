//! Anthropic node.
//!
//! TODO(sabflow): full implementation — currently returns NotImplemented.

use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor},
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct AnthropicNode;

#[async_trait]
impl Node for AnthropicNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "anthropic",
            "Anthropic",
            "Anthropic Claude messages",
            NodeCategory::Ai,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        Err(NodeError::NotImplemented("Anthropic".to_string()))
    }
}
