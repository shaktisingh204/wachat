//! Salesforce Trigger node (`n8n-nodes-base.salesforceTrigger`).
//!
//! n8n's Salesforce trigger is *poll-based* — it periodically SOQL-queries
//! `SELECT ... FROM <Object> WHERE CreatedDate > :lastCheckedAt` (or
//! `LastModifiedDate` for updates). In SabFlow we receive trigger fires via
//! two paths, both of which deliver their payload through
//! [`ExecutionContext::trigger_data`]:
//!
//!   1. **Poll path** — a Vercel-Cron-driven worker runs the SOQL query and
//!      enqueues an execution per new/updated row. Trigger data shape:
//!      `{ "record": { ...sobject... }, "polledAt": "...", "object": "Account" }`.
//!   2. **Callout path** — a Salesforce Flow / Apex trigger callout posts the
//!      record to SabFlow's catch-all webhook receiver. Trigger data shape:
//!      `{ body, headers, rawBody, method, url, receivedAt }` (same as the
//!      HubSpot trigger).
//!
//! This node:
//!   1. Detects which path delivered the event.
//!   2. Optionally verifies a Salesforce-side HMAC-SHA256 signature when the
//!      callout includes one (header `x-salesforce-signature`, base64-encoded
//!      HMAC over the raw body using credential field `signingSecret`).
//!   3. Filters by configured `triggerOn` (e.g. `accountCreated`,
//!      `opportunityUpdated`, `customObjectCreated`).
//!   4. Emits a normalised envelope per record:
//!
//! ```jsonc
//! {
//!   "service":   "salesforce",
//!   "event":     "accountCreated",
//!   "object":    "Account",
//!   "action":    "created",
//!   "recordId":  "0015...",
//!   "record":    { ...sobject... },
//!   "occurredAt": "2026-05-18T10:21:43.000Z",
//!   "source":    "poll" | "callout",
//!   "raw":       { ...original delivery envelope... }
//! }
//! ```

use async_trait::async_trait;
use base64::Engine;
use base64::engine::general_purpose;
use hmac::{Hmac, Mac};
use serde_json::{Map, Value, json};
use sha2::Sha256;

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{
        CredentialBinding, NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption,
        NodePropertyType,
    },
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct SalesforceTriggerNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

/// `triggerOn` values mirroring n8n's SalesforceTrigger node options.
const KNOWN_EVENTS: &[&str] = &[
    "accountCreated",
    "accountUpdated",
    "attachmentCreated",
    "attachmentUpdated",
    "caseCreated",
    "caseUpdated",
    "contactCreated",
    "contactUpdated",
    "customObjectCreated",
    "customObjectUpdated",
    "leadCreated",
    "leadUpdated",
    "opportunityCreated",
    "opportunityUpdated",
    "taskCreated",
    "taskUpdated",
    "userCreated",
    "userUpdated",
];

#[async_trait]
impl Node for SalesforceTriggerNode {
    fn descriptor(&self) -> NodeDescriptor {
        let event_options: Vec<NodePropertyOption> =
            KNOWN_EVENTS.iter().map(|ev| opt(ev, ev)).collect();

        NodeDescriptor::new(
            "salesforceTrigger",
            "Salesforce Trigger",
            "Fire when a Salesforce record is created/updated (poll or callout)",
            NodeCategory::Trigger,
        )
        .icon("cloud")
        .color("#00A1E0")
        .trigger()
        .credentials(vec![CredentialBinding {
            name: "salesforceOAuth2Api".into(),
            display_name: "Salesforce (optional callout signing secret)".into(),
            required: false,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .description("Salesforce credential. Field `signingSecret` is required only when `verifySignature` is on."),
            NodeProperty::new("triggerOn", "Trigger On", NodePropertyType::Options)
                .options(event_options)
                .default(json!("accountCreated"))
                .required()
                .description("Which Salesforce resource + action to fire on. Mirrors the n8n node."),
            NodeProperty::new("customObject", "Custom Object", NodePropertyType::String)
                .placeholder("Invoice__c")
                .show_when("triggerOn", &["customObjectCreated", "customObjectUpdated"])
                .description("API name (typically ends in __c). Required when triggerOn is a custom-object event."),
            NodeProperty::new(
                "verifySignature",
                "Verify Callout Signature",
                NodePropertyType::Boolean,
            )
            .default(json!(false))
            .description("Verify a Salesforce Flow/Apex callout signature (HMAC-SHA256 over raw body, base64-encoded) against the credential's `signingSecret`. Ignored for the poll path."),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let envelope = ctx.trigger_data.clone().unwrap_or_else(|| json!({}));
        let trigger_on = ctx
            .param_str_opt(params, "triggerOn")
            .unwrap_or_default();
        let custom_object = ctx
            .param_str_opt(params, "customObject")
            .unwrap_or_default();

        let source = if envelope.get("rawBody").is_some() || envelope.get("headers").is_some() {
            "callout"
        } else if envelope.get("record").is_some() || envelope.get("polledAt").is_some() {
            "poll"
        } else {
            "unknown"
        };

        // Verify callout signature if requested.
        if source == "callout" && ctx.param_bool(params, "verifySignature", false) {
            let cred_id = ctx.param_str_opt(params, "credentialId").unwrap_or_default();
            let secret = if cred_id.is_empty() {
                String::new()
            } else {
                ctx.credential(&cred_id)?
                    .data
                    .get("signingSecret")
                    .cloned()
                    .unwrap_or_default()
            };
            if secret.is_empty() {
                return Err(NodeError::AuthError(
                    "Salesforce signature verification requested but credential `signingSecret` is missing".into(),
                ));
            }
            verify_salesforce_signature(&envelope, &secret)?;
        }

        // Decide which object/action this event matches.
        let (target_object, target_action) = parse_trigger_on(&trigger_on, &custom_object);

        // Extract the record(s) from either delivery path.
        let records: Vec<Value> = match source {
            "callout" => extract_callout_records(&envelope),
            _ => extract_poll_records(&envelope),
        };

        let mut items: Vec<Value> = Vec::with_capacity(records.len().max(1));
        for record in records.iter() {
            // Determine the record's sobject name (best-effort).
            let object_name = record
                .pointer("/attributes/type")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .or_else(|| {
                    envelope
                        .get("object")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string())
                })
                .unwrap_or_default();

            // If the user pinned a target, drop mismatched objects.
            if !target_object.is_empty()
                && !object_name.is_empty()
                && !object_name.eq_ignore_ascii_case(&target_object)
            {
                continue;
            }

            let record_id = record
                .get("Id")
                .or_else(|| record.get("id"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .unwrap_or_default();

            let occurred_at = record
                .get(if target_action == "created" {
                    "CreatedDate"
                } else {
                    "LastModifiedDate"
                })
                .cloned()
                .unwrap_or(Value::Null);

            let resolved_object = if !object_name.is_empty() {
                object_name.clone()
            } else {
                target_object.clone()
            };
            items.push(json!({
                "service": "salesforce",
                "event": trigger_on.clone(),
                "object": resolved_object,
                "action": target_action,
                "recordId": record_id,
                "record": record.clone(),
                "occurredAt": occurred_at,
                "source": source,
                "raw": envelope.clone(),
            }));
        }

        if items.is_empty() {
            items.push(json!({
                "service": "salesforce",
                "event": trigger_on,
                "object": target_object,
                "action": target_action,
                "source": source,
                "raw": envelope,
            }));
        }

        Ok(NodeOutput::single(items))
    }
}

/// Map a `triggerOn` slug + optional custom-object name to (object, action).
fn parse_trigger_on(trigger_on: &str, custom_object: &str) -> (String, &'static str) {
    if trigger_on.is_empty() {
        return (String::new(), "created");
    }
    let action: &'static str = if trigger_on.ends_with("Created") {
        "created"
    } else if trigger_on.ends_with("Updated") {
        "updated"
    } else {
        "created"
    };
    if trigger_on.starts_with("customObject") {
        return (custom_object.trim().to_string(), action);
    }
    let stem = trigger_on
        .trim_end_matches("Created")
        .trim_end_matches("Updated");
    // Capitalise first char.
    let mut chars = stem.chars();
    let object = match chars.next() {
        Some(c) => c.to_uppercase().collect::<String>() + chars.as_str(),
        None => String::new(),
    };
    (object, action)
}

/// Pull the sobject record(s) out of an HTTP callout envelope. Tolerates:
///   - `{ body: { record: {...} } }`
///   - `{ body: {...sobject...} }`
///   - `{ body: { records: [...] } }`
///   - `{ body: [...] }`
fn extract_callout_records(envelope: &Value) -> Vec<Value> {
    let body = match envelope.get("body") {
        Some(b) => b,
        None => return vec![],
    };
    if let Some(arr) = body.as_array() {
        return arr.clone();
    }
    if let Some(rec) = body.get("record") {
        return vec![rec.clone()];
    }
    if let Some(arr) = body.get("records").and_then(|v| v.as_array()) {
        return arr.clone();
    }
    if body.is_object() {
        return vec![body.clone()];
    }
    vec![]
}

/// Pull the sobject record(s) out of a poll-path envelope.
fn extract_poll_records(envelope: &Value) -> Vec<Value> {
    if let Some(rec) = envelope.get("record") {
        return vec![rec.clone()];
    }
    if let Some(arr) = envelope.get("records").and_then(|v| v.as_array()) {
        return arr.clone();
    }
    vec![]
}

fn verify_salesforce_signature(envelope: &Value, secret: &str) -> NodeResult<()> {
    let headers = envelope
        .get("headers")
        .cloned()
        .unwrap_or_else(|| Value::Object(Map::new()));
    let raw_body = envelope
        .get("rawBody")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .or_else(|| {
            envelope
                .get("body")
                .map(|b| serde_json::to_string(b).unwrap_or_default())
        })
        .unwrap_or_default();

    let header_sig = header_get(&headers, "x-salesforce-signature");
    if header_sig.is_empty() {
        return Err(NodeError::AuthError(
            "Salesforce signature header `x-salesforce-signature` missing".into(),
        ));
    }

    let mut mac = <Hmac<Sha256> as Mac>::new_from_slice(secret.as_bytes())
        .map_err(|e| NodeError::AuthError(format!("invalid HMAC key: {e}")))?;
    mac.update(raw_body.as_bytes());
    let computed = mac.finalize().into_bytes();
    let expected_b64 = general_purpose::STANDARD.encode(&computed);
    if constant_time_eq(expected_b64.as_bytes(), header_sig.as_bytes()) {
        return Ok(());
    }
    // Accept hex-encoded signatures too for flexibility.
    let expected_hex = hex_encode(&computed);
    if constant_time_eq(expected_hex.as_bytes(), header_sig.as_bytes()) {
        return Ok(());
    }
    Err(NodeError::AuthError(
        "Salesforce signature mismatch".into(),
    ))
}

fn header_get(headers: &Value, name: &str) -> String {
    let lower = name.to_ascii_lowercase();
    if let Some(map) = headers.as_object() {
        for (k, v) in map {
            if k.eq_ignore_ascii_case(&lower) {
                return v.as_str().map(|s| s.to_string()).unwrap_or_default();
            }
        }
    }
    String::new()
}

fn hex_encode(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        out.push_str(&format!("{b:02x}"));
    }
    out
}

fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut diff: u8 = 0;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}
