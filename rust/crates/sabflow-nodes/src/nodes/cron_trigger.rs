//! Cron Trigger node (`n8n-nodes-base.cron`).
//!
//! Legacy n8n cron trigger — fires a flow on a cron-expression schedule. As
//! with [`IntervalTriggerNode`], the actual scheduling is delegated to
//! **Vercel Cron** per project CLAUDE.md; this node only declares the
//! cron expression and surfaces the tick payload at runtime. NEVER introduce
//! node-cron / agenda / Bull here.
//!
//! Modern flows should prefer [`ScheduleTriggerNode`] (n8n-nodes-base.scheduleTrigger);
//! this node is kept for n8n import compatibility.

use async_trait::async_trait;
use serde_json::{Value, json};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor, NodeProperty, NodePropertyType},
    error::NodeResult,
    node::Node,
};

pub struct CronTriggerNode;

#[async_trait]
impl Node for CronTriggerNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "cron",
            "Cron",
            "Fire on a cron schedule (Vercel Cron-backed, legacy)",
            NodeCategory::Trigger,
        )
        .icon("clock")
        .color("#3b82f6")
        .trigger()
        .properties(vec![
            NodeProperty::new(
                "cronExpression",
                "Cron Expression",
                NodePropertyType::String,
            )
            .default(Value::String("0 9 * * 1-5".into()))
            .required()
            .description(
                "Standard 5-field cron expression (min hour day month weekday). \
                     Sub-minute granularity is not supported on Vercel Cron.",
            ),
            NodeProperty::new("timezone", "Timezone", NodePropertyType::String)
                .default(Value::String("UTC".into()))
                .description("IANA timezone name (e.g. `America/Los_Angeles`)."),
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
