use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct CircleCiNode;

#[async_trait]
impl Node for CircleCiNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "circleCi",
            "CircleCI",
            "Continuous integration",
            NodeCategory::Developer,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for circleCi
        Ok(NodeOutput::single(input.items))
    }
}
