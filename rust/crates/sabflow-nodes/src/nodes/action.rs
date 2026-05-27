//! Action node — generic "execute custom action" placeholder.
//!
//! Pass-through for items; intended as a stand-in for user-defined
//! action blocks during flow design. Actual side-effects are implemented
//! by concrete integration nodes.

use async_trait::async_trait;
use serde_json::Value;

use crate::{
    NodeInput, NodeOutput, NodeResult,
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
};

pub struct ActionNode;

#[async_trait]
impl Node for ActionNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "action",
            "Action",
            "Action block to execute custom operations",
            NodeCategory::Action,
        )
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
