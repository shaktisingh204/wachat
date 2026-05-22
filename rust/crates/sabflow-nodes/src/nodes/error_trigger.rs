use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct ErrorTriggerNode;

#[async_trait]
impl Node for ErrorTriggerNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "errorTrigger",
            "Error Trigger",
            "Triggers on workflow errors",
            NodeCategory::Trigger,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for errorTrigger
        Ok(NodeOutput::single(input.items))
    }
}
