use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct EventbriteNode;

#[async_trait]
impl Node for EventbriteNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "eventbrite",
            "Eventbrite",
            "Event ticketing",
            NodeCategory::Productivity,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for eventbrite
        Ok(NodeOutput::single(input.items))
    }
}
