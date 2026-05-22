use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct SalesforceNode;

#[async_trait]
impl Node for SalesforceNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "salesforce",
            "Salesforce",
            "Salesforce CRM",
            NodeCategory::Crm,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for salesforce
        Ok(NodeOutput::single(input.items))
    }
}
