//! Metabase node.
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

pub struct MetabaseNode;

#[async_trait]
impl Node for MetabaseNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "metabase",
            "Metabase",
            "Metabase business intelligence",
            NodeCategory::Analytics,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        Err(NodeError::NotImplemented("Metabase".to_string()))
    }
}
