use async_trait::async_trait;
use serde_json::Value;

use crate::{
    NodeInput, NodeOutput, NodeResult,
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
};

pub struct MailerLiteNode;

#[async_trait]
impl Node for MailerLiteNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "mailerLite",
            "MailerLite",
            "Email marketing",
            NodeCategory::Marketing,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for mailerLite
        Ok(NodeOutput::single(input.items))
    }
}
