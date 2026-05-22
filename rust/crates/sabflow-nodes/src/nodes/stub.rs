//! Single struct + impl that powers every "stub" node — a registered node
//! that knows its descriptor but returns NotImplemented at runtime.
//! Fully-implemented nodes shadow stubs in [`super::register_all`].

use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::NodeDescriptor,
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct StubNode {
    pub descriptor: NodeDescriptor,
}

#[async_trait]
impl Node for StubNode {
    fn descriptor(&self) -> NodeDescriptor {
        self.descriptor.clone()
    }
    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        Err(NodeError::NotImplemented(
            self.descriptor.display_name.clone(),
        ))
    }
}

/// Helper: build a stub descriptor and immediately wrap it in a StubNode.
pub fn stub(
    name: &str,
    display: &str,
    description: &str,
    category: crate::descriptor::NodeCategory,
) -> StubNode {
    StubNode {
        descriptor: NodeDescriptor::new(name, display, description, category).stub(),
    }
}
