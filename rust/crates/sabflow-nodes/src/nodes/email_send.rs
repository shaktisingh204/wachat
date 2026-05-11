//! Send Email node.
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

pub struct EmailSendNode;

#[async_trait]
impl Node for EmailSendNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "emailSend",
            "Send Email",
            "Send email via SMTP",
            NodeCategory::Communication,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        Err(NodeError::NotImplemented("Send Email".to_string()))
    }
}
