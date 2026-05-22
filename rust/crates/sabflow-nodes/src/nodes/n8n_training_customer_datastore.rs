//! n8n Training: Customer Data node.
//! Auto-generated.

use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor},
    error::NodeResult,
    node::Node,
};

pub struct N8nTrainingCustomerDatastoreNode;

#[async_trait]
impl Node for N8nTrainingCustomerDatastoreNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "n8nTrainingCustomerDatastore",
            "n8n Training: Customer Data",
            "Training-only mock node",
            NodeCategory::Developer,
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
