//! Google Sheets node.
//!
//! TODO(sabflow): full implementation — currently returns NotImplemented.

use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor},
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct GoogleSheetsNode;

#[async_trait]
impl Node for GoogleSheetsNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "googleSheets",
            "Google Sheets",
            "Read and write Google Sheets",
            NodeCategory::Productivity,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        Err(NodeError::NotImplemented("Google Sheets".to_string()))
    }
}
