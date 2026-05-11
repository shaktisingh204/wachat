//! Twilio node.
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

pub struct TwilioNode;

#[async_trait]
impl Node for TwilioNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "twilio",
            "Twilio",
            "Twilio SMS and voice",
            NodeCategory::Communication,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        Err(NodeError::NotImplemented("Twilio".to_string()))
    }
}
