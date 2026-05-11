//! Respond to Webhook node.
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

pub struct RespondToWebhookNode;

#[async_trait]
impl Node for RespondToWebhookNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "respondToWebhook",
            "Respond to Webhook",
            "Reply to the inbound webhook caller",
            NodeCategory::Action,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        Err(NodeError::NotImplemented("Respond to Webhook".to_string()))
    }
}
