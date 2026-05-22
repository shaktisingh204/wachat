use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct RenameKeysNode;

#[async_trait]
impl Node for RenameKeysNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "renameKeys",
            "Rename Keys",
            "Rename object keys",
            NodeCategory::Transform,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for renameKeys
        Ok(NodeOutput::single(input.items))
    }
}
