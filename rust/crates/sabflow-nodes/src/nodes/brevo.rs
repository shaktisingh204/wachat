//! Brevo node.
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

pub struct BrevoNode;

#[async_trait]
impl Node for BrevoNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "brevo",
            "Brevo",
            "Email and SMS marketing",
            NodeCategory::Marketing,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        Err(NodeError::NotImplemented("Brevo".to_string()))
    }
}
