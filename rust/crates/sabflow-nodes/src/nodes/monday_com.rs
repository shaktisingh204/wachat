//! monday.com node.
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

pub struct MondayComNode;

#[async_trait]
impl Node for MondayComNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "mondayCom",
            "monday.com",
            "monday.com work OS",
            NodeCategory::Productivity,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        Err(NodeError::NotImplemented("monday.com".to_string()))
    }
}
