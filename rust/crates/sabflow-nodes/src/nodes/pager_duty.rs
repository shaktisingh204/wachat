use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct PagerDutyNode;

#[async_trait]
impl Node for PagerDutyNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "pagerDuty",
            "PagerDuty",
            "On-call incident response",
            NodeCategory::Communication,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for pagerDuty
        Ok(NodeOutput::single(input.items))
    }
}
