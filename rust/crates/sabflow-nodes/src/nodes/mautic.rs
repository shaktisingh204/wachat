use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct MauticNode;

#[async_trait]
impl Node for MauticNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "mautic",
            "Mautic",
            "Marketing automation",
            NodeCategory::Marketing,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for mautic
        Ok(NodeOutput::single(input.items))
    }
}
