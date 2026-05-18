//! Airtable Trigger node (`n8n-nodes-base.airtableTrigger`).
//!
//! Airtable's REST API does not expose generic outbound webhooks for record
//! changes (webhooks exist but require an Enterprise plan + per-base setup
//! that doesn't map cleanly to multi-tenant SaaS). n8n's published
//! `airtableTrigger` therefore polls a view's records ordered by a
//! `Last Modified` (or `Created` time) field and emits any rows whose
//! timestamp is newer than the previously stored cursor.
//!
//! SabFlow runs on Vercel (per project CLAUDE.md) so activation is again
//! declarative:
//!   - On flow activation, the upstream scheduler provisions a Vercel Cron
//!     tick at `pollTimes`. Each tick lists the chosen view filtered by
//!     `triggerField > storedCursor` and forges the result into
//!     `ExecutionContext::trigger_data` as `{ records: [...] }`.
//!   - On deactivation the cron entry + cursor are removed.
//!
//! The per-tick Airtable list is performed by the same client used by the
//! implemented `airtable` action node — no new top-level dep is added here.

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

pub struct AirtableTriggerNode;

#[async_trait]
impl Node for AirtableTriggerNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "airtableTrigger",
            "Airtable Trigger",
            "Fire on new or updated records in an Airtable view (polled)",
            NodeCategory::Database,
        )
        .icon("table")
        .color("#FFB400")
        .trigger()
        .credentials(vec![CredentialBinding {
            name: "airtableApi".into(),
            display_name: "Airtable Personal Access Token".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("baseId", "Base ID", NodePropertyType::String)
                .placeholder("appXXXXXXXXXXXXXX")
                .required()
                .description("Airtable base identifier (starts with `app`)."),
            NodeProperty::new("tableId", "Table ID or Name", NodePropertyType::String)
                .placeholder("tblXXXXXXXXXXXXXX or 'My Table'")
                .required()
                .description("Table identifier (starts with `tbl`) or its display name."),
            NodeProperty::new("viewId", "View", NodePropertyType::String)
                .placeholder("viwXXXXXXXXXXXXXX (optional)")
                .description(
                    "Optional view ID. When set, only records visible in this view are polled.",
                ),
            NodeProperty::new(
                "triggerField",
                "Trigger Field",
                NodePropertyType::String,
            )
            .default(Value::String("Last Modified".into()))
            .required()
            .description(
                "Name of a Date/DateTime field used as the polling cursor — typically a \
                 `Last Modified Time` (for updates) or `Created Time` (for inserts) field.",
            ),
            NodeProperty::new("event", "Event", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "Record Created".into(),
                        value: Value::String("recordCreated".into()),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Record Updated".into(),
                        value: Value::String("recordUpdated".into()),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Record Created or Updated".into(),
                        value: Value::String("recordCreatedOrUpdated".into()),
                        description: None,
                    },
                ])
                .default(Value::String("recordCreatedOrUpdated".into())),
            NodeProperty::new(
                "pollTimes",
                "Poll Interval (Minutes)",
                NodePropertyType::Number,
            )
            .default(json!(1))
            .description(
                "How often to poll Airtable. Backed by Vercel Cron — minimum 1 minute.",
            ),
            NodeProperty::new(
                "downloadAttachments",
                "Download Attachments to SabFiles",
                NodePropertyType::Boolean,
            )
            .default(Value::Bool(false))
            .description(
                "When enabled, any attachment cells in returned records are uploaded to the \
                 workspace's SabFiles library (per project policy — never via free-text URLs) \
                 and the cell is rewritten with SabFile refs.",
            ),
            NodeProperty::new(
                "additionalFields",
                "Additional Fields",
                NodePropertyType::Json,
            )
            .default(json!({}))
            .description(
                "Optional extras (`fields`, `filterByFormula`, `maxRecords`) passed straight \
                 through to the Airtable List Records call.",
            ),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        _params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Each tick forges `{ records: [...] }` into trigger_data.
        let payload = ctx
            .trigger_data
            .clone()
            .unwrap_or(json!({ "records": [] }));
        Ok(NodeOutput::single(vec![payload]))
    }
}
