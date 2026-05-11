//! IF node.
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

pub struct IfNode;

#[async_trait]
impl Node for IfNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "if",
            "IF",
            "Branch on a condition",
            NodeCategory::Logic,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        Err(NodeError::NotImplemented("IF".to_string()))
    }
}
