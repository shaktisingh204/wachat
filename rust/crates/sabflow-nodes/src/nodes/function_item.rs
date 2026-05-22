//! Function Item (legacy) node.
//! Auto-generated.

use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor},
    error::NodeResult,
    node::Node,
};

pub struct FunctionItemNode;

#[async_trait]
impl Node for FunctionItemNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "functionItem",
            "Function Item (legacy)",
            "Legacy per-item code",
            NodeCategory::Logic,
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
