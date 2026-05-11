//! GetResponse node.
//!
//! Implements contact and campaign operations against the GetResponse v3 API
//! (https://api.getresponse.com/v3). Authenticates via the
//! `X-Auth-Token: api-key {apiKey}` header.

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

pub struct GetResponseNode;

const GETRESPONSE_API_BASE: &str = "https://api.getresponse.com/v3";

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for GetResponseNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "getResponse",
            "GetResponse",
            "Email marketing — manage contacts and campaigns in GetResponse",
            NodeCategory::Marketing,
        )
        .icon("send")
        .color("#00BAFF")
        .credentials(vec![CredentialBinding {
            name: "getResponseApi".into(),
            display_name: "GetResponse API Key".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Add Contact", "addContact"),
                    opt("Get Contact", "getContact"),
                    opt("List Contacts", "listContacts"),
                    opt("Update Contact", "updateContact"),
                    opt("Delete Contact", "deleteContact"),
                    opt("List Campaigns", "listCampaigns"),
                ])
                .default(json!("addContact"))
                .required(),
            // addContact
            NodeProperty::new("campaignId", "Campaign ID", NodePropertyType::String)
                .show_when("operation", &["addContact"])
                .description("GetResponse campaign (list) id to add the contact to")
                .required(),
            NodeProperty::new("email", "Email", NodePropertyType::String)
                .placeholder("user@example.com")
                .show_when("operation", &["addContact"])
                .required(),
            NodeProperty::new("name", "Name", NodePropertyType::String)
                .show_when("operation", &["addContact"]),
            NodeProperty::new("customFields", "Custom Fields", NodePropertyType::Json)
                .show_when("operation", &["addContact"])
                .description("JSON array of {\"customFieldId\":\"...\",\"value\":[\"...\"]} entries"),
            // contactId for get/update/delete
            NodeProperty::new("contactId", "Contact ID", NodePropertyType::String)
                .show_when("operation", &["getContact", "updateContact", "deleteContact"])
                .required(),
            // updateContact
            NodeProperty::new("fields", "Fields", NodePropertyType::Json)
                .show_when("operation", &["updateContact"])
                .description("JSON object of fields to update, e.g. {\"name\":\"Jane\"}"),
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
            "addContact" => {
                let campaign_id = ctx.param_str(params, "campaignId")?;
                let email = ctx.param_str(params, "email")?;
                let mut payload = Map::new();
                payload.insert("email".into(), json!(email));
                payload.insert("campaign".into(), json!({ "campaignId": campaign_id }));
                if let Some(name) = ctx.param_str_opt(params, "name") {
                    if !name.is_empty() {
                        payload.insert("name".into(), json!(name));
                    }
                }
                if let Some(custom) = parse_json_param(ctx, params, "customFields") {
                    payload.insert("customFieldValues".into(), custom);
                }
                send_request(
                    ctx,
                    &api_key,
                    Method::Post,
                    "/contacts",
                    Some(Value::Object(payload)),
                )
                .await?
            }
            "getContact" => {
                let contact_id = ctx.param_str(params, "contactId")?;
                let path = format!("/contacts/{contact_id}");
                send_request(ctx, &api_key, Method::Get, &path, None).await?
            }
            "listContacts" => {
                send_request(ctx, &api_key, Method::Get, "/contacts", None).await?
            }
            "updateContact" => {
                let contact_id = ctx.param_str(params, "contactId")?;
                let payload = parse_json_param(ctx, params, "fields").unwrap_or(Value::Object(Map::new()));
                let path = format!("/contacts/{contact_id}");
                send_request(ctx, &api_key, Method::Post, &path, Some(payload)).await?
            }
            "deleteContact" => {
                let contact_id = ctx.param_str(params, "contactId")?;
                let path = format!("/contacts/{contact_id}");
                send_request(ctx, &api_key, Method::Delete, &path, None).await?
            }
            "listCampaigns" => {
                send_request(ctx, &api_key, Method::Get, "/campaigns", None).await?
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
    Delete,
}

async fn send_request(
    ctx: &ExecutionContext,
    api_key: &str,
    method: Method,
    path: &str,
    payload: Option<Value>,
) -> NodeResult<Value> {
    let url = format!("{GETRESPONSE_API_BASE}{path}");
    let mut req = match method {
        Method::Get => ctx.http.get(&url),
        Method::Post => ctx.http.post(&url),
        Method::Delete => ctx.http.delete(&url),
    };
    req = req
        .header("X-Auth-Token", format!("api-key {api_key}"))
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
