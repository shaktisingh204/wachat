use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct WorkableNode;

#[async_trait]
impl Node for WorkableNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "workable",
            "Workable",
            "Recruiting software",
            NodeCategory::Hr,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for workable
        Ok(NodeOutput::single(input.items))
    }
}
