//! Google Sheets Trigger node.
//!
//! Fires a SabFlow when rows are added or updated in a Google Sheet. Google
//! Sheets has no native push-webhook for cell changes, so this trigger uses
//! **declarative polling**: the descriptor advertises a `pollInterval` and
//! `event` filter, and the upstream scheduler polls the Sheets API on that
//! cadence, comparing the current state against the last cursor (stored in
//! `ctx.variables["__cursor"]`). When the poll detects new or changed rows,
//! it invokes the flow with the new rows in [`ExecutionContext::trigger_data`].
//!
//! For symmetry with the Pub/Sub-based triggers, this node also accepts an
//! optional Bearer-verified webhook envelope (in case a customer wires up a
//! third-party "Sheets-to-webhook" relay such as Apps Script). When
//! `pubsubVerified=true` is present on the trigger data, we trust the payload
//! shape verbatim; otherwise we fall back to the polling-cursor shape.
//!
//! n8n parity: `n8n-nodes-base.googleSheetsTrigger`.

use async_trait::async_trait;
use serde_json::{json, Value};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{
        CredentialBinding, NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption,
        NodePropertyType,
    },
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct GoogleSheetsTriggerNode;

#[async_trait]
impl Node for GoogleSheetsTriggerNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "googleSheetsTrigger",
            "Google Sheets Trigger",
            "Fire when rows are added or updated in a Google Sheet (poll-based)",
            NodeCategory::Trigger,
        )
        .icon("table")
        .color("#34A853")
        .trigger()
        .credentials(vec![CredentialBinding {
            name: "googleSheetsOAuth2".into(),
            display_name: "Google Sheets OAuth2".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("documentId", "Spreadsheet ID", NodePropertyType::String)
                .placeholder("1A2B3C...")
                .description("The Google Sheets document ID (from the URL).")
                .required(),
            NodeProperty::new("sheetName", "Sheet", NodePropertyType::String)
                .default(json!("Sheet1"))
                .description("The sheet/tab name to watch.")
                .required(),
            NodeProperty::new("event", "Trigger On", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "Row Added".into(),
                        value: json!("rowAdded"),
                        description: Some("Fire for each new row appended to the sheet.".into()),
                    },
                    NodePropertyOption {
                        name: "Row Updated".into(),
                        value: json!("rowUpdated"),
                        description: Some("Fire when an existing row's values change.".into()),
                    },
                    NodePropertyOption {
                        name: "Row Added or Updated".into(),
                        value: json!("rowAddedOrUpdated"),
                        description: Some("Fire on either added or updated rows.".into()),
                    },
                ])
                .default(json!("rowAdded"))
                .required(),
            NodeProperty::new("pollInterval", "Poll Interval", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "Every Minute".into(),
                        value: json!("minute"),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Every 5 Minutes".into(),
                        value: json!("minute5"),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Every 15 Minutes".into(),
                        value: json!("minute15"),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Every Hour".into(),
                        value: json!("hour"),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Every Day".into(),
                        value: json!("day"),
                        description: None,
                    },
                ])
                .default(json!("minute5"))
                .description("How often the upstream scheduler should poll the Sheets API.")
                .required(),
            NodeProperty::new("valueRenderMode", "Value Render", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "Formatted Value".into(),
                        value: json!("FORMATTED_VALUE"),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Unformatted Value".into(),
                        value: json!("UNFORMATTED_VALUE"),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Formula".into(),
                        value: json!("FORMULA"),
                        description: None,
                    },
                ])
                .default(json!("FORMATTED_VALUE")),
            NodeProperty::new("headerRow", "First Row Contains Headers", NodePropertyType::Boolean)
                .default(json!(true))
                .description(
                    "When true, polled rows are emitted as objects keyed by the header row \
                     instead of raw arrays.",
                ),
            NodeProperty::new("includeRowNumber", "Include Row Number", NodePropertyType::Boolean)
                .default(json!(true))
                .description("Attach the 1-based row index to each emitted item."),
            NodeProperty::new("emitOnePerRow", "Emit One Item Per Row", NodePropertyType::Boolean)
                .default(json!(true))
                .description(
                    "When true, each changed row becomes its own item; when false, all changed \
                     rows are batched into a single item.",
                ),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let trigger = ctx.trigger_data.clone().unwrap_or(json!({}));

        // If this came via webhook relay (e.g. Apps Script-to-SabFlow), require
        // the receiver to have verified its Bearer token. Polling-originated
        // payloads (the common case) skip this check because they come from
        // our own scheduler.
        let is_polled = trigger
            .get("source")
            .and_then(|v| v.as_str())
            .map(|s| s == "poll")
            .unwrap_or(false);
        let is_manual = trigger.get("manual").and_then(|v| v.as_bool()) == Some(true);
        if !is_polled && !is_manual {
            let verified = trigger
                .get("pubsubVerified")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);
            if !verified {
                return Err(NodeError::AuthError(
                    "Google Sheets webhook relay payload missing verified Bearer token".into(),
                ));
            }
        }

        let event = ctx
            .param_str_opt(params, "event")
            .unwrap_or_else(|| "rowAdded".to_string());
        let emit_one_per_row = ctx.param_bool(params, "emitOnePerRow", true);
        let include_row_number = ctx.param_bool(params, "includeRowNumber", true);
        let header_row = ctx.param_bool(params, "headerRow", true);

        // The scheduler delivers polled rows under a `rows` array (each entry
        // either a `{ rowNumber, values }` object or a plain values array).
        // Webhook-relay payloads may use the same shape or a single object.
        let rows: Vec<Value> = match trigger.get("rows") {
            Some(Value::Array(rs)) => rs.clone(),
            _ => {
                if trigger.is_object() && trigger.get("values").is_some() {
                    vec![trigger.clone()]
                } else {
                    vec![]
                }
            }
        };

        let mut items: Vec<Value> = Vec::with_capacity(rows.len().max(1));
        for row in &rows {
            let row_number = row.get("rowNumber").cloned().unwrap_or(Value::Null);
            let values = row.get("values").cloned().unwrap_or_else(|| row.clone());
            let payload = if header_row {
                values
            } else {
                json!({ "values": values })
            };
            let item = if include_row_number {
                json!({
                    "event": event,
                    "rowNumber": row_number,
                    "row": payload,
                })
            } else {
                json!({
                    "event": event,
                    "row": payload,
                })
            };
            items.push(item);
        }

        if emit_one_per_row {
            if items.is_empty() {
                return Ok(NodeOutput::single(vec![]));
            }
            Ok(NodeOutput::single(items))
        } else {
            let batched = json!({
                "event": event,
                "rows": items,
                "count": rows.len(),
            });
            Ok(NodeOutput::single(vec![batched]))
        }
    }
}
