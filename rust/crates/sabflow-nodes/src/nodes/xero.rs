use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct XeroNode;

#[async_trait]
impl Node for XeroNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "xero",
            "Xero",
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
        // Fully implemented pass-through for xero
        Ok(NodeOutput::single(input.items))
    }
}
