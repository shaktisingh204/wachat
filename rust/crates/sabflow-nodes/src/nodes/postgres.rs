//! Postgres node.
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

pub struct PostgresNode;

#[async_trait]
impl Node for PostgresNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "postgres",
            "Postgres",
            "Run SQL on PostgreSQL",
            NodeCategory::Database,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        Err(NodeError::NotImplemented("Postgres".to_string()))
    }
}
