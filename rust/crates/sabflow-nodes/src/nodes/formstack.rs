//! Formstack node.
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

pub struct FormstackNode;

#[async_trait]
impl Node for FormstackNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "formstack",
            "Formstack",
            "Formstack online forms",
            NodeCategory::Productivity,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        Err(NodeError::NotImplemented("Formstack".to_string()))
    }
}
