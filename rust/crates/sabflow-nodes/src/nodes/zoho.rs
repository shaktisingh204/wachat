//! Zoho node.
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

pub struct ZohoNode;

#[async_trait]
impl Node for ZohoNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "zoho",
            "Zoho",
            "Zoho CRM operations",
            NodeCategory::Crm,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        Err(NodeError::NotImplemented("Zoho".to_string()))
    }
}
