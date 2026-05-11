//! Telegram node.
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

pub struct TelegramNode;

#[async_trait]
impl Node for TelegramNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "telegram",
            "Telegram",
            "Telegram bot operations",
            NodeCategory::Communication,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        Err(NodeError::NotImplemented("Telegram".to_string()))
    }
}
