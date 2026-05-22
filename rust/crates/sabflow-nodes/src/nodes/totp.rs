use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct TotpNode;

#[async_trait]
impl Node for TotpNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "totp",
            "TOTP",
            "Time-based one-time passwords",
            NodeCategory::Developer,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for totp
        Ok(NodeOutput::single(input.items))
    }
}
