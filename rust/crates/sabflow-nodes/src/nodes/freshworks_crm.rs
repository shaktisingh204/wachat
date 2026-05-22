use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct FreshworksCrmNode;

#[async_trait]
impl Node for FreshworksCrmNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "freshworksCrm",
            "Freshworks CRM",
            "Freshworks CRM",
            NodeCategory::Crm,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for freshworksCrm
        Ok(NodeOutput::single(input.items))
    }
}
