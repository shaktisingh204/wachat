//! NoOp node — passes items through unchanged.

use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct NoOpNode;

#[async_trait]
impl Node for NoOpNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new("noOp", "No Operation", "Pass items through unchanged", NodeCategory::Logic)
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        Ok(NodeOutput::single(input.items))
    }
}
