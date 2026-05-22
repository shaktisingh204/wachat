//! Split In Batches node.
//! Auto-generated.

use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor},
    error::NodeResult,
    node::Node,
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
        // Fallback pass-through implementation
        // The frontend uses the forge fallback when available.
        Ok(NodeOutput::single(input.items))
    }
}
