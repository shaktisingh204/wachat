//! Discord node.
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

pub struct DiscordNode;

#[async_trait]
impl Node for DiscordNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "discord",
            "Discord",
            "Send Discord messages",
            NodeCategory::Communication,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        Err(NodeError::NotImplemented("Discord".to_string()))
    }
}
