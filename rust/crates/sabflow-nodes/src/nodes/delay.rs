use serde_json::{json, Value};
use sabflow_nodes::{
    node, ExecutionContext, NodeInput, NodeOutput, NodeProperty, NodePropertyType, NodeResult,
};
use std::time::Duration;

pub struct DelayNode;

#[node(
    name = "delay",
    display = "Delay",
    description = "Delay block to pause execution",
    category = "logic",
    icon = "clock",
    color = "#3b82f6"
)]
impl DelayNode {
    fn properties() -> Vec<NodeProperty> {
        vec![
            NodeProperty::new("durationMs", "Duration (ms)", NodePropertyType::Number)
                .default(json!(1000))
                .description("Amount of time to delay in milliseconds"),
        ]
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let duration_ms = ctx.param_f64(params, "durationMs").unwrap_or(1000.0);
        if duration_ms > 0.0 {
            tokio::time::sleep(Duration::from_millis(duration_ms as u64)).await;
        }
        Ok(NodeOutput::single(input.items))
    }
}
