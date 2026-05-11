//! Date and Time node.
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

pub struct DateTimeNode;

#[async_trait]
impl Node for DateTimeNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "dateTime",
            "Date and Time",
            "Format and manipulate dates",
            NodeCategory::Transform,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        Err(NodeError::NotImplemented("Date and Time".to_string()))
    }
}
