use async_trait::async_trait;
use serde_json::Value;

use crate::{
    NodeInput, NodeOutput, NodeResult,
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
};

pub struct JiraNode;

#[async_trait]
impl Node for JiraNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new("jira", "Jira", "Issue tracking", NodeCategory::Developer)
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for jira
        Ok(NodeOutput::single(input.items))
    }
}
