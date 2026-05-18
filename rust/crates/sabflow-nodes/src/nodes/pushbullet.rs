//! Pushbullet node — push notifications and links across a user's devices via
//! the Pushbullet v2 REST API (`https://api.pushbullet.com/v2`).
//!
//! Credentials: `pushbulletApi` with a single `accessToken` field. Pushbullet
//! authenticates via the `Access-Token` header (not bearer) and returns JSON
//! for every endpoint we hit here.

use async_trait::async_trait;
use serde_json::{Value, json};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{
        CredentialBinding, NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption,
        NodePropertyType,
    },
    error::{NodeError, NodeResult},
    node::Node,
};

const PUSHBULLET_API_BASE: &str = "https://api.pushbullet.com/v2";

pub struct PushbulletNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for PushbulletNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "pushbullet",
            "Pushbullet",
            "Push notes and links to your devices via Pushbullet",
            NodeCategory::Communication,
        )
        .icon("bell")
        .color("#4AB367")
        .credentials(vec![CredentialBinding {
            name: "pushbulletApi".into(),
            display_name: "Pushbullet API".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Push Note", "pushNote"),
                    opt("Push Link", "pushLink"),
                    opt("List Pushes", "listPushes"),
                    opt("Delete Push", "deletePush"),
                    opt("List Devices", "listDevices"),
                    opt("Get Me", "getMe"),
                ])
                .default(json!("pushNote"))
                .required(),
            // Targeting (optional — defaults to all devices)
            NodeProperty::new("deviceIden", "Device IDEN", NodePropertyType::String)
                .placeholder("ujpah72o0sjAoRtnM0jc")
                .description(
                    "Optional. Restrict the push to a single device. Leave blank to push to all.",
                )
                .show_when("operation", &["pushNote", "pushLink"]),
            NodeProperty::new("email", "Email", NodePropertyType::String)
                .placeholder("friend@example.com")
                .description(
                    "Optional. Push to a Pushbullet user (or any address) by email.",
                )
                .show_when("operation", &["pushNote", "pushLink"]),
            // Note / link payload
            NodeProperty::new("title", "Title", NodePropertyType::String)
                .show_when("operation", &["pushNote", "pushLink"]),
            NodeProperty::new("body", "Body", NodePropertyType::String)
                .show_when("operation", &["pushNote", "pushLink"]),
            NodeProperty::new("url", "URL", NodePropertyType::String)
                .placeholder("https://example.com")
                .show_when("operation", &["pushLink"])
                .required(),
            // listPushes
            NodeProperty::new("limit", "Limit", NodePropertyType::Number)
                .default(10)
                .description("Maximum pushes to return (max 500)")
                .show_when("operation", &["listPushes"]),
            // deletePush
            NodeProperty::new("pushIden", "Push IDEN", NodePropertyType::String)
                .placeholder("ujpah72o0sjAoRtnM0jc")
                .show_when("operation", &["deletePush"])
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
        let access_token = cred
            .data
            .get("accessToken")
            .ok_or_else(|| NodeError::MissingParameter("accessToken".into()))?
            .clone();

        let operation = ctx.param_str(params, "operation")?;

        match operation.as_str() {
            "pushNote" => {
                let mut payload = json!({ "type": "note" });
                attach_targeting(ctx, params, &mut payload);
                attach_title_body(ctx, params, &mut payload);
                let res = ctx
                    .http
                    .post(format!("{PUSHBULLET_API_BASE}/pushes"))
                    .header("Access-Token", &access_token)
                    .json(&payload)
                    .send()
                    .await?;
                finalize(res).await
            }
            "pushLink" => {
                let url_raw = ctx.param_str(params, "url")?;
                let url = url_raw.trim().to_string();
                if url.is_empty() {
                    return Err(NodeError::MissingParameter("url".into()));
                }
                let mut payload = json!({ "type": "link", "url": url });
                attach_targeting(ctx, params, &mut payload);
                attach_title_body(ctx, params, &mut payload);
                let res = ctx
                    .http
                    .post(format!("{PUSHBULLET_API_BASE}/pushes"))
                    .header("Access-Token", &access_token)
                    .json(&payload)
                    .send()
                    .await?;
                finalize(res).await
            }
            "listPushes" => {
                let limit = ctx.param_f64(params, "limit").unwrap_or(10.0).max(1.0) as u32;
                let res = ctx
                    .http
                    .get(format!("{PUSHBULLET_API_BASE}/pushes"))
                    .header("Access-Token", &access_token)
                    .query(&[("limit", limit.to_string())])
                    .send()
                    .await?;
                finalize(res).await
            }
            "deletePush" => {
                let iden_raw = ctx.param_str(params, "pushIden")?;
                let iden = iden_raw.trim().to_string();
                if iden.is_empty() {
                    return Err(NodeError::MissingParameter("pushIden".into()));
                }
                let encoded = urlencoding::encode(&iden);
                let res = ctx
                    .http
                    .delete(format!("{PUSHBULLET_API_BASE}/pushes/{encoded}"))
                    .header("Access-Token", &access_token)
                    .send()
                    .await?;
                finalize(res).await
            }
            "listDevices" => {
                let res = ctx
                    .http
                    .get(format!("{PUSHBULLET_API_BASE}/devices"))
                    .header("Access-Token", &access_token)
                    .send()
                    .await?;
                finalize(res).await
            }
            "getMe" => {
                let res = ctx
                    .http
                    .get(format!("{PUSHBULLET_API_BASE}/users/me"))
                    .header("Access-Token", &access_token)
                    .send()
                    .await?;
                finalize(res).await
            }
            other => Err(NodeError::InvalidParameter {
                name: "operation".into(),
                reason: format!("unknown operation: {other}"),
            }),
        }
    }
}

/// Pull `deviceIden` and/or `email` out of the params and mix them into the
/// outgoing payload. Both are optional — when both are present, `email` wins
/// (matches the API's behaviour of preferring a directed push).
fn attach_targeting(ctx: &ExecutionContext, params: &Value, payload: &mut Value) {
    let obj = match payload.as_object_mut() {
        Some(o) => o,
        None => return,
    };
    if let Some(email) = ctx
        .param_str_opt(params, "email")
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
    {
        obj.insert("email".into(), json!(email));
        return;
    }
    if let Some(iden) = ctx
        .param_str_opt(params, "deviceIden")
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
    {
        obj.insert("device_iden".into(), json!(iden));
    }
}

fn attach_title_body(ctx: &ExecutionContext, params: &Value, payload: &mut Value) {
    let obj = match payload.as_object_mut() {
        Some(o) => o,
        None => return,
    };
    if let Some(title) = ctx
        .param_str_opt(params, "title")
        .filter(|s| !s.is_empty())
    {
        obj.insert("title".into(), json!(title));
    }
    if let Some(body) = ctx
        .param_str_opt(params, "body")
        .filter(|s| !s.is_empty())
    {
        obj.insert("body".into(), json!(body));
    }
}

async fn finalize(res: reqwest::Response) -> NodeResult<NodeOutput> {
    let status = res.status();
    let bytes = res.bytes().await?;
    let body_value = if bytes.is_empty() {
        Value::Null
    } else {
        serde_json::from_slice::<Value>(&bytes)
            .unwrap_or_else(|_| Value::String(String::from_utf8_lossy(&bytes).into_owned()))
    };

    if !status.is_success() {
        let body_str = match &body_value {
            Value::String(s) => s.clone(),
            Value::Null => String::new(),
            other => other.to_string(),
        };
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: body_str,
        });
    }
    Ok(NodeOutput::single(vec![body_value]))
}
