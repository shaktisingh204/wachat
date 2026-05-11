//! WhatsApp Business node.
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

pub struct WhatsAppNode;

#[async_trait]
impl Node for WhatsAppNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "whatsApp",
            "WhatsApp Business",
            "WhatsApp Business API",
            NodeCategory::Communication,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        Err(NodeError::NotImplemented("WhatsApp Business".to_string()))
    }
}
