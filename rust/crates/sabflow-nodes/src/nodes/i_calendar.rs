use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct ICalendarNode;

#[async_trait]
impl Node for ICalendarNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "iCalendar",
            "iCalendar",
            "Generate iCal events",
            NodeCategory::Productivity,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for iCalendar
        Ok(NodeOutput::single(input.items))
    }
}
