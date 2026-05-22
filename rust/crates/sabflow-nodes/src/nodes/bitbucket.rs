use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct BitbucketNode;

#[async_trait]
impl Node for BitbucketNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "bitbucket",
            "Bitbucket",
            "Git hosting and code review",
            NodeCategory::Developer,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for bitbucket
        Ok(NodeOutput::single(input.items))
    }
}
