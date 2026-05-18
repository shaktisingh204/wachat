//! Pipedrive Trigger node (`n8n-nodes-base.pipedriveTrigger`).
//!
//! Fires a flow when Pipedrive POSTs a webhook event. Pipedrive supports
//! optional HTTP Basic Auth on the receiver — there is no HMAC signature.
//! The upstream HTTP receiver hands the parsed body + request metadata to
//! the engine via [`ExecutionContext::trigger_data`]:
//!
//! ```jsonc
//! {
//!   "body":       { ... raw Pipedrive payload ... },
//!   "headers":    { "authorization": "Basic ...", ... },
//!   "rawBody":    "{...}",
//!   "method":     "POST",
//!   "url":        "https://app.sabnode.com/api/sabflow/webhook/<id>",
//!   "receivedAt": "2026-05-18T10:21:44.512Z"
//! }
//! ```
//!
//! Pipedrive's payload format depends on the webhook version. Both shapes
//! are handled here:
//!   - **v1** (legacy):   `{ event, meta:{ action, object, id, ... }, current, previous }`
//!   - **v2** (current):  `{ meta:{ action, entity, entity_id, ... }, data, previous }`
//!
//! Where `event` is e.g. `added.deal`, `updated.person`, `deleted.activity`
//! and v2 actions are `create` / `change` / `delete` mapped here to
//! `added` / `updated` / `deleted` for parity with the SabFlow event vocab.
//!
//! This node:
//!   1. Verifies HTTP Basic Auth when configured (credential fields
//!      `httpAuthUser` + `httpAuthPassword`).
//!   2. Filters by configured `eventTypes` (e.g. `["deal.added", "person.updated"]`,
//!      `"*.*"` = allow all).
//!   3. Emits a normalised envelope:
//!
//! ```jsonc
//! {
//!   "service": "pipedrive",
//!   "event":   "deal.added",
//!   "object":  "deal",
//!   "action":  "added",
//!   "objectId": 4271,
//!   "current":  { ... },
//!   "previous": { ... } | null,
//!   "userId":   12,
//!   "companyId": 7,
//!   "occurredAt": "2026-05-18T10:21:43.000Z",
//!   "raw":      { ... original body ... }
//! }
//! ```

use async_trait::async_trait;
use base64::Engine;
use base64::engine::general_purpose;
use serde_json::{Map, Value, json};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{
        CredentialBinding, NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption,
        NodePropertyType,
    },
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct PipedriveTriggerNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

const KNOWN_EVENTS: &[&str] = &[
    "activity.added",
    "activity.updated",
    "activity.deleted",
    "deal.added",
    "deal.updated",
    "deal.deleted",
    "deal.merged",
    "note.added",
    "note.updated",
    "note.deleted",
    "organization.added",
    "organization.updated",
    "organization.deleted",
    "person.added",
    "person.updated",
    "person.deleted",
    "pipeline.added",
    "pipeline.updated",
    "pipeline.deleted",
    "product.added",
    "product.updated",
    "product.deleted",
    "stage.added",
    "stage.updated",
    "stage.deleted",
    "user.added",
    "user.updated",
    "*.*",
];

#[async_trait]
impl Node for PipedriveTriggerNode {
    fn descriptor(&self) -> NodeDescriptor {
        let event_options: Vec<NodePropertyOption> =
            KNOWN_EVENTS.iter().map(|ev| opt(ev, ev)).collect();

        NodeDescriptor::new(
            "pipedriveTrigger",
            "Pipedrive Trigger",
            "Fire when Pipedrive POSTs a webhook event",
            NodeCategory::Trigger,
        )
        .icon("webhook")
        .color("#1A1F36")
        .trigger()
        .credentials(vec![CredentialBinding {
            name: "pipedriveTriggerApi".into(),
            display_name: "Pipedrive Webhook (optional HTTP Basic)".into(),
            required: false,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .description("Optional HTTP-Basic credential — fields `httpAuthUser` + `httpAuthPassword`. Required only when `verifyBasicAuth` is on."),
            NodeProperty::new("eventTypes", "Event Types", NodePropertyType::MultiOptions)
                .options(event_options)
                .default(json!(["*.*"]))
                .description("Only events whose slug is in this list are forwarded downstream. Include `*.*` (or leave empty) to allow all."),
            NodeProperty::new(
                "verifyBasicAuth",
                "Verify HTTP Basic Auth",
                NodePropertyType::Boolean,
            )
            .default(json!(false))
            .description("Reject deliveries whose Authorization header doesn't match the configured Pipedrive HTTP-Basic credentials."),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let envelope = ctx.trigger_data.clone().unwrap_or_else(|| json!({}));

        // Verify HTTP Basic Auth if requested.
        if ctx.param_bool(params, "verifyBasicAuth", false) {
            let cred_id = ctx.param_str_opt(params, "credentialId").unwrap_or_default();
            if cred_id.is_empty() {
                return Err(NodeError::AuthError(
                    "Pipedrive verifyBasicAuth requested but no credential is bound".into(),
                ));
            }
            let cred = ctx.credential(&cred_id)?;
            let user = cred
                .data
                .get("httpAuthUser")
                .cloned()
                .unwrap_or_default();
            let pass = cred
                .data
                .get("httpAuthPassword")
                .cloned()
                .unwrap_or_default();
            if user.is_empty() {
                return Err(NodeError::AuthError(
                    "Pipedrive credential is missing `httpAuthUser`".into(),
                ));
            }
            verify_basic_auth(&envelope, &user, &pass)?;
        }

        // Pipedrive delivers a single event per request — extract it.
        let body = envelope
            .get("body")
            .cloned()
            .unwrap_or_else(|| envelope.clone());

        // Filter by event types.
        let allowed_events: Vec<String> = params
            .get("eventTypes")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect()
            })
            .unwrap_or_default();
        let allow_all = allowed_events.is_empty() || allowed_events.iter().any(|e| e == "*.*");

        let normalized = normalize_pipedrive_event(&body);
        let event_slug = normalized
            .get("event")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        if !allow_all && !event_slug.is_empty() && !allowed_events.iter().any(|e| e == event_slug) {
            // Drop silently — surface an empty branch so downstream nodes don't fire.
            return Ok(NodeOutput::single(vec![]));
        }

        Ok(NodeOutput::single(vec![normalized]))
    }
}

/// Map either v1 or v2 Pipedrive payload to a single SabFlow envelope.
fn normalize_pipedrive_event(body: &Value) -> Value {
    // v1 → `body.event = "added.deal"`, `body.meta = { action, object, id }`,
    //      `body.current`, `body.previous`.
    // v2 → `body.meta = { action: "create"|"change"|"delete", entity: "deal", entity_id: 1, ... }`,
    //      `body.data`, `body.previous`.
    let meta = body
        .get("meta")
        .cloned()
        .unwrap_or_else(|| Value::Object(Map::new()));

    // Detect version.
    let v1_event = body.get("event").and_then(|v| v.as_str()).map(|s| s.to_string());
    let (action, object, object_id) = if let Some(ev) = &v1_event {
        // v1: "added.deal" -> action=added, object=deal
        let (a, o) = ev.split_once('.').unwrap_or((ev.as_str(), ""));
        let id = meta
            .get("id")
            .cloned()
            .or_else(|| body.get("current").and_then(|c| c.get("id")).cloned())
            .unwrap_or(Value::Null);
        (a.to_string(), o.to_string(), id)
    } else {
        // v2
        let raw_action = meta.get("action").and_then(|v| v.as_str()).unwrap_or("");
        let action = match raw_action {
            "create" => "added",
            "change" => "updated",
            "delete" => "deleted",
            other => other,
        }
        .to_string();
        let object = meta
            .get("entity")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let id = meta
            .get("entity_id")
            .cloned()
            .or_else(|| body.get("data").and_then(|d| d.get("id")).cloned())
            .unwrap_or(Value::Null);
        (action, object, id)
    };

    let event_slug = if !object.is_empty() && !action.is_empty() {
        format!("{object}.{action}")
    } else {
        String::new()
    };

    let current = body
        .get("current")
        .cloned()
        .or_else(|| body.get("data").cloned())
        .unwrap_or(Value::Null);
    let previous = body.get("previous").cloned().unwrap_or(Value::Null);

    let user_id = meta
        .get("user_id")
        .or_else(|| meta.get("userId"))
        .cloned()
        .unwrap_or(Value::Null);
    let company_id = meta
        .get("company_id")
        .or_else(|| meta.get("companyId"))
        .cloned()
        .unwrap_or(Value::Null);
    let occurred_at = meta
        .get("timestamp")
        .or_else(|| meta.get("timestamp_micro"))
        .or_else(|| meta.get("change_source"))
        .cloned()
        .unwrap_or(Value::Null);

    json!({
        "service": "pipedrive",
        "event": event_slug,
        "object": object,
        "action": action,
        "objectId": object_id,
        "current": current,
        "previous": previous,
        "userId": user_id,
        "companyId": company_id,
        "occurredAt": occurred_at,
        "raw": body.clone(),
    })
}

fn verify_basic_auth(envelope: &Value, user: &str, pass: &str) -> NodeResult<()> {
    let headers = envelope
        .get("headers")
        .cloned()
        .unwrap_or_else(|| Value::Object(Map::new()));
    let header_val = header_get(&headers, "authorization");
    if header_val.is_empty() {
        return Err(NodeError::AuthError(
            "Pipedrive request is missing `Authorization` header".into(),
        ));
    }
    let token = header_val
        .strip_prefix("Basic ")
        .or_else(|| header_val.strip_prefix("basic "))
        .ok_or_else(|| {
            NodeError::AuthError(
                "Pipedrive Authorization header is not Basic auth".into(),
            )
        })?;

    let expected_raw = format!("{user}:{pass}");
    let expected_b64 = general_purpose::STANDARD.encode(expected_raw.as_bytes());
    if constant_time_eq(token.as_bytes(), expected_b64.as_bytes()) {
        return Ok(());
    }
    Err(NodeError::AuthError(
        "Pipedrive Basic-auth credentials don't match".into(),
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
