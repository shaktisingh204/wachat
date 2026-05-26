use serde_json::{json, Value};
use sabflow_nodes::{
    node, ExecutionContext, NodeInput, NodeOutput, NodeProperty, NodePropertyType, NodeResult,
};

pub struct ActionNode;

#[node(
    name = "action",
    display = "Action",
    description = "Action block to execute custom operations",
    category = "action",
    icon = "play",
    color = "#ef4444"
)]
impl ActionNode {
    fn properties() -> Vec<NodeProperty> {
        vec![
            NodeProperty::new("actionType", "Action Type", NodePropertyType::String)
                .default(json!("default"))
                .description("Type of action to execute"),
        ]
    }

    async fn execute(
        &self,
        _ctx: &mut ExecutionContext,
        input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        Ok(NodeOutput::single(input.items))
    }
}
