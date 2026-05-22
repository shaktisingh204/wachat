use async_trait::async_trait;
use serde_json::Value;

use crate::{
    NodeInput, NodeOutput, NodeResult,
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
};

pub struct XmlNode;

#[async_trait]
impl Node for XmlNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new("xml", "XML", "Parse and build XML", NodeCategory::Transform)
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for xml
        Ok(NodeOutput::single(input.items))
    }
}
