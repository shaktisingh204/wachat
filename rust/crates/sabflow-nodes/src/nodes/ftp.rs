//! FTP node.
//!
//! TODO(sabflow): full implementation — currently returns NotImplemented.

use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor},
    error::{NodeError, NodeResult},
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
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        Err(NodeError::NotImplemented("FTP".to_string()))
    }
}
