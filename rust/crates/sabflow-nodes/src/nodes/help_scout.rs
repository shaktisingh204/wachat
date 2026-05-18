//! Help Scout node.
//!
//! Implements conversation, customer and mailbox operations against the Help
//! Scout Mailbox API v2 (https://api.helpscout.net/v2). Authenticates with an
//! OAuth2 access token (Bearer) supplied via the `helpScoutOAuth2Api`
//! credential (`accessToken`).

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

pub struct HelpScoutNode;

const HS_API_BASE: &str = "https://api.helpscout.net/v2";

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for HelpScoutNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "helpScout",
            "Help Scout",
            "Help Scout customer support — manage conversations and customers",
            NodeCategory::Communication,
        )
        .icon("life-buoy")
        .color("#1292EE")
        .credentials(vec![CredentialBinding {
            name: "helpScoutOAuth2Api".into(),
            display_name: "Help Scout OAuth2".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![
                    opt("Conversation", "conversation"),
                    opt("Customer", "customer"),
                    opt("Mailbox", "mailbox"),
                    opt("Thread", "thread"),
                ])
                .default(json!("conversation"))
                .required(),
            // ---- conversation operations
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("List", "list"),
                    opt("Get", "get"),
                    opt("Create", "create"),
                    opt("Delete", "delete"),
                ])
                .default(json!("list"))
                .show_when("resource", &["conversation"])
                .required(),
            // ---- customer operations
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("List", "list"),
                    opt("Get", "get"),
                    opt("Create", "create"),
                    opt("Update", "update"),
                ])
                .default(json!("list"))
                .show_when("resource", &["customer"])
                .required(),
            // ---- mailbox operations
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![opt("List", "list"), opt("Get", "get")])
                .default(json!("list"))
                .show_when("resource", &["mailbox"])
                .required(),
            // ---- thread operations
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![opt("List", "list"), opt("Create Reply", "createReply")])
                .default(json!("list"))
                .show_when("resource", &["thread"])
                .required(),
            // ---- ids
            NodeProperty::new("id", "ID", NodePropertyType::String)
                .show_when("operation", &["get", "update", "delete"])
                .required(),
            NodeProperty::new("conversationId", "Conversation ID", NodePropertyType::String)
                .show_when("resource", &["thread"])
                .required(),
            // ---- reply payload
            NodeProperty::new("replyText", "Reply Text", NodePropertyType::String)
                .show_when("operation", &["createReply"])
                .required(),
            NodeProperty::new("customerEmail", "Customer Email", NodePropertyType::String)
                .show_when("operation", &["createReply"])
                .required(),
            // ---- create / update payload
            NodeProperty::new("data", "Data (JSON)", NodePropertyType::Json)
                .placeholder("{ \"subject\": \"Hello\", \"customer\": { \"email\": \"a@b.com\" } }")
                .show_when("operation", &["create", "update"])
                .description("Request body."),
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
            .or_else(|| cred.data.get("access_token"))
            .ok_or_else(|| NodeError::MissingParameter("accessToken".into()))?
            .clone();

        let resource = ctx
            .param_str_opt(params, "resource")
            .unwrap_or_else(|| "conversation".to_string());
        let operation = ctx.param_str(params, "operation")?;

        let body: Value = match (resource.as_str(), operation.as_str()) {
            ("conversation", "list") => get_json(ctx, &token, "/conversations").await?,
            ("conversation", "get") => {
                let id = ctx.param_str(params, "id")?;
                let path = format!("/conversations/{id}");
                get_json(ctx, &token, &path).await?
            }
            ("conversation", "create") => {
                let payload = parse_json_param(ctx, params, "data")
                    .unwrap_or_else(|| Value::Object(Map::new()));
                post_json(ctx, &token, "/conversations", payload).await?
            }
            ("conversation", "delete") => {
                let id = ctx.param_str(params, "id")?;
                let path = format!("/conversations/{id}");
                delete_json(ctx, &token, &path).await?
            }
            ("customer", "list") => get_json(ctx, &token, "/customers").await?,
            ("customer", "get") => {
                let id = ctx.param_str(params, "id")?;
                let path = format!("/customers/{id}");
                get_json(ctx, &token, &path).await?
            }
            ("customer", "create") => {
                let payload = parse_json_param(ctx, params, "data")
                    .unwrap_or_else(|| Value::Object(Map::new()));
                post_json(ctx, &token, "/customers", payload).await?
            }
            ("customer", "update") => {
                let id = ctx.param_str(params, "id")?;
                let payload = parse_json_param(ctx, params, "data")
                    .unwrap_or_else(|| Value::Object(Map::new()));
                let path = format!("/customers/{id}");
                put_json(ctx, &token, &path, payload).await?
            }
            ("mailbox", "list") => get_json(ctx, &token, "/mailboxes").await?,
            ("mailbox", "get") => {
                let id = ctx.param_str(params, "id")?;
                let path = format!("/mailboxes/{id}");
                get_json(ctx, &token, &path).await?
            }
            ("thread", "list") => {
                let convo_id = ctx.param_str(params, "conversationId")?;
                let path = format!("/conversations/{convo_id}/threads");
                get_json(ctx, &token, &path).await?
            }
            ("thread", "createReply") => {
                let convo_id = ctx.param_str(params, "conversationId")?;
                let text = ctx.param_str(params, "replyText")?;
                let email = ctx.param_str(params, "customerEmail")?;
                let path = format!("/conversations/{convo_id}/reply");
                let payload = json!({
                    "text": text,
                    "customer": { "email": email }
                });
                post_json(ctx, &token, &path, payload).await?
            }
            (res, op) => {
                return Err(NodeError::InvalidParameter {
                    name: "operation".into(),
                    reason: format!("unsupported {res}/{op} combination"),
                });
            }
        };

        Ok(NodeOutput::single(vec![body]))
    }
}

async fn get_json(ctx: &ExecutionContext, token: &str, path: &str) -> NodeResult<Value> {
    let url = format!("{HS_API_BASE}{path}");
    let res = ctx.http.get(&url).bearer_auth(token).send().await?;
    finalize_response(res).await
}

async fn post_json(
    ctx: &ExecutionContext,
    token: &str,
    path: &str,
    payload: Value,
) -> NodeResult<Value> {
    let url = format!("{HS_API_BASE}{path}");
    let res = ctx
        .http
        .post(&url)
        .bearer_auth(token)
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .json(&payload)
        .send()
        .await?;
    finalize_response(res).await
}

async fn put_json(
    ctx: &ExecutionContext,
    token: &str,
    path: &str,
    payload: Value,
) -> NodeResult<Value> {
    let url = format!("{HS_API_BASE}{path}");
    let res = ctx
        .http
        .put(&url)
        .bearer_auth(token)
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .json(&payload)
        .send()
        .await?;
    finalize_response(res).await
}

async fn delete_json(ctx: &ExecutionContext, token: &str, path: &str) -> NodeResult<Value> {
    let url = format!("{HS_API_BASE}{path}");
    let res = ctx.http.delete(&url).bearer_auth(token).send().await?;
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
    if body.is_null() {
        Ok(json!({ "deleted": true }))
    } else {
        Ok(body)
    }
}

async fn finalize_response(res: reqwest::Response) -> NodeResult<Value> {
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
