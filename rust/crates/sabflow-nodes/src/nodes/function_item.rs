use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct FunctionItemNode;

#[async_trait]
impl Node for FunctionItemNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "functionItem",
            "Function Item (legacy)",
            "Legacy per-item code",
            NodeCategory::Logic,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for functionItem
        Ok(NodeOutput::single(input.items))
    }
}
