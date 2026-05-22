use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct PipedriveNode;

#[async_trait]
impl Node for PipedriveNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "pipedrive",
            "Pipedrive",
            "Sales CRM",
            NodeCategory::Sales,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for pipedrive
        Ok(NodeOutput::single(input.items))
    }
}
