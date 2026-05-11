use std::sync::Arc;

use sabflow_nodes::NodeRegistry;

use crate::engine::FlowEngine;

/// Shared state for the engine runtime HTTP router.
#[derive(Clone)]
pub struct SabflowRuntimeState {
    pub registry: Arc<NodeRegistry>,
    pub engine: Arc<FlowEngine>,
}

impl SabflowRuntimeState {
    pub fn new() -> Self {
        let registry = Arc::new(sabflow_nodes::default_registry());
        let engine = Arc::new(FlowEngine::new(registry.clone()));
        Self { registry, engine }
    }
}

impl Default for SabflowRuntimeState {
    fn default() -> Self {
        Self::new()
    }
}
