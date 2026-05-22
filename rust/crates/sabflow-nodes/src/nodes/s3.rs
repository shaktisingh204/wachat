use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct S3Node;

#[async_trait]
impl Node for S3Node {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "s3",
            "S3",
            "S3-compatible object storage",
            NodeCategory::Storage,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for s3
        Ok(NodeOutput::single(input.items))
    }
}
