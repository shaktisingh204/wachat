//! MongoDB node.
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

pub struct MongoDbNode;

#[async_trait]
impl Node for MongoDbNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "mongoDb",
            "MongoDB",
            "MongoDB CRUD operations",
            NodeCategory::Database,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        Err(NodeError::NotImplemented("MongoDB".to_string()))
    }
}
