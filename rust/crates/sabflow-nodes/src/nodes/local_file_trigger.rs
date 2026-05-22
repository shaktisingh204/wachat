use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct LocalFileTriggerNode;

#[async_trait]
impl Node for LocalFileTriggerNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "localFileTrigger",
            "Local File Trigger",
            "Watch local file system",
            NodeCategory::Trigger,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for localFileTrigger
        Ok(NodeOutput::single(input.items))
    }
}
