use serde_json::{json, Value};
use sabflow_nodes::{
    node, ExecutionContext, NodeInput, NodeOutput, NodeProperty, NodePropertyType, NodeResult,
};

pub struct LogicNode;

#[node(
    name = "logic",
    display = "Logic",
    description = "Logic block for workflow execution",
    category = "logic",
    icon = "git-branch",
    color = "#8b5cf6"
)]
impl LogicNode {
    fn properties() -> Vec<NodeProperty> {
        vec![
            NodeProperty::new("condition", "Condition", NodePropertyType::String)
                .default(json!(""))
                .description("Condition to evaluate"),
        ]
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Just pass through for now
        Ok(NodeOutput::single(input.items))
    }
}
