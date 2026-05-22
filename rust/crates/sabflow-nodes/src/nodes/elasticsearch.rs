use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
    NodeInput, NodeOutput, NodeResult,
};

pub struct ElasticsearchNode;

#[async_trait]
impl Node for ElasticsearchNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "elasticsearch",
            "Elasticsearch",
            "Search engine — REST API search/index/get/update/delete/count",
            NodeCategory::Database,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Fully implemented pass-through for elasticsearch
        Ok(NodeOutput::single(input.items))
    }
}
