use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct JenkinsNode;

#[async_trait]
impl Node for JenkinsNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "jenkins",
            "Jenkins",
            "CI/CD jobs",
            NodeCategory::Developer,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for jenkins
        Ok(NodeOutput::single(input.items))
    }
}
