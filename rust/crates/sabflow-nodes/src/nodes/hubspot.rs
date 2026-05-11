//! HubSpot node.
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

pub struct HubspotNode;

#[async_trait]
impl Node for HubspotNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "hubspot",
            "HubSpot",
            "HubSpot CRM operations",
            NodeCategory::Crm,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        Err(NodeError::NotImplemented("HubSpot".to_string()))
    }
}
