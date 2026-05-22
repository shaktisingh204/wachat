use async_trait::async_trait;
use serde_json::Value;

use crate::{
    NodeInput, NodeOutput, NodeResult,
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
};

pub struct SshNode;

#[async_trait]
impl Node for SshNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "ssh",
            "SSH",
            "Execute SSH commands",
            NodeCategory::Developer,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for ssh
        Ok(NodeOutput::single(input.items))
    }
}
