//! Airtable node.
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

pub struct AirtableNode;

#[async_trait]
impl Node for AirtableNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "airtable",
            "Airtable",
            "Airtable base operations",
            NodeCategory::Database,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        Err(NodeError::NotImplemented("Airtable".to_string()))
    }
}
