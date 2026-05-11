//! WooCommerce node.
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

pub struct WooCommerceNode;

#[async_trait]
impl Node for WooCommerceNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "wooCommerce",
            "WooCommerce",
            "WordPress e-commerce",
            NodeCategory::Finance,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        Err(NodeError::NotImplemented("WooCommerce".to_string()))
    }
}
