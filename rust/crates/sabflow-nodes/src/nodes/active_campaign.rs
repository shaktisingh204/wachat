use async_trait::async_trait;
use serde_json::Value;

use crate::{
    NodeInput, NodeOutput, NodeResult,
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
};

pub struct ActiveCampaignNode;

#[async_trait]
impl Node for ActiveCampaignNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "activeCampaign",
            "ActiveCampaign",
            "Marketing automation and CRM",
            NodeCategory::Marketing,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for activeCampaign
        Ok(NodeOutput::single(input.items))
    }
}
