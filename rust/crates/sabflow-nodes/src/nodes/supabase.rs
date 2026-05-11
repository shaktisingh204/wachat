//! Supabase node.
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

pub struct SupabaseNode;

#[async_trait]
impl Node for SupabaseNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "supabase",
            "Supabase",
            "Supabase database operations",
            NodeCategory::Database,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        Err(NodeError::NotImplemented("Supabase".to_string()))
    }
}
