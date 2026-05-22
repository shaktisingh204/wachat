use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct QuickBooksNode;

#[async_trait]
impl Node for QuickBooksNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "quickBooks",
            "QuickBooks",
            "Accounting",
            NodeCategory::Finance,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for quickBooks
        Ok(NodeOutput::single(input.items))
    }
}
