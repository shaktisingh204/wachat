//! OpenAI node.
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

pub struct OpenAiNode;

#[async_trait]
impl Node for OpenAiNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "openAi",
            "OpenAI",
            "OpenAI completions and embeddings",
            NodeCategory::Ai,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        Err(NodeError::NotImplemented("OpenAI".to_string()))
    }
}
