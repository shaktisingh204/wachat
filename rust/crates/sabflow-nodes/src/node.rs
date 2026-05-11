//! The `Node` trait — every implemented node satisfies this.

use async_trait::async_trait;
use serde_json::Value;

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::NodeDescriptor,
    error::NodeResult,
};

/// Behaviour-bearing node interface.  The registry stores `Box<dyn Node>`.
#[async_trait]
pub trait Node: Send + Sync {
    /// Declarative metadata — UI + engine read this.
    fn descriptor(&self) -> NodeDescriptor;

    /// Run the node against its input items with the given configured params.
    /// `params` is the user's per-instance configuration (the block.options blob).
    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput>;
}
