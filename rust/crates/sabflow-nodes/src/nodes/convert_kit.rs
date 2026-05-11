//! ConvertKit node.
//!
//! Implements subscriber, tag, and form operations against the ConvertKit v3
//! API (`https://api.convertkit.com/v3`). Authentication is the `apiSecret`
//! passed as an `api_secret` query string parameter on every request.

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

pub struct ConvertKitNode;

const CONVERTKIT_API_BASE: &str = "https://api.convertkit.com/v3";

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for ConvertKitNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "convertKit",
            "ConvertKit",
            "Manage subscribers, tags, and forms in ConvertKit",
            NodeCategory::Marketing,
        )
        .icon("send")
        .color("#FB6970")
        .credentials(vec![CredentialBinding {
            name: "convertKitApi".into(),
            display_name: "ConvertKit API".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Add Subscriber to Form", "addSubscriber"),
                    opt("Get Subscriber", "getSubscriber"),
                    opt("List Subscribers", "listSubscribers"),
                    opt("Unsubscribe", "unsubscribe"),
                    opt("Add Tag to Subscriber", "addTagToSubscriber"),
                    opt("List Tags", "listTags"),
                    opt("List Forms", "listForms"),
                ])
                .default(json!("addSubscriber"))
                .required(),
            // addSubscriber
            NodeProperty::new("formId", "Form ID", NodePropertyType::String)
                .show_when("operation", &["addSubscriber"])
                .required(),
            NodeProperty::new("email", "Email", NodePropertyType::String)
                .placeholder("user@example.com")
                .show_when(
                    "operation",
                    &["addSubscriber", "unsubscribe", "addTagToSubscriber"],
                )
                .required(),
            NodeProperty::new("firstName", "First Name", NodePropertyType::String)
                .show_when("operation", &["addSubscriber"]),
            // getSubscriber
            NodeProperty::new("subscriberId", "Subscriber ID", NodePropertyType::String)
                .show_when("operation", &["getSubscriber"])
                .required(),
            // addTagToSubscriber
            NodeProperty::new("tagId", "Tag ID", NodePropertyType::String)
                .show_when("operation", &["addTagToSubscriber"])
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
        let api_secret = cred
            .data
            .get("apiSecret")
            .ok_or_else(|| NodeError::MissingParameter("apiSecret".into()))?
            .clone();

        let operation = ctx.param_str(params, "operation")?;

        let body: Value = match operation.as_str() {
            "addSubscriber" => {
                let form_id = ctx.param_str(params, "formId")?;
                let email = ctx.param_str(params, "email")?;
                let mut payload = Map::new();
                payload.insert("api_secret".into(), json!(api_secret));
                payload.insert("email".into(), json!(email));
                if let Some(first_name) = ctx.param_str_opt(params, "firstName") {
                    if !first_name.is_empty() {
                        payload.insert("first_name".into(), json!(first_name));
                    }
                }
                let url = format!("{CONVERTKIT_API_BASE}/forms/{form_id}/subscribe");
                send_request(ctx, Method::Post, &url, Some(Value::Object(payload))).await?
            }
            "getSubscriber" => {
                let subscriber_id = ctx.param_str(params, "subscriberId")?;
                let url = format!(
                    "{CONVERTKIT_API_BASE}/subscribers/{subscriber_id}?api_secret={api_secret}"
                );
                send_request(ctx, Method::Get, &url, None).await?
            }
            "listSubscribers" => {
                let url = format!("{CONVERTKIT_API_BASE}/subscribers?api_secret={api_secret}");
                send_request(ctx, Method::Get, &url, None).await?
            }
            "unsubscribe" => {
                let email = ctx.param_str(params, "email")?;
                let payload = json!({ "api_secret": api_secret, "email": email });
                let url = format!("{CONVERTKIT_API_BASE}/unsubscribe");
                send_request(ctx, Method::Put, &url, Some(payload)).await?
            }
            "addTagToSubscriber" => {
                let tag_id = ctx.param_str(params, "tagId")?;
                let email = ctx.param_str(params, "email")?;
                let payload = json!({ "api_secret": api_secret, "email": email });
                let url = format!("{CONVERTKIT_API_BASE}/tags/{tag_id}/subscribe");
                send_request(ctx, Method::Post, &url, Some(payload)).await?
            }
            "listTags" => {
                let url = format!("{CONVERTKIT_API_BASE}/tags?api_secret={api_secret}");
                send_request(ctx, Method::Get, &url, None).await?
            }
            "listForms" => {
                let url = format!("{CONVERTKIT_API_BASE}/forms?api_secret={api_secret}");
                send_request(ctx, Method::Get, &url, None).await?
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
    Put,
}

async fn send_request(
    ctx: &ExecutionContext,
    method: Method,
    url: &str,
    payload: Option<Value>,
) -> NodeResult<Value> {
    let mut req = match method {
        Method::Get => ctx.http.get(url),
        Method::Post => ctx.http.post(url),
        Method::Put => ctx.http.put(url),
    };
    req = req.header("Content-Type", "application/json");
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
