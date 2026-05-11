//! Schedule Trigger node.
//!
//! Fires a flow on a recurring schedule. The actual scheduling is performed
//! upstream of the engine (BullMQ): when a tick fires, the trigger data is
//! passed through `ExecutionContext::trigger_data`. This node's `execute`
//! simply surfaces that payload as a single output item so downstream nodes
//! can read it.

use async_trait::async_trait;
use serde_json::{json, Value};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption, NodePropertyType},
    error::NodeResult,
    node::Node,
};

pub struct ScheduleTriggerNode;

#[async_trait]
impl Node for ScheduleTriggerNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "scheduleTrigger",
            "Schedule Trigger",
            "Fire on a schedule",
            NodeCategory::Trigger,
        )
        .icon("clock")
        .color("#3b82f6")
        .trigger()
        .properties(vec![
            NodeProperty::new("triggerInterval", "Trigger Interval", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "Seconds".into(),
                        value: Value::String("seconds".into()),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Minutes".into(),
                        value: Value::String("minutes".into()),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Hours".into(),
                        value: Value::String("hours".into()),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Days".into(),
                        value: Value::String("days".into()),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Weeks".into(),
                        value: Value::String("weeks".into()),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Cron Expression".into(),
                        value: Value::String("cronExpression".into()),
                        description: None,
                    },
                ])
                .default(Value::String("minutes".into())),
            NodeProperty::new("secondsBetween", "Seconds Between", NodePropertyType::Number)
                .default(json!(30))
                .show_when("triggerInterval", &["seconds"]),
            NodeProperty::new("minutesBetween", "Minutes Between", NodePropertyType::Number)
                .default(json!(5))
                .show_when("triggerInterval", &["minutes"]),
            NodeProperty::new("hoursBetween", "Hours Between", NodePropertyType::Number)
                .default(json!(1))
                .show_when("triggerInterval", &["hours"]),
            NodeProperty::new("daysBetween", "Days Between", NodePropertyType::Number)
                .default(json!(1))
                .show_when("triggerInterval", &["days"]),
            NodeProperty::new("weeksBetween", "Weeks Between", NodePropertyType::Number)
                .default(json!(1))
                .show_when("triggerInterval", &["weeks"]),
            NodeProperty::new("cronExpression", "Cron Expression", NodePropertyType::String)
                .default(Value::String("0 9 * * 1-5".into()))
                .show_when("triggerInterval", &["cronExpression"]),
            NodeProperty::new("timezone", "Timezone", NodePropertyType::String)
                .default(Value::String("UTC".into())),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        Ok(NodeOutput::single(vec![ctx
            .trigger_data
            .clone()
            .unwrap_or(json!({ "timestamp": chrono::Utc::now().to_rfc3339() }))]))
    }
}
