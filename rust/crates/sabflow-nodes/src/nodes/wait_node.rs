//! Wait node.
//!
//! Pauses flow execution. Supports fixed intervals (`interval` /
//! `timeInterval`) and a `webhook` resume mode that defers to the engine.

use std::time::Duration;

use async_trait::async_trait;
use serde_json::{json, Value};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption, NodePropertyType},
    error::{NodeError, NodeResult},
    node::Node,
};

/// Hard ceiling on how long a worker is allowed to block in a sleep call.
/// Longer waits must be modeled by the engine (scheduler / webhook resume).
const MAX_SLEEP_SECS: u64 = 60;

pub struct WaitNode;

#[async_trait]
impl Node for WaitNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new("wait", "Wait", "Pause for a duration", NodeCategory::Logic)
            .icon("clock")
            .color("#94a3b8")
            .properties(vec![
                NodeProperty::new("resume", "Resume", NodePropertyType::Options)
                    .options(vec![
                        NodePropertyOption {
                            name: "After Interval".into(),
                            value: json!("interval"),
                            description: Some("Sleep for a fixed duration".into()),
                        },
                        NodePropertyOption {
                            name: "On Webhook".into(),
                            value: json!("webhook"),
                            description: Some(
                                "Park the execution; engine resumes on webhook hit".into(),
                            ),
                        },
                        NodePropertyOption {
                            name: "Time Interval".into(),
                            value: json!("timeInterval"),
                            description: Some("Sleep for a fixed amount of time".into()),
                        },
                    ])
                    .default(json!("interval"))
                    .required(),
                NodeProperty::new("amount", "Amount", NodePropertyType::Number)
                    .default(json!(1))
                    .show_when("resume", &["interval", "timeInterval"]),
                NodeProperty::new("unit", "Unit", NodePropertyType::Options)
                    .options(vec![
                        NodePropertyOption {
                            name: "Seconds".into(),
                            value: json!("seconds"),
                            description: None,
                        },
                        NodePropertyOption {
                            name: "Minutes".into(),
                            value: json!("minutes"),
                            description: None,
                        },
                        NodePropertyOption {
                            name: "Hours".into(),
                            value: json!("hours"),
                            description: None,
                        },
                        NodePropertyOption {
                            name: "Days".into(),
                            value: json!("days"),
                            description: None,
                        },
                    ])
                    .default(json!("seconds"))
                    .show_when("resume", &["interval", "timeInterval"]),
            ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let resume = ctx
            .param_str_opt(params, "resume")
            .unwrap_or_else(|| "interval".to_string());

        match resume.as_str() {
            "interval" | "timeInterval" => {
                let amount = ctx.param_f64(params, "amount").unwrap_or(1.0);
                if amount.is_nan() || amount < 0.0 {
                    return Err(NodeError::InvalidParameter {
                        name: "amount".into(),
                        reason: "must be a non-negative number".into(),
                    });
                }
                let unit = ctx
                    .param_str_opt(params, "unit")
                    .unwrap_or_else(|| "seconds".to_string());

                let seconds_per_unit: f64 = match unit.as_str() {
                    "seconds" => 1.0,
                    "minutes" => 60.0,
                    "hours" => 3_600.0,
                    "days" => 86_400.0,
                    other => {
                        return Err(NodeError::InvalidParameter {
                            name: "unit".into(),
                            reason: format!("unknown unit: {other}"),
                        });
                    }
                };

                let requested_secs = amount * seconds_per_unit;
                let capped_secs =
                    requested_secs.min(MAX_SLEEP_SECS as f64).max(0.0);
                let dur = Duration::from_secs_f64(capped_secs);

                tokio::time::sleep(dur).await;

                Ok(NodeOutput::single(input.items))
            }

            "webhook" => Err(NodeError::NotImplemented(
                "Wait(webhook): webhook resumption is handled by the engine, not this node".into(),
            )),

            other => Err(NodeError::InvalidParameter {
                name: "resume".into(),
                reason: format!("unknown resume mode: {other}"),
            }),
        }
    }
}
