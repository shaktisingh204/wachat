//! Schedule Trigger node — `n8n-nodes-base.scheduleTrigger`.
//!
//! Fires a workflow on a recurring schedule. **The actual schedule firing is
//! orchestrated by Vercel Cron** (see `CLAUDE.md` → "Deployment platform")
//! and the `/api/cron/sabflow-scheduled` route. This node only:
//!
//!   1. *Describes* when the workflow should fire — the editor configuration
//!      shape mirrors n8n's `Schedule Trigger` `triggerTimes` fixedCollection
//!      so imported n8n workflows round-trip losslessly.
//!   2. *Surfaces* the dispatcher's `{ scheduledFor, fireKey }` payload as a
//!      single output item when `execute` runs, so downstream nodes can read
//!      `$json.scheduledFor` exactly like in n8n.
//!
//! In-process schedulers (`node-cron`, `agenda`, `Bull`, `tokio::time` loops,
//! etc.) are forbidden — Vercel Functions are ephemeral and stateless, so
//! the source of truth for "when to fire" is Vercel Cron. See
//! `docs/adr/sabflow-executor-foundation.md` §3.
//!
//! Sibling: `src/lib/sabflow/executor/nodes/cron-trigger.ts` — the TypeScript
//! cron-expression compiler that converts `triggerTimes` → 5-field cron
//! strings the dispatcher registers. Field semantics here intentionally
//! match that file 1:1.

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

pub struct ScheduleTriggerNode;

#[async_trait]
impl Node for ScheduleTriggerNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "scheduleTrigger",
            "Schedule Trigger",
            "Fire the workflow on a recurring schedule (powered by Vercel Cron).",
            NodeCategory::Trigger,
        )
        .icon("clock")
        .color("#3b82f6")
        .trigger()
        .properties(vec![
            // n8n parity: `mode` is the discriminator on each `triggerTimes`
            // row. The editor renders mode-specific sub-fields below.
            NodeProperty::new("mode", "Trigger Interval", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "Every Minute".into(),
                        value: Value::String("everyMinute".into()),
                        description: Some(
                            "Fire once a minute (Vercel Cron's resolution floor).".into(),
                        ),
                    },
                    NodePropertyOption {
                        name: "Every Hour".into(),
                        value: Value::String("everyHour".into()),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Every Day".into(),
                        value: Value::String("everyDay".into()),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Every Week".into(),
                        value: Value::String("everyWeek".into()),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Every Month".into(),
                        value: Value::String("everyMonth".into()),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Cron Expression".into(),
                        value: Value::String("cronExpression".into()),
                        description: Some("Provide a raw 5-field POSIX cron expression.".into()),
                    },
                ])
                .default(Value::String("everyDay".into()))
                .required(),
            NodeProperty::new("minute", "Minute", NodePropertyType::Number)
                .default(json!(0))
                .description("Minute of the hour (0–59).")
                .show_when(
                    "mode",
                    &["everyHour", "everyDay", "everyWeek", "everyMonth"],
                ),
            NodeProperty::new("hour", "Hour", NodePropertyType::Number)
                .default(json!(0))
                .description("Hour of the day, UTC (0–23).")
                .show_when("mode", &["everyDay", "everyWeek", "everyMonth"]),
            NodeProperty::new("weekday", "Day of Week", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "Sunday".into(),
                        value: json!(0),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Monday".into(),
                        value: json!(1),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Tuesday".into(),
                        value: json!(2),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Wednesday".into(),
                        value: json!(3),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Thursday".into(),
                        value: json!(4),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Friday".into(),
                        value: json!(5),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Saturday".into(),
                        value: json!(6),
                        description: None,
                    },
                ])
                .default(json!(1))
                .show_when("mode", &["everyWeek"]),
            NodeProperty::new("dayOfMonth", "Day of Month", NodePropertyType::Number)
                .default(json!(1))
                .description("Day of the month (1–31).")
                .show_when("mode", &["everyMonth"]),
            NodeProperty::new("expression", "Cron Expression", NodePropertyType::String)
                .default(Value::String("0 9 * * 1-5".into()))
                .placeholder("0 9 * * 1-5")
                .description(
                    "Raw 5-field cron expression (minute hour dayOfMonth month dayOfWeek). \
                     Sub-minute schedules are rejected — Vercel Cron fires at minute resolution.",
                )
                .show_when("mode", &["cronExpression"]),
            NodeProperty::new("timezone", "Timezone", NodePropertyType::String)
                .default(Value::String("UTC".into()))
                .description("IANA timezone used to evaluate non-cron modes. Cron is always UTC."),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // The dispatcher injects `{ scheduledFor, fireKey }` via trigger_data.
        // When the user clicks "Test step" in the editor (no dispatcher in
        // sight), synthesise a payload pinned to the current minute so
        // downstream nodes still see a realistic shape.
        let payload = ctx.trigger_data.clone().unwrap_or_else(|| {
            let now = chrono::Utc::now().to_rfc3339();
            json!({
                "scheduledFor": now,
                "fireKey": format!("manual:{now}"),
            })
        });
        Ok(NodeOutput::single(vec![payload]))
    }
}
