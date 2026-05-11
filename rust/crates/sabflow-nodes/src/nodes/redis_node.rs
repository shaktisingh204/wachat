//! Redis node.
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

pub struct RedisNode;

#[async_trait]
impl Node for RedisNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "redis",
            "Redis",
            "Redis cache operations",
            NodeCategory::Database,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        Err(NodeError::NotImplemented("Redis".to_string()))
    }
}
