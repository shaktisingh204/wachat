//! Rocket.Chat node.
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

pub struct RocketChatNode;

#[async_trait]
impl Node for RocketChatNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "rocketchat",
            "Rocket.Chat",
            "Rocket.Chat operations",
            NodeCategory::Communication,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        Err(NodeError::NotImplemented("Rocket.Chat".to_string()))
    }
}
