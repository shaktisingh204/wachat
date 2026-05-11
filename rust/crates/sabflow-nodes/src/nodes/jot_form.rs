//! JotForm node.
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

pub struct JotFormNode;

#[async_trait]
impl Node for JotFormNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "jotForm",
            "JotForm",
            "JotForm online forms",
            NodeCategory::Productivity,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        Err(NodeError::NotImplemented("JotForm".to_string()))
    }
}
