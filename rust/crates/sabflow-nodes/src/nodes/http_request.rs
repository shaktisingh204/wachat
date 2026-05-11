//! HTTP Request node.
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

pub struct HttpRequestNode;

#[async_trait]
impl Node for HttpRequestNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "httpRequest",
            "HTTP Request",
            "Make HTTP requests",
            NodeCategory::Action,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        Err(NodeError::NotImplemented("HTTP Request".to_string()))
    }
}
