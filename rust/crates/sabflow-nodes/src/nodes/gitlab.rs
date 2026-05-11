//! GitLab node.
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

pub struct GitlabNode;

#[async_trait]
impl Node for GitlabNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "gitlab",
            "GitLab",
            "GitLab repository operations",
            NodeCategory::Developer,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        Err(NodeError::NotImplemented("GitLab".to_string()))
    }
}
