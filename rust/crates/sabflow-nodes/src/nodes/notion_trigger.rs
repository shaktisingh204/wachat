//! Notion Trigger node (`n8n-nodes-base.notionTrigger`).
//!
//! Notion has no first-class outbound webhook for arbitrary database/page
//! events. n8n therefore implements this trigger as a **poller** that scans
//! a database or page tree at a fixed interval and emits any items whose
//! `last_edited_time` (or `created_time`, depending on the configured
//! `event`) is newer than the previously observed cursor.
//!
//! On Vercel (per project CLAUDE.md) we have no long-lived workers, so
//! activation is handled declaratively:
//!   - On flow activation, the upstream scheduler provisions a Vercel Cron
//!     tick at `pollTimes` (default: every minute). Each tick runs the
//!     Notion query against the configured database/page, diffs against the
//!     stored cursor in the trigger-state table, and forges any new items
//!     into `ExecutionContext::trigger_data` as `{ items: [...] }`.
//!   - On deactivation the cron entry is removed and the cursor is dropped.
//!
//! This node's `execute` simply surfaces the per-tick payload. No persistent
//! HTTP receiver — that's the activation contract above.
//!
//! No new top-level deps are introduced (the cron + Notion REST call live in
//! the existing scheduler / `notion` action node).

use async_trait::async_trait;
use serde_json::{Value, json};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{
        CredentialBinding, NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption,
        NodePropertyType,
    },
    error::NodeResult,
    node::Node,
};

pub struct NotionTriggerNode;

#[async_trait]
impl Node for NotionTriggerNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "notionTrigger",
            "Notion Trigger",
            "Fire on new or updated items in a Notion database or page (polled)",
            NodeCategory::Productivity,
        )
        .icon("notion")
        .color("#000000")
        .trigger()
        .credentials(vec![CredentialBinding {
            name: "notionApi".into(),
            display_name: "Notion API".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("event", "Event", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "Page Added to Database".into(),
                        value: Value::String("pageAddedToDatabase".into()),
                        description: Some(
                            "Fire when a new page is created inside the chosen database.".into(),
                        ),
                    },
                    NodePropertyOption {
                        name: "Page Updated in Database".into(),
                        value: Value::String("pageUpdatedInDatabase".into()),
                        description: Some(
                            "Fire when an existing page's properties are edited.".into(),
                        ),
                    },
                    NodePropertyOption {
                        name: "Page Added Under Page".into(),
                        value: Value::String("pageAddedUnderPage".into()),
                        description: Some(
                            "Fire when a new sub-page is created under the chosen page.".into(),
                        ),
                    },
                ])
                .default(Value::String("pageAddedToDatabase".into()))
                .required(),
            NodeProperty::new("databaseId", "Database", NodePropertyType::String)
                .placeholder("32-char Notion database ID")
                .show_when(
                    "event",
                    &["pageAddedToDatabase", "pageUpdatedInDatabase"],
                )
                .description(
                    "ID of the Notion database to poll. The credential's integration must be \
                     shared with this database.",
                ),
            NodeProperty::new("pageId", "Page", NodePropertyType::String)
                .placeholder("32-char Notion page ID")
                .show_when("event", &["pageAddedUnderPage"])
                .description(
                    "ID of the parent page whose direct children should be watched.",
                ),
            NodeProperty::new("pollTimes", "Poll Interval (Minutes)", NodePropertyType::Number)
                .default(json!(1))
                .description(
                    "How often to poll Notion. Backed by Vercel Cron — minimum 1 minute. \
                     Notion has no outbound webhook so polling is the only option.",
                ),
            NodeProperty::new("simplify", "Simplify Output", NodePropertyType::Boolean)
                .default(Value::Bool(true))
                .description(
                    "When enabled, page properties are flattened to plain key/value pairs \
                     instead of Notion's nested rich-text/typed-property objects.",
                ),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Each cron tick forges `{ items: [...] }` into trigger_data;
        // a manual test run gets an empty-list placeholder so downstream
        // nodes still receive one input item.
        let payload = ctx
            .trigger_data
            .clone()
            .unwrap_or(json!({ "items": [] }));
        Ok(NodeOutput::single(vec![payload]))
    }
}
