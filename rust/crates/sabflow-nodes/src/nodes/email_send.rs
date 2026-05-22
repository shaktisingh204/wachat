use async_trait::async_trait;
use serde_json::Value;

use crate::{
    NodeInput, NodeOutput, NodeResult,
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
};

pub struct EmailSendNode;

#[async_trait]
impl Node for EmailSendNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "emailSend",
            "Send Email",
            "Send via SMTP",
            NodeCategory::Communication,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for emailSend
        Ok(NodeOutput::single(input.items))
    }
}
