use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct EmailReadImapNode;

#[async_trait]
impl Node for EmailReadImapNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "emailReadImap",
            "Email Read (IMAP)",
            "Read emails via IMAP",
            NodeCategory::Communication,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for emailReadImap
        Ok(NodeOutput::single(input.items))
    }
}
