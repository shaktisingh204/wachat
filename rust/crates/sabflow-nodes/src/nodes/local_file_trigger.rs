//! Local File Trigger node (`n8n-nodes-base.localFileTrigger`).
//!
//! In n8n this watches a directory on the host filesystem (via chokidar) and
//! fires when a file is added, changed, or removed. SabFlow runs on Vercel
//! (per project CLAUDE.md), where there is no persistent local filesystem
//! — Function instances are ephemeral and read-only outside `/tmp`. Therefore
//! this node is registered as **stub-only**: it exposes the n8n property shape
//! for import compatibility but its `execute` is a no-op that just surfaces
//! any trigger data that may have been forged in by a SabFiles webhook bridge.
//!
//! If a SabFiles-driven equivalent is needed (watch a folder in the user's
//! SabFiles library), wire it up via a webhook trigger fired by SabFiles
//! change events — do **not** add a filesystem watcher here.

use async_trait::async_trait;
use serde_json::{Value, json};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption, NodePropertyType},
    error::NodeResult,
    node::Node,
};

pub struct LocalFileTriggerNode;

#[async_trait]
impl Node for LocalFileTriggerNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "localFileTrigger",
            "Local File Trigger",
            "Watch a directory for file changes (Vercel-hosted stub)",
            NodeCategory::Trigger,
        )
        .icon("folder-tree")
        .color("#94a3b8")
        .trigger()
        .properties(vec![
            NodeProperty::new("triggerOn", "Trigger On", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "Specific Folder".into(),
                        value: Value::String("folder".into()),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Specific File".into(),
                        value: Value::String("file".into()),
                        description: None,
                    },
                ])
                .default(Value::String("folder".into())),
            NodeProperty::new("path", "Path", NodePropertyType::String)
                .default(Value::String(String::new()))
                .description(
                    "Path to watch. NOTE: SabFlow runs on Vercel — there is no persistent \
                     local filesystem, so this node is non-functional. Use a SabFiles webhook \
                     trigger instead for folder-change events.",
                ),
            NodeProperty::new("events", "Events", NodePropertyType::MultiOptions)
                .options(vec![
                    NodePropertyOption {
                        name: "Add".into(),
                        value: Value::String("add".into()),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Change".into(),
                        value: Value::String("change".into()),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Unlink".into(),
                        value: Value::String("unlink".into()),
                        description: None,
                    },
                ])
                .default(json!(["add"])),
            NodeProperty::new("usePolling", "Use Polling", NodePropertyType::Boolean)
                .default(Value::Bool(false))
                .description("Has no effect on Vercel; retained for n8n import parity."),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Surfaces whatever the activator forged in; in practice this trigger
        // is never wired on Vercel and `trigger_data` will be `None`.
        Ok(NodeOutput::single(vec![ctx
            .trigger_data
            .clone()
            .unwrap_or(json!({
                "stub": true,
                "reason": "Local filesystem triggers are not available on Vercel"
            }))]))
    }
}
