//! Pipedrive node.
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

pub struct PipedriveNode;

#[async_trait]
impl Node for PipedriveNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "pipedrive",
            "Pipedrive",
            "Pipedrive sales CRM",
            NodeCategory::Sales,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        Err(NodeError::NotImplemented("Pipedrive".to_string()))
    }
}
