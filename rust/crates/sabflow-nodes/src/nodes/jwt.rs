//! JWT node.
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

pub struct JwtNode;

#[async_trait]
impl Node for JwtNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "jwt",
            "JWT",
            "Sign and verify JWTs",
            NodeCategory::Developer,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        Err(NodeError::NotImplemented("JWT".to_string()))
    }
}
