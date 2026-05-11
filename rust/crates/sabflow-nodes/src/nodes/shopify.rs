//! Shopify node.
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

pub struct ShopifyNode;

#[async_trait]
impl Node for ShopifyNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "shopify",
            "Shopify",
            "Shopify e-commerce",
            NodeCategory::Finance,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        Err(NodeError::NotImplemented("Shopify".to_string()))
    }
}
