//! Merge node.
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

pub struct MergeNode;

#[async_trait]
impl Node for MergeNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "merge",
            "Merge",
            "Combine multiple inputs",
            NodeCategory::Logic,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        Err(NodeError::NotImplemented("Merge".to_string()))
    }
}
