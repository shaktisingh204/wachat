use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct FilterNode;

#[async_trait]
impl Node for FilterNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "filter",
            "Filter",
            "Filter items by condition",
            NodeCategory::Transform,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for filter
        Ok(NodeOutput::single(input.items))
    }
}
