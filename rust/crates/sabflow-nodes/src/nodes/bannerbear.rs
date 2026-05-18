//! Bannerbear node.
//!
//! Auto-generate marketing creatives (images, video) from a template by
//! posting `modifications` against the Bannerbear REST API
//! (https://api.bannerbear.com/v2). Authenticates with a bearer project API
//! key supplied via the `bannerbearApi` credential (`apiKey` field).
//!
//! Returned images are referenced by URL — the node never inlines binary
//! base64 into the item payload. Downstream nodes can fetch the URL through
//! `httpRequest` or pipe it to a binary-data sink.

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

pub struct BannerbearNode;

const BANNERBEAR_API_BASE: &str = "https://api.bannerbear.com/v2";

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for BannerbearNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "bannerbear",
            "Bannerbear",
            "Auto-generate marketing creatives from a Bannerbear template",
            NodeCategory::Marketing,
        )
        .icon("image")
        .color("#FBBF24")
        .credentials(vec![CredentialBinding {
            name: "bannerbearApi".into(),
            display_name: "Bannerbear API Key".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![
                    opt("Image", "image"),
                    opt("Video", "video"),
                    opt("Animated GIF", "animatedGif"),
                    opt("Template", "template"),
                ])
                .default(json!("image"))
                .required(),
            // Image ops
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![opt("Create", "create"), opt("Get", "get")])
                .default(json!("create"))
                .show_when("resource", &["image", "video", "animatedGif"])
                .required(),
            // Template ops
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![opt("Get", "get"), opt("List", "list")])
                .default(json!("list"))
                .show_when("resource", &["template"])
                .required(),
            NodeProperty::new("templateUid", "Template UID", NodePropertyType::String)
                .placeholder("xxxxxxxxxxxxxxxx")
                .show_when("operation", &["create"]),
            NodeProperty::new("modifications", "Modifications", NodePropertyType::Json)
                .show_when("operation", &["create"])
                .description("JSON array of { name, text|image_url|color, ... } modifications"),
            NodeProperty::new("metadata", "Metadata", NodePropertyType::String)
                .show_when("operation", &["create"])
                .description("Optional metadata string round-tripped back on the result"),
            NodeProperty::new("webhookUrl", "Webhook URL", NodePropertyType::String)
                .show_when("operation", &["create"])
                .description("Optional callback URL Bannerbear will POST to when ready"),
            NodeProperty::new("synchronous", "Synchronous", NodePropertyType::Boolean)
                .default(json!(false))
                .show_when("operation", &["create"])
                .description("Wait for render to complete before returning"),
            // Lookup by uid
            NodeProperty::new("uid", "UID", NodePropertyType::String)
                .placeholder("xxxxxxxxxxxxxxxx")
                .show_when("operation", &["get"]),
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

        let resource = ctx
            .param_str_opt(params, "resource")
            .unwrap_or_else(|| "image".to_string());
        let operation = ctx.param_str(params, "operation")?;

        let result: Value = match (resource.as_str(), operation.as_str()) {
            ("image", "create") | ("video", "create") | ("animatedGif", "create") => {
                let template_uid = ctx.param_str(params, "templateUid")?;
                let modifications = parse_json_param(ctx, params, "modifications")
                    .unwrap_or_else(|| Value::Array(vec![]));

                let mut payload = Map::new();
                payload.insert("template".into(), json!(template_uid));
                payload.insert("modifications".into(), modifications);
                if let Some(meta) = ctx.param_str_opt(params, "metadata") {
                    if !meta.trim().is_empty() {
                        payload.insert("metadata".into(), json!(meta));
                    }
                }
                if let Some(hook) = ctx.param_str_opt(params, "webhookUrl") {
                    if !hook.trim().is_empty() {
                        payload.insert("webhook_url".into(), json!(hook));
                    }
                }
                if ctx.param_bool(params, "synchronous", false) {
                    // Bannerbear exposes a separate synchronous endpoint suffix.
                    let endpoint = match resource.as_str() {
                        "image" => "images?synchronous=true",
                        "video" => "videos?synchronous=true",
                        "animatedGif" => "animated_gifs?synchronous=true",
                        _ => unreachable!(),
                    };
                    let body = post_json(ctx, &api_key, endpoint, Value::Object(payload)).await?;
                    image_summary(&resource, body)
                } else {
                    let endpoint = match resource.as_str() {
                        "image" => "images",
                        "video" => "videos",
                        "animatedGif" => "animated_gifs",
                        _ => unreachable!(),
                    };
                    let body = post_json(ctx, &api_key, endpoint, Value::Object(payload)).await?;
                    image_summary(&resource, body)
                }
            }
            ("image", "get") | ("video", "get") | ("animatedGif", "get") => {
                let uid = ctx.param_str(params, "uid")?;
                let endpoint = match resource.as_str() {
                    "image" => format!("images/{uid}"),
                    "video" => format!("videos/{uid}"),
                    "animatedGif" => format!("animated_gifs/{uid}"),
                    _ => unreachable!(),
                };
                let body = get_json(ctx, &api_key, &endpoint).await?;
                image_summary(&resource, body)
            }
            ("template", "get") => {
                let uid = ctx.param_str(params, "uid")?;
                get_json(ctx, &api_key, &format!("templates/{uid}")).await?
            }
            ("template", "list") => get_json(ctx, &api_key, "templates").await?,
            (res, op) => {
                return Err(NodeError::InvalidParameter {
                    name: "operation".into(),
                    reason: format!("unknown {res} operation: {op}"),
                });
            }
        };

        Ok(NodeOutput::single(vec![result]))
    }
}

/// Reshape a Bannerbear create/get response so the downstream item carries
/// the original payload plus a normalised `mediaRef` pointing at the URL.
/// Never inlines binary data — only references.
fn image_summary(resource: &str, body: Value) -> Value {
    let uid = body.get("uid").cloned().unwrap_or(Value::Null);
    let status = body.get("status").cloned().unwrap_or(Value::Null);
    let url = body
        .get("image_url_png")
        .cloned()
        .or_else(|| body.get("image_url").cloned())
        .or_else(|| body.get("video_url").cloned())
        .or_else(|| body.get("gif_url").cloned())
        .unwrap_or(Value::Null);

    let kind = match resource {
        "image" => "image/png",
        "video" => "video/mp4",
        "animatedGif" => "image/gif",
        _ => "application/octet-stream",
    };
    json!({
        "uid": uid,
        "status": status,
        "mediaRef": {
            "kind": "url",
            "mimeType": kind,
            "url": url,
        },
        "raw": body,
    })
}

async fn post_json(
    ctx: &ExecutionContext,
    api_key: &str,
    endpoint: &str,
    payload: Value,
) -> NodeResult<Value> {
    let url = format!("{BANNERBEAR_API_BASE}/{endpoint}");
    let res = ctx
        .http
        .post(&url)
        .bearer_auth(api_key)
        .json(&payload)
        .send()
        .await?;
    finalize(res).await
}

async fn get_json(ctx: &ExecutionContext, api_key: &str, endpoint: &str) -> NodeResult<Value> {
    let url = format!("{BANNERBEAR_API_BASE}/{endpoint}");
    let res = ctx.http.get(&url).bearer_auth(api_key).send().await?;
    finalize(res).await
}

async fn finalize(res: reqwest::Response) -> NodeResult<Value> {
    let status = res.status();
    let body: Value = res.json().await.unwrap_or(Value::Null);
    if !status.is_success() {
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: body.to_string(),
        });
    }
    Ok(body)
}

/// Pull a JSON-shaped property out of `params`. Accepts either a native JSON
/// value (array/object) or a string holding JSON.
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
