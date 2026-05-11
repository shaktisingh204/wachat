//! GetResponse node.
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

pub struct GetResponseNode;

#[async_trait]
impl Node for GetResponseNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "getResponse",
            "GetResponse",
            "Email marketing",
            NodeCategory::Marketing,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        Err(NodeError::NotImplemented("GetResponse".to_string()))
    }
}
