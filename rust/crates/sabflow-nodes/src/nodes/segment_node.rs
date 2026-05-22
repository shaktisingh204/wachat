//! Segment node.
//!
//! Sends events to Segment's HTTP Tracking API (`https://api.segment.io/v1`).
//! Auth: HTTP Basic with the project write key as the username and an empty
//! password.
//!
//! Implements identify, track, page, screen, group, alias, and batch.

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

pub struct SegmentNode;

const SEGMENT_BASE: &str = "https://api.segment.io/v1";

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for SegmentNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "segment",
            "Segment",
            "Identify users and send analytics events to Segment's HTTP Tracking API",
            NodeCategory::Analytics,
        )
        .icon("line-chart")
        .color("#52BD94")
        .credentials(vec![CredentialBinding {
            name: "segmentApi".into(),
            display_name: "Segment API".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Identify", "identify"),
                    opt("Track", "track"),
                    opt("Page", "page"),
                    opt("Screen", "screen"),
                    opt("Group", "group"),
                    opt("Alias", "alias"),
                    opt("Batch", "batch"),
                ])
                .default(json!("track"))
                .required(),

            // shared userId (identify, track, page, screen, group)
            NodeProperty::new("userId", "User ID", NodePropertyType::String)
                .placeholder("user_123")
                .show_when(
                    "operation",
                    &["identify", "track", "page", "screen", "group"],
                )
                .required(),

            // identify
            NodeProperty::new("traits", "Traits", NodePropertyType::Json)
                .show_when("operation", &["identify", "group"])
                .description("JSON object of user/group traits"),
            NodeProperty::new("anonymousId", "Anonymous ID", NodePropertyType::String)
                .show_when("operation", &["identify"])
                .description("Optional anonymous identifier"),

            // track
            NodeProperty::new("event", "Event Name", NodePropertyType::String)
                .placeholder("Order Completed")
                .show_when("operation", &["track"])
                .required(),
            NodeProperty::new("properties", "Properties", NodePropertyType::Json)
                .show_when("operation", &["track", "page", "screen"])
                .description("JSON object of event properties"),

            // page / screen
            NodeProperty::new("name", "Name", NodePropertyType::String)
                .placeholder("Home")
                .show_when("operation", &["page", "screen"])
                .required(),

            // group
            NodeProperty::new("groupId", "Group ID", NodePropertyType::String)
                .placeholder("org_123")
                .show_when("operation", &["group"])
                .required(),

            // alias
            NodeProperty::new("previousId", "Previous ID", NodePropertyType::String)
                .placeholder("anon_abc")
                .show_when("operation", &["alias"])
                .required(),
            NodeProperty::new("aliasUserId", "User ID", NodePropertyType::String)
                .placeholder("user_123")
                .show_when("operation", &["alias"])
                .required(),

            // batch
            NodeProperty::new("batch", "Batch", NodePropertyType::Json)
                .show_when("operation", &["batch"])
                .description(
                    "JSON array of Segment events, e.g. [{\"type\":\"track\",\"userId\":\"u1\",\"event\":\"e\"}]",
                )
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
        let write_key = cred
            .data
            .get("writeKey")
            .ok_or_else(|| NodeError::MissingParameter("writeKey".into()))?
            .clone();

        let operation = ctx.param_str(params, "operation")?;

        let (path, payload): (&str, Value) = match operation.as_str() {
            "identify" => {
                let user_id = ctx.param_str(params, "userId")?;
                let traits = parse_json_param(ctx, params, "traits")
                    .unwrap_or_else(|| Value::Object(Map::new()));
                let mut payload = Map::new();
                payload.insert("userId".into(), Value::String(user_id));
                payload.insert("traits".into(), traits);
                if let Some(anon) = ctx.param_str_opt(params, "anonymousId") {
                    if !anon.trim().is_empty() {
                        payload.insert("anonymousId".into(), Value::String(anon));
                    }
                }
                ("/identify", Value::Object(payload))
            }
            "track" => {
                let user_id = ctx.param_str(params, "userId")?;
                let event = ctx.param_str(params, "event")?;
                let properties = parse_json_param(ctx, params, "properties")
                    .unwrap_or_else(|| Value::Object(Map::new()));
                let payload = json!({
                    "userId": user_id,
                    "event": event,
                    "properties": properties,
                });
                ("/track", payload)
            }
            "page" => {
                let user_id = ctx.param_str(params, "userId")?;
                let name = ctx.param_str(params, "name")?;
                let properties = parse_json_param(ctx, params, "properties")
                    .unwrap_or_else(|| Value::Object(Map::new()));
                let payload = json!({
                    "userId": user_id,
                    "name": name,
                    "properties": properties,
                });
                ("/page", payload)
            }
            "screen" => {
                let user_id = ctx.param_str(params, "userId")?;
                let name = ctx.param_str(params, "name")?;
                let properties = parse_json_param(ctx, params, "properties")
                    .unwrap_or_else(|| Value::Object(Map::new()));
                let payload = json!({
                    "userId": user_id,
                    "name": name,
                    "properties": properties,
                });
                ("/screen", payload)
            }
            "group" => {
                let user_id = ctx.param_str(params, "userId")?;
                let group_id = ctx.param_str(params, "groupId")?;
                let traits = parse_json_param(ctx, params, "traits")
                    .unwrap_or_else(|| Value::Object(Map::new()));
                let payload = json!({
                    "userId": user_id,
                    "groupId": group_id,
                    "traits": traits,
                });
                ("/group", payload)
            }
            "alias" => {
                let previous_id = ctx.param_str(params, "previousId")?;
                let user_id = ctx.param_str(params, "aliasUserId")?;
                let payload = json!({
                    "previousId": previous_id,
                    "userId": user_id,
                });
                ("/alias", payload)
            }
            "batch" => {
                let batch = parse_json_param(ctx, params, "batch")
                    .ok_or_else(|| NodeError::MissingParameter("batch".into()))?;
                if !batch.is_array() {
                    return Err(NodeError::InvalidParameter {
                        name: "batch".into(),
                        reason: "expected a JSON array of events".into(),
                    });
                }
                let payload = json!({ "batch": batch });
                ("/batch", payload)
            }
            other => {
                return Err(NodeError::InvalidParameter {
                    name: "operation".into(),
                    reason: format!("unknown operation: {other}"),
                });
            }
        };

        let url = format!("{SEGMENT_BASE}{path}");
        let res = ctx
            .http
            .post(&url)
            .basic_auth(&write_key, Some(""))
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await?;
        let status = res.status();
        let text = res.text().await.unwrap_or_default();
        let body: Value = if text.is_empty() {
            json!({ "success": true })
        } else {
            serde_json::from_str(&text).unwrap_or(Value::String(text.clone()))
        };
        if !status.is_success() {
            return Err(NodeError::UpstreamError {
                status: status.as_u16(),
                body: body.to_string(),
            });
        }
        Ok(NodeOutput::single(vec![body]))
    }
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
        Value::Array(arr) => {
            Value::Array(arr.into_iter().map(|x| substitute_value(ctx, x)).collect())
        }
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
