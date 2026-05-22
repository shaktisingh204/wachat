use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct HelpScoutNode;

#[async_trait]
impl Node for HelpScoutNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "helpScout",
            "Help Scout",
            "Customer support",
            NodeCategory::Communication,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for helpScout
        Ok(NodeOutput::single(input.items))
    }
}
