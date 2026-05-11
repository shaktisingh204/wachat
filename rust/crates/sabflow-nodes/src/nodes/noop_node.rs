//! No Operation node — pass items through unchanged.
//!
//! Useful as a join point, a labelled placeholder while wiring a flow, or as
//! a target for the IF/Switch "default" branch when you want to capture items
//! without doing anything with them.

use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor},
    error::NodeResult,
    node::Node,
};

pub struct NoOpNode;

#[async_trait]
impl Node for NoOpNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "noOp",
            "No Operation",
            "Pass items through unchanged",
            NodeCategory::Logic,
        )
        .icon("circle-dashed")
        .color("#737373")
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
