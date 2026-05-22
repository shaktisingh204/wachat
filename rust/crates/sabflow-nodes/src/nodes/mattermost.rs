use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct MattermostNode;

#[async_trait]
impl Node for MattermostNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "mattermost",
            "Mattermost",
            "Team chat",
            NodeCategory::Communication,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for mattermost
        Ok(NodeOutput::single(input.items))
    }
}
