//! Bitly node.
//!
//! Implements short-link operations against the Bitly v4 REST API
//! (`https://api-ssl.bitly.com/v4`). Authenticates with a personal generic
//! access token via Bearer auth.

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

pub struct BitlyNode;

const BITLY_BASE: &str = "https://api-ssl.bitly.com/v4";

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for BitlyNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "bitly",
            "Bitly",
            "Shorten and manage URLs via the Bitly v4 API",
            NodeCategory::Marketing,
        )
        .icon("link")
        .color("#EE6123")
        .credentials(vec![CredentialBinding {
            name: "bitlyApi".into(),
            display_name: "Bitly API".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Shorten URL", "shorten"),
                    opt("Expand Bitlink", "expand"),
                    opt("Update Bitlink", "update"),
                    opt("Get Bitlink Clicks", "clicks"),
                    opt("List Group Bitlinks", "listGroupBitlinks"),
                ])
                .default(json!("shorten"))
                .required(),
            // shorten
            NodeProperty::new("longUrl", "Long URL", NodePropertyType::String)
                .placeholder("https://example.com/a/very/long/path")
                .show_when("operation", &["shorten"])
                .required(),
            NodeProperty::new("groupGuid", "Group GUID", NodePropertyType::String)
                .show_when("operation", &["shorten", "listGroupBitlinks"])
                .description("Optional Bitly group GUID; falls back to the user default if empty"),
            NodeProperty::new("domain", "Domain", NodePropertyType::String)
                .placeholder("bit.ly")
                .show_when("operation", &["shorten"])
                .description("Optional custom domain for the short link"),
            // expand / update / clicks share bitlink
            NodeProperty::new("bitlink", "Bitlink", NodePropertyType::String)
                .placeholder("bit.ly/AbCdEf")
                .show_when("operation", &["expand", "update", "clicks"])
                .required(),
            // update fields
            NodeProperty::new("title", "Title", NodePropertyType::String)
                .show_when("operation", &["update"]),
            NodeProperty::new("tags", "Tags", NodePropertyType::Json)
                .show_when("operation", &["update"])
                .description("JSON array of string tags"),
            NodeProperty::new("archived", "Archived", NodePropertyType::Boolean)
                .show_when("operation", &["update"]),
            // clicks unit
            NodeProperty::new("unit", "Unit", NodePropertyType::Options)
                .options(vec![
                    opt("Hour", "hour"),
                    opt("Day", "day"),
                    opt("Week", "week"),
                    opt("Month", "month"),
                ])
                .default(json!("day"))
                .show_when("operation", &["clicks"]),
            NodeProperty::new("units", "Units", NodePropertyType::Number)
                .default(json!(-1))
                .show_when("operation", &["clicks"])
                .description("How many units of `unit` to look back; -1 = all-time"),
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
        let token = cred
            .data
            .get("accessToken")
            .ok_or_else(|| NodeError::MissingParameter("accessToken".into()))?
            .clone();

        let operation = ctx.param_str(params, "operation")?;

        let body: Value = match operation.as_str() {
            "shorten" => {
                let long_url = ctx.param_str(params, "longUrl")?;
                let mut payload = Map::new();
                payload.insert("long_url".into(), Value::String(long_url));
                if let Some(group) = ctx.param_str_opt(params, "groupGuid") {
                    if !group.trim().is_empty() {
                        payload.insert("group_guid".into(), Value::String(group));
                    }
                }
                if let Some(domain) = ctx.param_str_opt(params, "domain") {
                    if !domain.trim().is_empty() {
                        payload.insert("domain".into(), Value::String(domain));
                    }
                }
                let url = format!("{BITLY_BASE}/shorten");
                send_request(ctx, &token, Method::Post, &url, Some(Value::Object(payload)))
                    .await?
            }
            "expand" => {
                let bitlink = ctx.param_str(params, "bitlink")?;
                let payload = json!({ "bitlink_id": bitlink });
                let url = format!("{BITLY_BASE}/expand");
                send_request(ctx, &token, Method::Post, &url, Some(payload)).await?
            }
            "update" => {
                let bitlink = ctx.param_str(params, "bitlink")?;
                let bitlink_escaped = url_encode_segment(&bitlink);
                let mut payload = Map::new();
                if let Some(title) = ctx.param_str_opt(params, "title") {
                    if !title.is_empty() {
                        payload.insert("title".into(), Value::String(title));
                    }
                }
                if let Some(tags) = parse_json_param(ctx, params, "tags") {
                    payload.insert("tags".into(), tags);
                }
                if let Some(arch) = params.get("archived").and_then(|v| v.as_bool()) {
                    payload.insert("archived".into(), Value::Bool(arch));
                }
                let url = format!("{BITLY_BASE}/bitlinks/{bitlink_escaped}");
                send_request(ctx, &token, Method::Patch, &url, Some(Value::Object(payload)))
                    .await?
            }
            "clicks" => {
                let bitlink = ctx.param_str(params, "bitlink")?;
                let bitlink_escaped = url_encode_segment(&bitlink);
                let unit = ctx
                    .param_str_opt(params, "unit")
                    .unwrap_or_else(|| "day".to_string());
                let units = ctx.param_f64(params, "units").map(|n| n as i64).unwrap_or(-1);
                let url = format!(
                    "{BITLY_BASE}/bitlinks/{bitlink_escaped}/clicks?unit={unit}&units={units}"
                );
                send_request(ctx, &token, Method::Get, &url, None).await?
            }
            "listGroupBitlinks" => {
                let group = ctx.param_str(params, "groupGuid")?;
                let url = format!("{BITLY_BASE}/groups/{group}/bitlinks");
                send_request(ctx, &token, Method::Get, &url, None).await?
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

#[derive(Clone, Copy)]
enum Method {
    Get,
    Post,
    Patch,
}

async fn send_request(
    ctx: &ExecutionContext,
    token: &str,
    method: Method,
    url: &str,
    payload: Option<Value>,
) -> NodeResult<Value> {
    let mut req = match method {
        Method::Get => ctx.http.get(url),
        Method::Post => ctx.http.post(url),
        Method::Patch => ctx.http.patch(url),
    };
    req = req
        .bearer_auth(token)
        .header("Content-Type", "application/json");
    if let Some(body) = payload {
        req = req.json(&body);
    }
    let res = req.send().await?;
    let status = res.status();
    let text = res.text().await.unwrap_or_default();
    let json_body: Value = if text.is_empty() {
        Value::Null
    } else {
        serde_json::from_str(&text).unwrap_or(Value::String(text.clone()))
    };
    if !status.is_success() {
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: json_body.to_string(),
        });
    }
    Ok(json_body)
}

/// Bitly bitlinks contain `/` (e.g. `bit.ly/AbCdEf`). Bitly accepts the slash
/// as-is in path segments, but tools like curl warn — minimal percent-encoding
/// keeps URLs predictable for clients without breaking Bitly's parser.
fn url_encode_segment(s: &str) -> String {
    // Bitly's docs use the raw bitlink (with `/`) directly in the URL, so we
    // pass through unmodified. Kept as a function so future encoding tweaks
    // are localised.
    s.to_string()
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
        Value::Array(arr) => Value::Array(
            arr.into_iter()
                .map(|x| substitute_value(ctx, x))
                .collect(),
        ),
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
