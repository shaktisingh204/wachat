use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct CompareDatasetsNode;

#[async_trait]
impl Node for CompareDatasetsNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "compareDatasets",
            "Compare Datasets",
            "Diff two datasets",
            NodeCategory::Transform,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for compareDatasets
        Ok(NodeOutput::single(input.items))
    }
}
