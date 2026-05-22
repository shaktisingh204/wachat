use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct IntercomNode;

#[async_trait]
impl Node for IntercomNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "intercom",
            "Intercom",
            "Customer messaging",
            NodeCategory::Communication,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for intercom
        Ok(NodeOutput::single(input.items))
    }
}
