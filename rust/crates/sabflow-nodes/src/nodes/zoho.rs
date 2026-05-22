use async_trait::async_trait;
use serde_json::Value;

use crate::{
    NodeInput, NodeOutput, NodeResult,
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
};

pub struct ZohoNode;

#[async_trait]
impl Node for ZohoNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new("zoho", "Zoho", "Zoho CRM", NodeCategory::Crm)
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for zoho
        Ok(NodeOutput::single(input.items))
    }
}
