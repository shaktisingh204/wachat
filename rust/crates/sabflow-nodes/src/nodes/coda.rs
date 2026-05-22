use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct CodaNode;

#[async_trait]
impl Node for CodaNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "coda",
            "Coda",
            "All-in-one doc",
            NodeCategory::Productivity,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for coda
        Ok(NodeOutput::single(input.items))
    }
}
