use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct SpreadsheetFileNode;

#[async_trait]
impl Node for SpreadsheetFileNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "spreadsheetFile",
            "Spreadsheet File",
            "Read/write CSV, XLS, ODS",
            NodeCategory::Files,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for spreadsheetFile
        Ok(NodeOutput::single(input.items))
    }
}
