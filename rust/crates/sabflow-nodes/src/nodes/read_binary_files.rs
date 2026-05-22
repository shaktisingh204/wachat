//! Read Binary Files node.
//! Auto-generated.

use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor},
    error::NodeResult,
    node::Node,
};

pub struct ReadBinaryFilesNode;

#[async_trait]
impl Node for ReadBinaryFilesNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "readBinaryFiles",
            "Read Binary Files",
            "Read multiple files",
            NodeCategory::Files,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fallback pass-through implementation
        // The frontend uses the forge fallback when available.
        Ok(NodeOutput::single(input.items))
    }
}
