//! Interval Trigger node (`n8n-nodes-base.interval`).
//!
//! Legacy n8n interval trigger — fires a flow at a fixed interval. SabNode is a
//! Vercel-native project (see project CLAUDE.md), so the actual scheduling is
//! delegated to **Vercel Cron**: on flow activation, a Vercel Cron entry is
//! provisioned that ticks at the configured interval and posts to the engine's
//! internal trigger endpoint. NEVER introduce node-cron / agenda / Bull here.
//!
//! This node's `execute` simply surfaces the cron tick payload (or, when
//! invoked manually, an object containing the current UTC timestamp).

use async_trait::async_trait;
use serde_json::{Value, json};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{
        NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption, NodePropertyType,
    },
    error::NodeResult,
    node::Node,
};

pub struct IntervalTriggerNode;

#[async_trait]
impl Node for IntervalTriggerNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "interval",
            "Interval",
            "Fire at fixed intervals (Vercel Cron-backed)",
            NodeCategory::Trigger,
        )
        .icon("repeat")
        .color("#3b82f6")
        .trigger()
        .properties(vec![
            NodeProperty::new("unit", "Unit", NodePropertyType::Options)
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
                ])
                .default(Value::String("minutes".into())),
            NodeProperty::new("interval", "Interval", NodePropertyType::Number)
                .default(json!(5))
                .description(
                    "How many of the chosen unit to wait between ticks. Vercel Cron has a \
                     1-minute minimum granularity; sub-minute intervals are coalesced upstream.",
                ),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        Ok(NodeOutput::single(vec![
            ctx.trigger_data
                .clone()
                .unwrap_or(json!({ "timestamp": chrono::Utc::now().to_rfc3339() })),
        ]))
    }
}
