//! Segment node.
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

pub struct SegmentNode;

#[async_trait]
impl Node for SegmentNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "segment",
            "Segment",
            "Segment customer data platform",
            NodeCategory::Analytics,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        Err(NodeError::NotImplemented("Segment".to_string()))
    }
}
