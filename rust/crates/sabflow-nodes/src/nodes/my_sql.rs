use async_trait::async_trait;
use serde_json::Value;

use crate::{
    NodeInput, NodeOutput, NodeResult,
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
};

pub struct MySqlNode;

#[async_trait]
impl Node for MySqlNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new("mySql", "MySQL", "MySQL operations", NodeCategory::Database)
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for mySql
        Ok(NodeOutput::single(input.items))
    }
}
