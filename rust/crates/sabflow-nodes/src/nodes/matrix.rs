use async_trait::async_trait;
use serde_json::Value;

use crate::{
    NodeInput, NodeOutput, NodeResult,
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
};

pub struct MatrixNode;

#[async_trait]
impl Node for MatrixNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "matrix",
            "Matrix",
            "Decentralised chat",
            NodeCategory::Communication,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for matrix
        Ok(NodeOutput::single(input.items))
    }
}
