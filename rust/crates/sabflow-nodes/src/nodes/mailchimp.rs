//! Mailchimp node.
//!
//! Implements list, member, and campaign operations against the Mailchimp
//! Marketing API v3.0. The API key is suffixed with the data-center identifier
//! (e.g. `abc123-us21`); the portion after the dash is used as the host prefix
//! so the base URL becomes `https://{dc}.api.mailchimp.com/3.0`.
//!
//! Authenticates with HTTP Basic where the username is any non-empty string
//! and the password is the API key.

use async_trait::async_trait;
use md5::{Digest, Md5};
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

pub struct MailchimpNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for MailchimpNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "mailchimp",
            "Mailchimp",
            "Mailchimp list, member, and campaign operations",
            NodeCategory::Marketing,
        )
        .icon("send")
        .color("#FFE01B")
        .credentials(vec![CredentialBinding {
            name: "mailchimpApi".into(),
            display_name: "Mailchimp API Key".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![
                    opt("List", "list"),
                    opt("Member", "member"),
                    opt("Campaign", "campaign"),
                ])
                .default(json!("member"))
                .required(),
            // list operations
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![opt("Get All", "getAll"), opt("Get", "get")])
                .default(json!("getAll"))
                .show_when("resource", &["list"])
                .required(),
            // member operations
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Add", "add"),
                    opt("Get", "get"),
                    opt("Update", "update"),
                    opt("Delete", "delete"),
                ])
                .default(json!("add"))
                .show_when("resource", &["member"])
                .required(),
            // campaign operations
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Get All", "getAll"),
                    opt("Get", "get"),
                    opt("Create", "create"),
                    opt("Send", "send"),
                ])
                .default(json!("getAll"))
                .show_when("resource", &["campaign"])
                .required(),
            // shared list id (member operations + list:get)
            NodeProperty::new("listId", "List ID", NodePropertyType::String)
                .placeholder("a1b2c3d4e5")
                .description("Mailchimp audience (list) id"),
            // member email
            NodeProperty::new("email", "Email", NodePropertyType::String)
                .placeholder("user@example.com")
                .show_when("operation", &["add", "get", "update", "delete"]),
            // member status
            NodeProperty::new("status", "Status", NodePropertyType::Options)
                .options(vec![
                    opt("Subscribed", "subscribed"),
                    opt("Unsubscribed", "unsubscribed"),
                    opt("Pending", "pending"),
                ])
                .default(json!("subscribed"))
                .show_when("operation", &["add", "update"]),
            // merge fields
            NodeProperty::new("mergeFields", "Merge Fields", NodePropertyType::Json)
                .show_when("operation", &["add", "update"])
                .description("JSON object of merge field values, e.g. {\"FNAME\":\"Jane\",\"LNAME\":\"Doe\"}"),
            // campaign id
            NodeProperty::new("campaignId", "Campaign ID", NodePropertyType::String)
                .show_when("operation", &["get", "send"]),
            // campaign creation
            NodeProperty::new("campaignType", "Campaign Type", NodePropertyType::Options)
                .options(vec![opt("Regular", "regular"), opt("Plaintext", "plaintext")])
                .default(json!("regular"))
                .show_when("operation", &["create"]),
            NodeProperty::new("subject", "Subject Line", NodePropertyType::String)
                .show_when("operation", &["create"]),
            NodeProperty::new("fromName", "From Name", NodePropertyType::String)
                .show_when("operation", &["create"]),
            NodeProperty::new("replyTo", "Reply-To Email", NodePropertyType::String)
                .show_when("operation", &["create"]),
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

        let dc = api_key
            .rsplit('-')
            .next()
            .filter(|s| !s.is_empty() && *s != api_key)
            .ok_or_else(|| NodeError::InvalidParameter {
                name: "apiKey".into(),
                reason: "API key must end with a data-center suffix like '-us21'".into(),
            })?
            .to_string();
        let base = format!("https://{dc}.api.mailchimp.com/3.0");

        let resource = ctx
            .param_str_opt(params, "resource")
            .unwrap_or_else(|| "member".to_string());
        let operation = ctx.param_str(params, "operation")?;

        let body: Value = match (resource.as_str(), operation.as_str()) {
            // ----- Lists -----
            ("list", "getAll") => {
                send_request(ctx, &api_key, Method::Get, &format!("{base}/lists"), None).await?
            }
            ("list", "get") => {
                let list_id = ctx.param_str(params, "listId")?;
                let url = format!("{base}/lists/{list_id}");
                send_request(ctx, &api_key, Method::Get, &url, None).await?
            }
            // ----- Members -----
            ("member", "add") => {
                let list_id = ctx.param_str(params, "listId")?;
                let email = ctx.param_str(params, "email")?;
                let status = ctx
                    .param_str_opt(params, "status")
                    .unwrap_or_else(|| "subscribed".to_string());
                let mut payload = Map::new();
                payload.insert("email_address".into(), json!(email));
                payload.insert("status".into(), json!(status));
                if let Some(mf) = parse_json_param(ctx, params, "mergeFields") {
                    payload.insert("merge_fields".into(), mf);
                }
                let url = format!("{base}/lists/{list_id}/members");
                send_request(
                    ctx,
                    &api_key,
                    Method::Post,
                    &url,
                    Some(Value::Object(payload)),
                )
                .await?
            }
            ("member", "get") => {
                let list_id = ctx.param_str(params, "listId")?;
                let email = ctx.param_str(params, "email")?;
                let hash = subscriber_hash(&email);
                let url = format!("{base}/lists/{list_id}/members/{hash}");
                send_request(ctx, &api_key, Method::Get, &url, None).await?
            }
            ("member", "update") => {
                let list_id = ctx.param_str(params, "listId")?;
                let email = ctx.param_str(params, "email")?;
                let hash = subscriber_hash(&email);
                let status = ctx
                    .param_str_opt(params, "status")
                    .unwrap_or_else(|| "subscribed".to_string());
                let mut payload = Map::new();
                payload.insert("email_address".into(), json!(email));
                payload.insert("status".into(), json!(status));
                if let Some(mf) = parse_json_param(ctx, params, "mergeFields") {
                    payload.insert("merge_fields".into(), mf);
                }
                let url = format!("{base}/lists/{list_id}/members/{hash}");
                send_request(
                    ctx,
                    &api_key,
                    Method::Put,
                    &url,
                    Some(Value::Object(payload)),
                )
                .await?
            }
            ("member", "delete") => {
                let list_id = ctx.param_str(params, "listId")?;
                let email = ctx.param_str(params, "email")?;
                let hash = subscriber_hash(&email);
                let url = format!("{base}/lists/{list_id}/members/{hash}");
                send_request(ctx, &api_key, Method::Delete, &url, None).await?
            }
            // ----- Campaigns -----
            ("campaign", "getAll") => {
                let url = format!("{base}/campaigns");
                send_request(ctx, &api_key, Method::Get, &url, None).await?
            }
            ("campaign", "get") => {
                let campaign_id = ctx.param_str(params, "campaignId")?;
                let url = format!("{base}/campaigns/{campaign_id}");
                send_request(ctx, &api_key, Method::Get, &url, None).await?
            }
            ("campaign", "create") => {
                let list_id = ctx.param_str(params, "listId")?;
                let campaign_type = ctx
                    .param_str_opt(params, "campaignType")
                    .unwrap_or_else(|| "regular".to_string());
                let subject = ctx.param_str(params, "subject")?;
                let from_name = ctx.param_str(params, "fromName")?;
                let reply_to = ctx.param_str(params, "replyTo")?;
                let payload = json!({
                    "type": campaign_type,
                    "recipients": { "list_id": list_id },
                    "settings": {
                        "subject_line": subject,
                        "from_name": from_name,
                        "reply_to": reply_to,
                    },
                });
                let url = format!("{base}/campaigns");
                send_request(ctx, &api_key, Method::Post, &url, Some(payload)).await?
            }
            ("campaign", "send") => {
                let campaign_id = ctx.param_str(params, "campaignId")?;
                let url = format!("{base}/campaigns/{campaign_id}/actions/send");
                send_request(ctx, &api_key, Method::Post, &url, None).await?
            }
            (res, op) => {
                return Err(NodeError::InvalidParameter {
                    name: "operation".into(),
                    reason: format!("unknown {res} operation: {op}"),
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
    Put,
    Delete,
}

async fn send_request(
    ctx: &ExecutionContext,
    api_key: &str,
    method: Method,
    url: &str,
    payload: Option<Value>,
) -> NodeResult<Value> {
    let mut req = match method {
        Method::Get => ctx.http.get(url),
        Method::Post => ctx.http.post(url),
        Method::Put => ctx.http.put(url),
        Method::Delete => ctx.http.delete(url),
    };
    req = req
        .basic_auth("anystring", Some(api_key))
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

/// Mailchimp's "subscriber hash" — the MD5 (lowercase hex) of the lowercased
/// email address.
fn subscriber_hash(email: &str) -> String {
    let mut hasher = Md5::new();
    hasher.update(email.to_lowercase().as_bytes());
    let digest = hasher.finalize();
    let mut out = String::with_capacity(32);
    for byte in digest {
        out.push_str(&format!("{byte:02x}"));
    }
    out
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
