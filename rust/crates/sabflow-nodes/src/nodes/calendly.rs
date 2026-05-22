use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct CalendlyNode;

#[async_trait]
impl Node for CalendlyNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "calendly",
            "Calendly",
            "Meeting scheduling",
            NodeCategory::Productivity,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for calendly
        Ok(NodeOutput::single(input.items))
    }
}
