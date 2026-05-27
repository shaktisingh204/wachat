//! Logic node — generic conditional placeholder.
//!
//! Currently a pass-through. Concrete branching is handled by the
//! standard If / Switch / Merge nodes; this node exists as a UI palette
//! entry under "logic" for users to drop in before wiring up real
//! conditions.

use async_trait::async_trait;
use serde_json::Value;

use crate::{
    NodeInput, NodeOutput, NodeResult,
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
};

pub struct LogicNode;

#[async_trait]
impl Node for LogicNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "logic",
            "Logic",
            "Logic block for workflow execution",
            NodeCategory::Logic,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        Ok(NodeOutput::single(input.items))
    }
}
