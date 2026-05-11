//! ConvertKit node.
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

pub struct ConvertKitNode;

#[async_trait]
impl Node for ConvertKitNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "convertKit",
            "ConvertKit",
            "Email marketing for creators",
            NodeCategory::Marketing,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        Err(NodeError::NotImplemented("ConvertKit".to_string()))
    }
}
