//! Webhook trigger node — `n8n-nodes-base.webhook` parity.
//!
//! Promoted from stub to a real, configurable implementation. The actual HTTP
//! receiver lives outside this crate (it's a Next.js Route Handler that hands
//! the request to the engine via [`ExecutionContext::trigger_data`]). At
//! execute time we:
//!
//! 1. Validate the inbound request against the configured authentication
//!    (none / basic / header / query auth).
//! 2. Optionally verify the request's HTTP method matches the node's
//!    configured method (`GET`/`POST`/.../`ANY`).
//! 3. Shape the trigger payload into a single downstream item with the
//!    standard fields `{ body, headers, query, params, method, path }` so
//!    downstream nodes have a stable contract regardless of the source.
//!
//! Configuration (matches n8n V2 webhook node):
//!
//! - `httpMethod`        — `GET` | `POST` | `PUT` | `PATCH` | `DELETE` | `ANY`
//! - `path`              — Sub-path appended to the webhook prefix. Empty
//!                          means "auto-generated at activation".
//! - `authentication`    — `none` | `basicAuth` | `headerAuth` | `queryAuth`
//! - `username`/`password`      — for `basicAuth`
//! - `headerName`/`headerValue` — for `headerAuth`
//! - `queryAuthName`/`queryAuthValue` — for `queryAuth`
//! - `responseMode`      — `onReceived` (default) | `lastNode` | `responseNode`
//! - `responseCode`      — HTTP status to return when `onReceived`
//! - `responseData`      — payload selector for `onReceived` (`firstEntryJson`
//!                          | `firstEntryBinary` | `noData`)
//!
//! The trigger payload (`ctx.trigger_data`) is expected to be an object with
//! the same field names that the public webhook receiver puts on the wire:
//! `{ body, headers, query, params, method, path }`. Older receivers that
//! only send the body as a bare value are still supported — we wrap them in
//! `{ body: <value> }` so downstream nodes see a consistent shape.

use async_trait::async_trait;
use serde_json::{Map, Value, json};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption, NodePropertyType},
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct WebhookNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for WebhookNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "webhook",
            "Webhook",
            "HTTP webhook trigger",
            NodeCategory::Trigger,
        )
        .icon("webhook")
        .color("#8b5cf6")
        .trigger()
        .properties(vec![
            NodeProperty::new("httpMethod", "HTTP Method", NodePropertyType::Options)
                .options(vec![
                    opt("GET", "GET"),
                    opt("POST", "POST"),
                    opt("PUT", "PUT"),
                    opt("PATCH", "PATCH"),
                    opt("DELETE", "DELETE"),
                    opt("HEAD", "HEAD"),
                    opt("OPTIONS", "OPTIONS"),
                    opt("ANY", "ANY"),
                ])
                .default(json!("POST"))
                .required(),
            NodeProperty::new("path", "Path", NodePropertyType::String)
                .default(json!(""))
                .description(
                    "Sub-path appended to the webhook prefix. Empty means auto-generated at \
                    activation; the public receiver derives the webhookId from the flow id.",
                ),
            NodeProperty::new("authentication", "Authentication", NodePropertyType::Options)
                .options(vec![
                    opt("None", "none"),
                    opt("Basic Auth", "basicAuth"),
                    opt("Header Auth", "headerAuth"),
                    opt("Query Auth", "queryAuth"),
                ])
                .default(json!("none")),
            NodeProperty::new("username", "Username", NodePropertyType::String)
                .show_when("authentication", &["basicAuth"]),
            NodeProperty::new("password", "Password", NodePropertyType::String)
                .show_when("authentication", &["basicAuth"]),
            NodeProperty::new("headerName", "Header Name", NodePropertyType::String)
                .show_when("authentication", &["headerAuth"]),
            NodeProperty::new("headerValue", "Header Value", NodePropertyType::String)
                .show_when("authentication", &["headerAuth"]),
            NodeProperty::new("queryAuthName", "Query Param Name", NodePropertyType::String)
                .show_when("authentication", &["queryAuth"]),
            NodeProperty::new("queryAuthValue", "Query Param Value", NodePropertyType::String)
                .show_when("authentication", &["queryAuth"]),
            NodeProperty::new("responseMode", "Response Mode", NodePropertyType::Options)
                .options(vec![
                    opt("Immediately on Received", "onReceived"),
                    opt("When Last Node Finishes", "lastNode"),
                    opt("Using Respond to Webhook Node", "responseNode"),
                ])
                .default(json!("onReceived")),
            NodeProperty::new("responseCode", "Response Code", NodePropertyType::Number)
                .default(json!(200))
                .show_when("responseMode", &["onReceived"]),
            NodeProperty::new("responseData", "Response Data", NodePropertyType::Options)
                .options(vec![
                    opt("First Entry JSON", "firstEntryJson"),
                    opt("First Entry Binary", "firstEntryBinary"),
                    opt("No Response Body", "noData"),
                ])
                .default(json!("firstEntryJson"))
                .show_when("responseMode", &["onReceived"]),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        // Normalise the inbound trigger payload — older callers may pass a
        // bare body, newer ones pass the full envelope.
        let payload = match ctx.trigger_data.clone() {
            Some(v @ Value::Object(_)) => v,
            Some(other) => json!({ "body": other }),
            None => json!({}),
        };

        // 1. Method check (when not ANY).
        let expected_method = ctx
            .param_str_opt(params, "httpMethod")
            .unwrap_or_else(|| "POST".to_string())
            .to_uppercase();
        if expected_method != "ANY" {
            if let Some(actual) = payload.get("method").and_then(|v| v.as_str()) {
                if !actual.eq_ignore_ascii_case(&expected_method) {
                    return Err(NodeError::InvalidParameter {
                        name: "httpMethod".into(),
                        reason: format!(
                            "method mismatch: webhook configured for {expected_method}, received {actual}"
                        ),
                    });
                }
            }
        }

        // 2. Authentication check (only enforced when we have something to check against).
        let auth = ctx
            .param_str_opt(params, "authentication")
            .unwrap_or_else(|| "none".to_string());
        verify_authentication(ctx, params, &auth, &payload)?;

        // 3. Shape downstream item — always a single, well-known envelope.
        let body = payload
            .get("body")
            .cloned()
            .unwrap_or(Value::Object(Map::new()));
        let headers = payload
            .get("headers")
            .cloned()
            .unwrap_or(Value::Object(Map::new()));
        let query = payload
            .get("query")
            .cloned()
            .unwrap_or(Value::Object(Map::new()));
        let params_map = payload
            .get("params")
            .cloned()
            .unwrap_or(Value::Object(Map::new()));
        let method = payload
            .get("method")
            .cloned()
            .unwrap_or(Value::String(expected_method.clone()));
        let path = payload
            .get("path")
            .cloned()
            .or_else(|| params.get("path").cloned())
            .unwrap_or(Value::String(String::new()));

        Ok(NodeOutput::single(vec![json!({
            "body": body,
            "headers": headers,
            "query": query,
            "params": params_map,
            "method": method,
            "path": path,
        })]))
    }
}

/// Verify the inbound request against the configured webhook authentication.
/// `none` is always OK. For the other modes we look at the relevant slice of
/// the payload (headers / query / Authorization header) — if the required
/// field is missing or doesn't match the configured value we return
/// [`NodeError::AuthError`].
fn verify_authentication(
    ctx: &ExecutionContext,
    params: &Value,
    mode: &str,
    payload: &Value,
) -> NodeResult<()> {
    match mode {
        "none" => Ok(()),
        "headerAuth" => {
            let header_name = ctx
                .param_str_opt(params, "headerName")
                .unwrap_or_default();
            let header_value = ctx
                .param_str_opt(params, "headerValue")
                .unwrap_or_default();
            if header_name.is_empty() {
                return Err(NodeError::MissingParameter("headerName".into()));
            }
            let supplied = lookup_header(payload, &header_name).unwrap_or_default();
            if supplied != header_value {
                return Err(NodeError::AuthError(format!(
                    "header '{header_name}' did not match the configured value"
                )));
            }
            Ok(())
        }
        "basicAuth" => {
            let user = ctx.param_str_opt(params, "username").unwrap_or_default();
            let pass = ctx.param_str_opt(params, "password").unwrap_or_default();
            if user.is_empty() {
                return Err(NodeError::MissingParameter("username".into()));
            }
            let auth_header = lookup_header(payload, "authorization").unwrap_or_default();
            let (supplied_user, supplied_pass) =
                parse_basic_auth(&auth_header).unwrap_or_default();
            if supplied_user != user || supplied_pass != pass {
                return Err(NodeError::AuthError(
                    "basic auth credentials did not match".into(),
                ));
            }
            Ok(())
        }
        "queryAuth" => {
            let name = ctx
                .param_str_opt(params, "queryAuthName")
                .unwrap_or_default();
            let value = ctx
                .param_str_opt(params, "queryAuthValue")
                .unwrap_or_default();
            if name.is_empty() {
                return Err(NodeError::MissingParameter("queryAuthName".into()));
            }
            let supplied = payload
                .get("query")
                .and_then(|q| q.get(&name))
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string();
            if supplied != value {
                return Err(NodeError::AuthError(format!(
                    "query param '{name}' did not match the configured value"
                )));
            }
            Ok(())
        }
        other => Err(NodeError::InvalidParameter {
            name: "authentication".into(),
            reason: format!("unknown authentication mode: {other}"),
        }),
    }
}

/// HTTP headers are case-insensitive — look up `name` in the payload's
/// `headers` object using ASCII-case-insensitive comparison.
fn lookup_header(payload: &Value, name: &str) -> Option<String> {
    let headers = payload.get("headers")?.as_object()?;
    for (k, v) in headers.iter() {
        if k.eq_ignore_ascii_case(name) {
            return match v {
                Value::String(s) => Some(s.clone()),
                Value::Null => Some(String::new()),
                other => Some(other.to_string()),
            };
        }
    }
    None
}

/// Decode the user / pass out of a `Basic <base64(user:pass)>` header.
/// Returns `(user, pass)` or `None` if it doesn't look like a Basic header.
fn parse_basic_auth(header: &str) -> Option<(String, String)> {
    let rest = header.trim().strip_prefix("Basic ").or_else(|| header.trim().strip_prefix("basic "))?;
    let bytes =
        base64::Engine::decode(&base64::engine::general_purpose::STANDARD, rest.trim()).ok()?;
    let decoded = String::from_utf8(bytes).ok()?;
    let (u, p) = decoded.split_once(':')?;
    Some((u.to_string(), p.to_string()))
}
