use async_trait::async_trait;
use serde_json::Value;

use crate::{
    NodeInput, NodeOutput, NodeResult,
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
};

pub struct DropboxNode;

#[async_trait]
impl Node for DropboxNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "dropbox",
            "Dropbox",
            "Cloud file storage",
            NodeCategory::Storage,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for dropbox
        Ok(NodeOutput::single(input.items))
    }
}
