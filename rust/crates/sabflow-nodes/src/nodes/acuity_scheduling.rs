//! Acuity Scheduling node.
//! Auto-generated.

use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor},
    error::NodeResult,
    node::Node,
};

pub struct AcuitySchedulingNode;

#[async_trait]
impl Node for AcuitySchedulingNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "acuityScheduling",
            "Acuity Scheduling",
            "Online appointment scheduling",
            NodeCategory::Productivity,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fallback pass-through implementation
        // The frontend uses the forge fallback when available.
        Ok(NodeOutput::single(input.items))
    }
}
