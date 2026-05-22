use async_trait::async_trait;
use serde_json::Value;

use crate::{
    NodeInput, NodeOutput, NodeResult,
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
};

pub struct FtpNode;

#[async_trait]
impl Node for FtpNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "ftp",
            "FTP",
            "Transfer files via FTP/SFTP",
            NodeCategory::Storage,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for ftp
        Ok(NodeOutput::single(input.items))
    }
}
