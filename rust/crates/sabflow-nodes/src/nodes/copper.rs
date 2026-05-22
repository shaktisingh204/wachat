use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct CopperNode;

#[async_trait]
impl Node for CopperNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "copper",
            "Copper",
            "CRM built for Google Workspace",
            NodeCategory::Crm,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for copper
        Ok(NodeOutput::single(input.items))
    }
}
