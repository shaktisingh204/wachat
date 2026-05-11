//! MailerLite node.
//!
//! Implements subscriber and group operations against the MailerLite
//! Connect API (https://connect.mailerlite.com/api). Authenticates with
//! Bearer auth using the API key from the `mailerLiteApi` credential.

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

pub struct MailerLiteNode;

const MAILERLITE_API_BASE: &str = "https://connect.mailerlite.com/api";

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for MailerLiteNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "mailerLite",
            "MailerLite",
            "Email marketing — manage subscribers and groups in MailerLite",
            NodeCategory::Marketing,
        )
        .icon("send")
        .color("#09C269")
        .credentials(vec![CredentialBinding {
            name: "mailerLiteApi".into(),
            display_name: "MailerLite API Key".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Create Subscriber", "createSubscriber"),
                    opt("Get Subscriber", "getSubscriber"),
                    opt("List Subscribers", "listSubscribers"),
                    opt("Update Subscriber", "updateSubscriber"),
                    opt("Delete Subscriber", "deleteSubscriber"),
                    opt("List Groups", "listGroups"),
                    opt("Add Subscriber to Group", "addSubscriberToGroup"),
                ])
                .default(json!("createSubscriber"))
                .required(),
            // createSubscriber
            NodeProperty::new("email", "Email", NodePropertyType::String)
                .placeholder("user@example.com")
                .show_when("operation", &["createSubscriber"])
                .required(),
            NodeProperty::new("fields", "Fields", NodePropertyType::Json)
                .show_when("operation", &["createSubscriber", "updateSubscriber"])
                .description("JSON object of subscriber fields, e.g. {\"name\":\"Jane\",\"last_name\":\"Doe\"}"),
            NodeProperty::new("groups", "Groups", NodePropertyType::Json)
                .show_when("operation", &["createSubscriber"])
                .description("JSON array of group ids, e.g. [\"123\",\"456\"]"),
            // subscriberId for get/update/delete and group-add
            NodeProperty::new("subscriberId", "Subscriber ID", NodePropertyType::String)
                .show_when(
                    "operation",
                    &[
                        "getSubscriber",
                        "updateSubscriber",
                        "deleteSubscriber",
                        "addSubscriberToGroup",
                    ],
                )
                .required(),
            // addSubscriberToGroup
            NodeProperty::new("groupId", "Group ID", NodePropertyType::String)
                .show_when("operation", &["addSubscriberToGroup"])
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

        let operation = ctx.param_str(params, "operation")?;

        let body: Value = match operation.as_str() {
            "createSubscriber" => {
                let email = ctx.param_str(params, "email")?;
                let mut payload = Map::new();
                payload.insert("email".into(), json!(email));
                if let Some(fields) = parse_json_param(ctx, params, "fields") {
                    payload.insert("fields".into(), fields);
                }
                if let Some(groups) = parse_json_param(ctx, params, "groups") {
                    payload.insert("groups".into(), groups);
                }
                send_request(
                    ctx,
                    &api_key,
                    Method::Post,
                    "/subscribers",
                    Some(Value::Object(payload)),
                )
                .await?
            }
            "getSubscriber" => {
                let subscriber_id = ctx.param_str(params, "subscriberId")?;
                let path = format!("/subscribers/{subscriber_id}");
                send_request(ctx, &api_key, Method::Get, &path, None).await?
            }
            "listSubscribers" => {
                send_request(ctx, &api_key, Method::Get, "/subscribers", None).await?
            }
            "updateSubscriber" => {
                let subscriber_id = ctx.param_str(params, "subscriberId")?;
                let mut payload = Map::new();
                if let Some(fields) = parse_json_param(ctx, params, "fields") {
                    payload.insert("fields".into(), fields);
                }
                let path = format!("/subscribers/{subscriber_id}");
                send_request(
                    ctx,
                    &api_key,
                    Method::Put,
                    &path,
                    Some(Value::Object(payload)),
                )
                .await?
            }
            "deleteSubscriber" => {
                let subscriber_id = ctx.param_str(params, "subscriberId")?;
                let path = format!("/subscribers/{subscriber_id}");
                send_request(ctx, &api_key, Method::Delete, &path, None).await?
            }
            "listGroups" => {
                send_request(ctx, &api_key, Method::Get, "/groups", None).await?
            }
            "addSubscriberToGroup" => {
                let subscriber_id = ctx.param_str(params, "subscriberId")?;
                let group_id = ctx.param_str(params, "groupId")?;
                let path = format!("/subscribers/{subscriber_id}/groups/{group_id}");
                send_request(ctx, &api_key, Method::Post, &path, None).await?
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
    Delete,
}

async fn send_request(
    ctx: &ExecutionContext,
    api_key: &str,
    method: Method,
    path: &str,
    payload: Option<Value>,
) -> NodeResult<Value> {
    let url = format!("{MAILERLITE_API_BASE}{path}");
    let mut req = match method {
        Method::Get => ctx.http.get(&url),
        Method::Post => ctx.http.post(&url),
        Method::Put => ctx.http.put(&url),
        Method::Delete => ctx.http.delete(&url),
    };
    req = req
        .bearer_auth(api_key)
        .header("Content-Type", "application/json")
        .header("Accept", "application/json");
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
