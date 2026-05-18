//! HubSpot Trigger node (`n8n-nodes-base.hubspotTrigger`).
//!
//! Fires a flow when HubSpot's webhook subscription POSTs an event. The
//! upstream HTTP receiver (the catch-all `/api/sabflow/webhook/[webhookId]`
//! route on the Next.js side) hands the parsed body and request metadata to
//! the engine through [`ExecutionContext::trigger_data`] in the shape:
//!
//! ```jsonc
//! {
//!   "body":       { ... raw HubSpot JSON ... },   // array of event objects
//!   "headers":    { "x-hubspot-signature-v3": "...",
//!                   "x-hubspot-request-timestamp": "1715900000000",
//!                   "x-hubspot-signature": "...", // v1 fallback
//!                   ... },
//!   "rawBody":    "[{\"eventId\":...}]",          // exact bytes HubSpot sent
//!   "method":     "POST",
//!   "url":        "https://app.sabnode.com/api/sabflow/webhook/<id>",
//!   "receivedAt": "2026-05-18T10:21:44.512Z"
//! }
//! ```
//!
//! This node:
//!   1. Pulls the configured `subscribedEvents` filter from the node params.
//!   2. Optionally verifies HubSpot's request signature against the
//!      configured app secret (credential field `clientSecret`) — supports
//!      both **v3** (`X-HubSpot-Signature-v3` = base64(hmac_sha256(secret,
//!      `${method}${uri}${body}${timestamp}`))) and the legacy **v1**
//!      (`X-HubSpot-Signature` = hex(sha256(`${secret}${body}`))).
//!   3. Normalises each inbound HubSpot event into a flat envelope:
//!
//! ```jsonc
//! {
//!   "service":      "hubspot",
//!   "event":        "contact.creation",
//!   "objectType":   "contact",
//!   "objectId":     "12345",
//!   "propertyName": "email",         // null for non-property-change events
//!   "propertyValue": "x@y.com",      // ditto
//!   "occurredAt":   "2026-05-18T10:21:43.000Z",
//!   "portalId":     1234567,
//!   "subscriptionId": 23,
//!   "raw":          { ... original event object ... }
//! }
//! ```
//!
//! Each event in the inbound array is emitted as a separate output item so
//! downstream nodes can iterate naturally. If signature verification is
//! enabled and fails, the node aborts with `NodeError::AuthError`.

use async_trait::async_trait;
use base64::Engine;
use base64::engine::general_purpose;
use hmac::{Hmac, Mac};
use serde_json::{Map, Value, json};
use sha2::{Digest, Sha256};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{
        CredentialBinding, NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption,
        NodePropertyType,
    },
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct HubspotTriggerNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

/// Event slugs HubSpot can deliver via webhook subscriptions
/// (mirrors `triggers_app/hubspot_trigger.ts`).
const KNOWN_EVENTS: &[&str] = &[
    "company.creation",
    "company.deletion",
    "company.propertyChange",
    "contact.creation",
    "contact.deletion",
    "contact.privacyDeletion",
    "contact.propertyChange",
    "conversation.creation",
    "conversation.deletion",
    "conversation.newMessage",
    "conversation.privacyDeletion",
    "conversation.propertyChange",
    "deal.creation",
    "deal.deletion",
    "deal.propertyChange",
    "ticket.creation",
    "ticket.deletion",
    "ticket.propertyChange",
];

#[async_trait]
impl Node for HubspotTriggerNode {
    fn descriptor(&self) -> NodeDescriptor {
        let event_options: Vec<NodePropertyOption> =
            KNOWN_EVENTS.iter().map(|ev| opt(ev, ev)).collect();

        NodeDescriptor::new(
            "hubspotTrigger",
            "HubSpot Trigger",
            "Fire when HubSpot delivers a subscribed webhook event",
            NodeCategory::Trigger,
        )
        .icon("webhook")
        .color("#FF7A59")
        .trigger()
        .credentials(vec![CredentialBinding {
            name: "hubspotDeveloperApi".into(),
            display_name: "HubSpot App (client secret)".into(),
            required: false,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .description("HubSpot Developer credential containing `clientSecret`. Required when signature verification is enabled."),
            NodeProperty::new(
                "subscribedEvents",
                "Subscribed Events",
                NodePropertyType::MultiOptions,
            )
            .options(event_options)
            .default(json!(["contact.creation"]))
            .description("Only events whose slug is in this list are forwarded downstream. Empty = allow all."),
            NodeProperty::new(
                "verifySignature",
                "Verify Signature",
                NodePropertyType::Boolean,
            )
            .default(json!(true))
            .description("Verify the HubSpot v3 (or v1) request signature against the credential's `clientSecret`."),
            NodeProperty::new(
                "signatureVersion",
                "Signature Version",
                NodePropertyType::Options,
            )
            .options(vec![
                opt("v3 (recommended)", "v3"),
                opt("v1 (legacy)", "v1"),
                opt("Auto-detect", "auto"),
            ])
            .default(json!("auto"))
            .show_when("verifySignature", &["true"]),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let envelope = ctx.trigger_data.clone().unwrap_or_else(|| json!({}));

        // Pull the filter list (string array). Empty / missing = allow all.
        let allowed_events: Vec<String> = params
            .get("subscribedEvents")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect()
            })
            .unwrap_or_default();

        let verify = ctx.param_bool(params, "verifySignature", false);
        if verify {
            let cred_id = ctx.param_str_opt(params, "credentialId").unwrap_or_default();
            let secret = if cred_id.is_empty() {
                String::new()
            } else {
                ctx.credential(&cred_id)?
                    .data
                    .get("clientSecret")
                    .cloned()
                    .ok_or_else(|| NodeError::MissingParameter("clientSecret".into()))?
            };
            if secret.is_empty() {
                return Err(NodeError::AuthError(
                    "HubSpot signature verification requested but credential `clientSecret` is missing".into(),
                ));
            }
            let version = ctx
                .param_str_opt(params, "signatureVersion")
                .unwrap_or_else(|| "auto".to_string());
            verify_hubspot_signature(&envelope, &secret, &version)?;
        }

        // Extract the inbound event array (HubSpot delivers as a top-level
        // array of event objects). Tolerate either `body: [...]` (typical) or
        // a bare array as the whole envelope.
        let events: &[Value] = envelope
            .get("body")
            .and_then(|b| b.as_array())
            .map(|v| v.as_slice())
            .or_else(|| envelope.as_array().map(|v| v.as_slice()))
            .unwrap_or(&[]);

        let mut items: Vec<Value> = Vec::with_capacity(events.len());
        for ev in events {
            let event_slug = ev.get("subscriptionType").and_then(|v| v.as_str()).unwrap_or("");
            if !allowed_events.is_empty()
                && !event_slug.is_empty()
                && !allowed_events.iter().any(|e| e == event_slug)
            {
                continue;
            }
            items.push(normalize_hubspot_event(ev));
        }

        // If HubSpot delivered nothing parseable (e.g. a manual test run with
        // no body), surface the raw envelope so the user can still inspect it.
        if items.is_empty() {
            items.push(json!({
                "service": "hubspot",
                "event": null,
                "raw": envelope,
            }));
        }

        Ok(NodeOutput::single(items))
    }
}

/// Normalise a single HubSpot event object into the SabFlow envelope.
fn normalize_hubspot_event(ev: &Value) -> Value {
    let event_slug = ev
        .get("subscriptionType")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let (object_type, _action) = match event_slug.split_once('.') {
        Some((a, b)) => (a, b),
        None => ("", ""),
    };
    let object_id = ev
        .get("objectId")
        .and_then(|v| {
            if v.is_string() {
                v.as_str().map(|s| s.to_string())
            } else {
                Some(v.to_string())
            }
        })
        .unwrap_or_default();
    let property_name = ev
        .get("propertyName")
        .and_then(|v| v.as_str())
        .map(|s| Value::String(s.to_string()))
        .unwrap_or(Value::Null);
    let property_value = ev.get("propertyValue").cloned().unwrap_or(Value::Null);
    let occurred_at = ev
        .get("occurredAt")
        .and_then(|v| v.as_i64())
        .map(|ms| {
            chrono::DateTime::<chrono::Utc>::from_timestamp_millis(ms)
                .map(|dt| dt.to_rfc3339())
                .unwrap_or_default()
        })
        .map(Value::String)
        .unwrap_or(Value::Null);

    json!({
        "service": "hubspot",
        "event": event_slug,
        "objectType": object_type,
        "objectId": object_id,
        "propertyName": property_name,
        "propertyValue": property_value,
        "occurredAt": occurred_at,
        "portalId": ev.get("portalId").cloned().unwrap_or(Value::Null),
        "subscriptionId": ev.get("subscriptionId").cloned().unwrap_or(Value::Null),
        "raw": ev.clone(),
    })
}

/// Verify a HubSpot signature against the envelope. Returns Ok(()) on success.
fn verify_hubspot_signature(envelope: &Value, secret: &str, version: &str) -> NodeResult<()> {
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

    // Pick which signature to check.
    let want_v3 = matches!(version, "v3" | "auto");
    let want_v1 = matches!(version, "v1" | "auto");

    let header_v3 = header_get(&headers, "x-hubspot-signature-v3");
    let header_v1 = header_get(&headers, "x-hubspot-signature");

    if want_v3 && !header_v3.is_empty() {
        let timestamp = header_get(&headers, "x-hubspot-request-timestamp");
        let method = envelope
            .get("method")
            .and_then(|v| v.as_str())
            .unwrap_or("POST");
        let url = envelope.get("url").and_then(|v| v.as_str()).unwrap_or("");
        // v3 basestring: method + uri + body + timestamp
        let basestring = format!("{method}{url}{raw_body}{timestamp}");
        let mut mac = <Hmac<Sha256> as Mac>::new_from_slice(secret.as_bytes())
            .map_err(|e| NodeError::AuthError(format!("invalid HMAC key: {e}")))?;
        mac.update(basestring.as_bytes());
        let expected = general_purpose::STANDARD.encode(mac.finalize().into_bytes());
        if constant_time_eq(expected.as_bytes(), header_v3.as_bytes()) {
            return Ok(());
        }
        if !want_v1 || header_v1.is_empty() {
            return Err(NodeError::AuthError(
                "HubSpot v3 signature mismatch".into(),
            ));
        }
        // else fall through to v1 attempt
    }

    if want_v1 && !header_v1.is_empty() {
        // v1: sha256(clientSecret + requestBody) — hex-encoded.
        let mut hasher = Sha256::new();
        hasher.update(secret.as_bytes());
        hasher.update(raw_body.as_bytes());
        let expected = hex_encode(&hasher.finalize());
        if constant_time_eq(expected.as_bytes(), header_v1.as_bytes()) {
            return Ok(());
        }
        return Err(NodeError::AuthError(
            "HubSpot v1 signature mismatch".into(),
        ));
    }

    Err(NodeError::AuthError(
        "HubSpot signature header missing".into(),
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
