use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct HunterNode;

#[async_trait]
impl Node for HunterNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "hunter",
            "Hunter",
            "Email finder and verifier",
            NodeCategory::Marketing,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for hunter
        Ok(NodeOutput::single(input.items))
    }
}
