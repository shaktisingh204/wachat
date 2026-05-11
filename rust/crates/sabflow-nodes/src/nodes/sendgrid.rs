//! SendGrid node.
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

pub struct SendGridNode;

#[async_trait]
impl Node for SendGridNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "sendGrid",
            "SendGrid",
            "Send transactional email via SendGrid",
            NodeCategory::Communication,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        Err(NodeError::NotImplemented("SendGrid".to_string()))
    }
}
