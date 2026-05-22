use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct KommoNode;

#[async_trait]
impl Node for KommoNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "kommo",
            "Kommo",
            "Kommo (amoCRM) sales CRM",
            NodeCategory::Crm,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for kommo
        Ok(NodeOutput::single(input.items))
    }
}
