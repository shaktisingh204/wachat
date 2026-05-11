//! Schedule Trigger node.
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

pub struct ScheduleTriggerNode;

#[async_trait]
impl Node for ScheduleTriggerNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "scheduleTrigger",
            "Schedule Trigger",
            "Fire on a schedule",
            NodeCategory::Trigger,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        Err(NodeError::NotImplemented("Schedule Trigger".to_string()))
    }
}
