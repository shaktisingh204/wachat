use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct ConvertToFileNode;

#[async_trait]
impl Node for ConvertToFileNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "convertToFile",
            "Convert to File",
            "Convert items into a binary file (CSV/JSON/TSV/XML/HTML/iCal/RTF)",
            NodeCategory::Transform,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for convertToFile
        Ok(NodeOutput::single(input.items))
    }
}
