//! PostHog node.
//!
//! Implements product-analytics operations against the PostHog APIs:
//!
//! * Capture API (`/capture/`): public — uses the project `apiKey` (`phc_…`
//!   or `phx_…`) inside the JSON body. No auth header.
//! * Feature flag check (`/decide?v=3`): same project `apiKey` in body.
//! * Management API (`/api/projects/{id}/annotations/`): requires a
//!   `personalApiKey` (`phx_…`) sent as Bearer auth.
//!
//! Host defaults to `https://us.i.posthog.com` and can be overridden via
//! the credential's `host` field (e.g. `https://eu.i.posthog.com` or a
//! self-hosted instance).

use async_trait::async_trait;
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

pub struct PostHogNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for PostHogNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "postHog",
            "PostHog",
            "Capture events, identify users, evaluate feature flags, and manage annotations on PostHog",
            NodeCategory::Analytics,
        )
        .icon("line-chart")
        .color("#1D4AFF")
        .credentials(vec![CredentialBinding {
            name: "postHogApi".into(),
            display_name: "PostHog API".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Capture Event", "capture"),
                    opt("Identify", "identify"),
                    opt("Alias", "alias"),
                    opt("Group Identify", "groupIdentify"),
                    opt("Feature Flag Check", "featureFlag"),
                    opt("Create Annotation", "createAnnotation"),
                ])
                .default(json!("capture"))
                .required(),

            // shared distinct id (capture, identify, alias, featureFlag)
            NodeProperty::new("distinctId", "Distinct ID", NodePropertyType::String)
                .placeholder("user_123")
                .show_when(
                    "operation",
                    &["capture", "identify", "alias", "featureFlag"],
                )
                .required(),

            // capture
            NodeProperty::new("event", "Event Name", NodePropertyType::String)
                .placeholder("signup")
                .show_when("operation", &["capture"])
                .required(),
            NodeProperty::new("properties", "Properties", NodePropertyType::Json)
                .show_when("operation", &["capture"])
                .description("JSON object of event properties"),
            NodeProperty::new("timestamp", "Timestamp", NodePropertyType::String)
                .placeholder("2025-01-01T00:00:00Z")
                .show_when("operation", &["capture"])
                .description("Optional ISO-8601 timestamp; PostHog uses server time if omitted"),

            // identify
            NodeProperty::new("set", "$set", NodePropertyType::Json)
                .show_when("operation", &["identify"])
                .description("JSON object of person properties to set (always overwrites)")
                .required(),
            NodeProperty::new("setOnce", "$set_once", NodePropertyType::Json)
                .show_when("operation", &["identify"])
                .description("JSON object of person properties to set only if not already set"),

            // alias
            NodeProperty::new("alias", "Alias", NodePropertyType::String)
                .placeholder("user_456")
                .show_when("operation", &["alias"])
                .required(),

            // groupIdentify
            NodeProperty::new("groupType", "Group Type", NodePropertyType::String)
                .placeholder("company")
                .show_when("operation", &["groupIdentify"])
                .required(),
            NodeProperty::new("groupKey", "Group Key", NodePropertyType::String)
                .placeholder("acme-inc")
                .show_when("operation", &["groupIdentify"])
                .required(),
            NodeProperty::new("groupProperties", "Group Properties", NodePropertyType::Json)
                .show_when("operation", &["groupIdentify"])
                .description("JSON object of group properties (becomes $group_set)")
                .required(),

            // featureFlag
            NodeProperty::new("featureKey", "Feature Flag Key", NodePropertyType::String)
                .placeholder("new-dashboard")
                .show_when("operation", &["featureFlag"])
                .required(),

            // createAnnotation
            NodeProperty::new("projectId", "Project ID", NodePropertyType::String)
                .placeholder("12345")
                .show_when("operation", &["createAnnotation"])
                .required(),
            NodeProperty::new("content", "Content", NodePropertyType::String)
                .placeholder("Deployed v2.0.0")
                .show_when("operation", &["createAnnotation"])
                .required(),
            NodeProperty::new("dateMarker", "Date Marker", NodePropertyType::String)
                .placeholder("2025-01-01T00:00:00Z")
                .show_when("operation", &["createAnnotation"])
                .required(),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let cred_id = ctx.param_str(params, "credentialId")?;
        let cred = ctx.credential(&cred_id)?;
        let api_key = cred
            .data
            .get("apiKey")
            .ok_or_else(|| NodeError::MissingParameter("apiKey".into()))?
            .clone();
        let host = cred
            .data
            .get("host")
            .map(|s| s.trim().trim_end_matches('/').to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "https://us.i.posthog.com".to_string());
        let personal_api_key = cred.data.get("personalApiKey").cloned();

        let operation = ctx.param_str(params, "operation")?;

        let body: Value = match operation.as_str() {
            "capture" => {
                let distinct_id = ctx.param_str(params, "distinctId")?;
                let event = ctx.param_str(params, "event")?;
                let properties = parse_json_param(ctx, params, "properties")
                    .unwrap_or_else(|| Value::Object(Map::new()));
                let mut payload = Map::new();
                payload.insert("api_key".into(), Value::String(api_key.clone()));
                payload.insert("event".into(), Value::String(event));
                payload.insert("distinct_id".into(), Value::String(distinct_id));
                payload.insert("properties".into(), properties);
                if let Some(ts) = ctx.param_str_opt(params, "timestamp") {
                    if !ts.trim().is_empty() {
                        payload.insert("timestamp".into(), Value::String(ts));
                    }
                }
                let url = format!("{host}/capture/");
                post_json(ctx, &url, None, Value::Object(payload)).await?
            }
            "identify" => {
                let distinct_id = ctx.param_str(params, "distinctId")?;
                let set = parse_json_param(ctx, params, "set")
                    .ok_or_else(|| NodeError::MissingParameter("set".into()))?;
                let set_once = parse_json_param(ctx, params, "setOnce");
                let mut properties = Map::new();
                properties.insert("$set".into(), set);
                if let Some(so) = set_once {
                    properties.insert("$set_once".into(), so);
                }
                let payload = json!({
                    "api_key": api_key,
                    "event": "$identify",
                    "distinct_id": distinct_id,
                    "properties": Value::Object(properties),
                });
                let url = format!("{host}/capture/");
                post_json(ctx, &url, None, payload).await?
            }
            "alias" => {
                let distinct_id = ctx.param_str(params, "distinctId")?;
                let alias = ctx.param_str(params, "alias")?;
                let payload = json!({
                    "api_key": api_key,
                    "event": "$create_alias",
                    "distinct_id": distinct_id,
                    "properties": {
                        "distinct_id": distinct_id,
                        "alias": alias,
                    },
                });
                let url = format!("{host}/capture/");
                post_json(ctx, &url, None, payload).await?
            }
            "groupIdentify" => {
                let group_type = ctx.param_str(params, "groupType")?;
                let group_key = ctx.param_str(params, "groupKey")?;
                let group_set = parse_json_param(ctx, params, "groupProperties")
                    .ok_or_else(|| NodeError::MissingParameter("groupProperties".into()))?;
                let payload = json!({
                    "api_key": api_key,
                    "event": "$groupidentify",
                    "distinct_id": group_key,
                    "properties": {
                        "$group_type": group_type,
                        "$group_key": group_key,
                        "$group_set": group_set,
                    },
                });
                let url = format!("{host}/capture/");
                post_json(ctx, &url, None, payload).await?
            }
            "featureFlag" => {
                let distinct_id = ctx.param_str(params, "distinctId")?;
                let feature_key = ctx.param_str(params, "featureKey")?;
                let payload = json!({
                    "api_key": api_key,
                    "distinct_id": distinct_id,
                });
                let url = format!("{host}/decide?v=3");
                let response = post_json(ctx, &url, None, payload).await?;

                // Extract the flag value. PostHog /decide returns:
                //   { "featureFlags": { "key": true|false|"variant" }, ... }
                let flag_value = response
                    .get("featureFlags")
                    .and_then(|f| f.get(&feature_key))
                    .cloned()
                    .unwrap_or(Value::Bool(false));
                let payloads = response
                    .get("featureFlagPayloads")
                    .and_then(|f| f.get(&feature_key))
                    .cloned()
                    .unwrap_or(Value::Null);
                json!({
                    "featureKey": feature_key,
                    "value": flag_value,
                    "payload": payloads,
                    "raw": response,
                })
            }
            "createAnnotation" => {
                let personal = personal_api_key.as_ref().filter(|s| !s.is_empty()).ok_or_else(
                    || {
                        NodeError::MissingParameter(
                            "personalApiKey (required for createAnnotation)".into(),
                        )
                    },
                )?;
                let project_id = ctx.param_str(params, "projectId")?;
                let content = ctx.param_str(params, "content")?;
                let date_marker = ctx.param_str(params, "dateMarker")?;
                let payload = json!({
                    "content": content,
                    "date_marker": date_marker,
                    "scope": "project",
                });
                let url = format!("{host}/api/projects/{project_id}/annotations/");
                post_json(ctx, &url, Some(personal.as_str()), payload).await?
            }
            other => {
                return Err(NodeError::InvalidParameter {
                    name: "operation".into(),
                    reason: format!("unknown operation: {other}"),
                });
            }
        };

        Ok(NodeOutput::single(vec![body]))
    }
}

async fn post_json(
    ctx: &ExecutionContext,
    url: &str,
    bearer: Option<&str>,
    payload: Value,
) -> NodeResult<Value> {
    let mut req = ctx
        .http
        .post(url)
        .header("Content-Type", "application/json")
        .json(&payload);
    if let Some(token) = bearer {
        req = req.bearer_auth(token);
    }
    let res = req.send().await?;
    let status = res.status();
    let text = res.text().await.unwrap_or_default();
    let body: Value = if text.is_empty() {
        Value::Null
    } else {
        serde_json::from_str(&text).unwrap_or(Value::String(text.clone()))
    };
    if !status.is_success() {
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: body.to_string(),
        });
    }
    Ok(body)
}

fn parse_json_param(ctx: &ExecutionContext, params: &Value, key: &str) -> Option<Value> {
    let raw = params.get(key)?;
    match raw {
        Value::Null => None,
        Value::String(s) => {
            let s = ctx.substitute(s);
            let trimmed = s.trim();
            if trimmed.is_empty() {
                None
            } else {
                serde_json::from_str::<Value>(trimmed).ok()
            }
        }
        other => Some(substitute_value(ctx, other.clone())),
    }
}

fn substitute_value(ctx: &ExecutionContext, v: Value) -> Value {
    match v {
        Value::String(s) => Value::String(ctx.substitute(&s)),
        Value::Array(arr) => Value::Array(arr.into_iter().map(|x| substitute_value(ctx, x)).collect()),
        Value::Object(map) => {
            let mut out = Map::new();
            for (k, val) in map {
                out.insert(k, substitute_value(ctx, val));
            }
            Value::Object(out)
        }
        other => other,
    }
}
