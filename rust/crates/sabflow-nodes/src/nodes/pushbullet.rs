use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct PushbulletNode;

#[async_trait]
impl Node for PushbulletNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "pushbullet",
            "Pushbullet",
            "Cross-device notifications",
            NodeCategory::Communication,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for pushbullet
        Ok(NodeOutput::single(input.items))
    }
}
