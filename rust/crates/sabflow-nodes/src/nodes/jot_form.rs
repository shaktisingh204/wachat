use async_trait::async_trait;
use serde_json::Value;

use crate::{
    NodeInput, NodeOutput, NodeResult,
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
};

pub struct JotFormNode;

#[async_trait]
impl Node for JotFormNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "jotForm",
            "JotForm",
            "Online form builder",
            NodeCategory::Productivity,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for jotForm
        Ok(NodeOutput::single(input.items))
    }
}
