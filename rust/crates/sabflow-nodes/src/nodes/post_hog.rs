//! PostHog node.
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

pub struct PostHogNode;

#[async_trait]
impl Node for PostHogNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "postHog",
            "PostHog",
            "PostHog product analytics",
            NodeCategory::Analytics,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        Err(NodeError::NotImplemented("PostHog".to_string()))
    }
}
