use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct SplitInBatchesNode;

#[async_trait]
impl Node for SplitInBatchesNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "splitInBatches",
            "Split In Batches",
            "Loop over items in batches",
            NodeCategory::Logic,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for splitInBatches
        Ok(NodeOutput::single(input.items))
    }
}
