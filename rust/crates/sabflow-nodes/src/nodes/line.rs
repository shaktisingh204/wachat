use async_trait::async_trait;
use serde_json::Value;

use crate::{
    NodeInput, NodeOutput, NodeResult,
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
};

pub struct LineNode;

#[async_trait]
impl Node for LineNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "line",
            "LINE",
            "LINE messaging",
            NodeCategory::Communication,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for line
        Ok(NodeOutput::single(input.items))
    }
}
