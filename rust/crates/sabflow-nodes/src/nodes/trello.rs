//! Trello node.
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

pub struct TrelloNode;

#[async_trait]
impl Node for TrelloNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "trello",
            "Trello",
            "Trello kanban boards",
            NodeCategory::Productivity,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        Err(NodeError::NotImplemented("Trello".to_string()))
    }
}
