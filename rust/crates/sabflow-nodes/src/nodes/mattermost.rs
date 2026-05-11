//! Mattermost node.
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

pub struct MattermostNode;

#[async_trait]
impl Node for MattermostNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "mattermost",
            "Mattermost",
            "Mattermost team chat",
            NodeCategory::Communication,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        Err(NodeError::NotImplemented("Mattermost".to_string()))
    }
}
