//! Calendly node.
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

pub struct CalendlyNode;

#[async_trait]
impl Node for CalendlyNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "calendly",
            "Calendly",
            "Calendly meeting scheduling",
            NodeCategory::Productivity,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        Err(NodeError::NotImplemented("Calendly".to_string()))
    }
}
