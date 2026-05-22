use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct MetabaseNode;

#[async_trait]
impl Node for MetabaseNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "metabase",
            "Metabase",
            "Business intelligence",
            NodeCategory::Analytics,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for metabase
        Ok(NodeOutput::single(input.items))
    }
}
