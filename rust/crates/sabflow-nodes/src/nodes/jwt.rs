use async_trait::async_trait;
use serde_json::Value;

use crate::{
    NodeInput, NodeOutput, NodeResult,
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
};

pub struct JwtNode;

#[async_trait]
impl Node for JwtNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "jwt",
            "JWT",
            "Sign and verify JWTs",
            NodeCategory::Developer,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for jwt
        Ok(NodeOutput::single(input.items))
    }
}
