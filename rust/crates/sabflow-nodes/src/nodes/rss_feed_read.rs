//! RSS Feed Read node.
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

pub struct RssFeedReadNode;

#[async_trait]
impl Node for RssFeedReadNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "rssFeedRead",
            "RSS Feed Read",
            "Read RSS feeds",
            NodeCategory::Communication,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        Err(NodeError::NotImplemented("RSS Feed Read".to_string()))
    }
}
