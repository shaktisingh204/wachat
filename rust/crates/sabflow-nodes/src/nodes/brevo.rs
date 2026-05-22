use async_trait::async_trait;
use serde_json::Value;

use crate::{
    NodeInput, NodeOutput, NodeResult,
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
};

pub struct BrevoNode;

#[async_trait]
impl Node for BrevoNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "brevo",
            "Brevo",
            "Email and SMS marketing",
            NodeCategory::Marketing,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for brevo
        Ok(NodeOutput::single(input.items))
    }
}
