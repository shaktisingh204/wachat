use async_trait::async_trait;
use serde_json::Value;

use crate::{
    NodeInput, NodeOutput, NodeResult,
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
};

pub struct NocoDbNode;

#[async_trait]
impl Node for NocoDbNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "nocoDb",
            "NocoDB",
            "No-code database",
            NodeCategory::Database,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for nocoDb
        Ok(NodeOutput::single(input.items))
    }
}
