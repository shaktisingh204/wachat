//! Delay node — pause flow execution for a configured duration.
//!
//! Reads the `durationMs` parameter and sleeps that long before passing
//! items through unchanged. The previous version used a non-existent
//! `#[node(...)]` macro; rewritten to match the canonical `impl Node`
//! shape used by every other node in this crate.

use std::time::Duration;

use async_trait::async_trait;
use serde_json::Value;

use crate::{
    NodeInput, NodeOutput, NodeResult,
    context::ExecutionContext,
    descriptor::{NodeCategory, NodeDescriptor},
    node::Node,
};

pub struct DelayNode;

#[async_trait]
impl Node for DelayNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "delay",
            "Delay",
            "Pause execution for a configured number of milliseconds",
            NodeCategory::Logic,
        )
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let duration_ms = params
            .get("durationMs")
            .and_then(|v| v.as_f64())
            .unwrap_or(1000.0);
        if duration_ms > 0.0 {
            tokio::time::sleep(Duration::from_millis(duration_ms as u64)).await;
        }
        Ok(NodeOutput::single(input.items))
    }
}
