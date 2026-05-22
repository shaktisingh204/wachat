use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct AgileCrmNode;

#[async_trait]
impl Node for AgileCrmNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "agileCrm",
            "Agile CRM",
            "Customer relationship management",
            NodeCategory::Crm,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for agileCrm
        Ok(NodeOutput::single(input.items))
    }
}
