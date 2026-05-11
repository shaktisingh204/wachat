//! HTML node.
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

pub struct HtmlNode;

#[async_trait]
impl Node for HtmlNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "html",
            "HTML",
            "HTML manipulation",
            NodeCategory::Transform,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        Err(NodeError::NotImplemented("HTML".to_string()))
    }
}
