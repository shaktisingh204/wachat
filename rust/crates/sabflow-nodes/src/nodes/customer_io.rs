//! Customer.io node.
//!
//! Implements identify, track, delete, and transactional-email operations
//! against the Customer.io APIs.
//!
//! Authentication & hosts:
//! - Tracking API (`identifyCustomer`, `track`, `deleteCustomer`):
//!   `https://track-{region}.customer.io/api/v1` with HTTP Basic auth
//!   (`siteId:apiKey`). `region` is `us` or `eu`.
//! - App API (`sendTransactional`): `https://api.customer.io/v1` (US) or
//!   `https://api-eu.customer.io/v1` (EU) with Bearer auth using `apiKey`.

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

pub struct CustomerIoNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for CustomerIoNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "customerIo",
            "Customer.io",
            "Identify customers, track events, and send transactional email via Customer.io",
            NodeCategory::Marketing,
        )
        .icon("send")
        .color("#7C3AED")
        .credentials(vec![CredentialBinding {
            name: "customerIoApi".into(),
            display_name: "Customer.io API".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Identify Customer", "identifyCustomer"),
                    opt("Track Event", "track"),
                    opt("Delete Customer", "deleteCustomer"),
                    opt("Send Transactional Email", "sendTransactional"),
                ])
                .default(json!("identifyCustomer"))
                .required(),
            // shared customer id (identify / track / delete)
            NodeProperty::new("customerId", "Customer ID", NodePropertyType::String)
                .placeholder("user_123")
                .show_when(
                    "operation",
                    &["identifyCustomer", "track", "deleteCustomer"],
                )
                .required(),
            // identify attributes
            NodeProperty::new("attributes", "Attributes", NodePropertyType::Json)
                .show_when("operation", &["identifyCustomer"])
                .description(
                    "JSON object of customer attributes, e.g. {\"email\":\"a@b.com\",\"plan\":\"pro\"}",
                ),
            // track event fields
            NodeProperty::new("eventName", "Event Name", NodePropertyType::String)
                .placeholder("purchase")
                .show_when("operation", &["track"])
                .required(),
            NodeProperty::new("data", "Event Data", NodePropertyType::Json)
                .show_when("operation", &["track"])
                .description("JSON object of event properties"),
            // transactional email fields
            NodeProperty::new(
                "transactionalMessageId",
                "Transactional Message ID",
                NodePropertyType::String,
            )
            .show_when("operation", &["sendTransactional"])
            .required(),
            NodeProperty::new("to", "To", NodePropertyType::String)
                .placeholder("user@example.com")
                .show_when("operation", &["sendTransactional"])
                .required(),
            NodeProperty::new("identifiers", "Identifiers", NodePropertyType::Json)
                .show_when("operation", &["sendTransactional"])
                .description(
                    "JSON object identifying the recipient, e.g. {\"id\":\"user_123\"} or {\"email\":\"a@b.com\"}",
                ),
            NodeProperty::new("messageData", "Message Data", NodePropertyType::Json)
                .show_when("operation", &["sendTransactional"])
                .description("JSON object of variables interpolated into the template"),
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
        let site_id = cred
            .data
            .get("siteId")
            .ok_or_else(|| NodeError::MissingParameter("siteId".into()))?
            .clone();
        let api_key = cred
            .data
            .get("apiKey")
            .ok_or_else(|| NodeError::MissingParameter("apiKey".into()))?
            .clone();
        let region = cred
            .data
            .get("trackingRegion")
            .map(|s| s.as_str())
            .unwrap_or("us")
            .to_lowercase();
        if region != "us" && region != "eu" {
            return Err(NodeError::InvalidParameter {
                name: "trackingRegion".into(),
                reason: format!("expected 'us' or 'eu', got '{region}'"),
            });
        }
        let tracking_base = format!("https://track-{region}.customer.io/api/v1");
        let app_base = if region == "eu" {
            "https://api-eu.customer.io/v1".to_string()
        } else {
            "https://api.customer.io/v1".to_string()
        };

        let operation = ctx.param_str(params, "operation")?;

        let body: Value = match operation.as_str() {
            "identifyCustomer" => {
                let customer_id = ctx.param_str(params, "customerId")?;
                let payload = parse_json_param(ctx, params, "attributes")
                    .unwrap_or_else(|| Value::Object(Map::new()));
                let url = format!("{tracking_base}/customers/{customer_id}");
                tracking_request(ctx, &site_id, &api_key, Method::Put, &url, Some(payload)).await?
            }
            "track" => {
                let customer_id = ctx.param_str(params, "customerId")?;
                let event_name = ctx.param_str(params, "eventName")?;
                let data = parse_json_param(ctx, params, "data")
                    .unwrap_or_else(|| Value::Object(Map::new()));
                let payload = json!({ "name": event_name, "data": data });
                let url = format!("{tracking_base}/customers/{customer_id}/events");
                tracking_request(ctx, &site_id, &api_key, Method::Post, &url, Some(payload))
                    .await?
            }
            "deleteCustomer" => {
                let customer_id = ctx.param_str(params, "customerId")?;
                let url = format!("{tracking_base}/customers/{customer_id}");
                tracking_request(ctx, &site_id, &api_key, Method::Delete, &url, None).await?
            }
            "sendTransactional" => {
                let transactional_message_id =
                    ctx.param_str(params, "transactionalMessageId")?;
                let to = ctx.param_str(params, "to")?;
                let identifiers = parse_json_param(ctx, params, "identifiers")
                    .unwrap_or_else(|| Value::Object(Map::new()));
                let mut payload = Map::new();
                // Try parsing the transactional id as a number first — Customer.io
                // accepts either numeric or string ids; preserve whichever the
                // user provided.
                let id_value: Value = transactional_message_id
                    .parse::<i64>()
                    .map(Value::from)
                    .unwrap_or_else(|_| Value::String(transactional_message_id.clone()));
                payload.insert("transactional_message_id".into(), id_value);
                payload.insert("to".into(), Value::String(to));
                payload.insert("identifiers".into(), identifiers);
                if let Some(md) = parse_json_param(ctx, params, "messageData") {
                    payload.insert("message_data".into(), md);
                }
                let url = format!("{app_base}/send/email");
                app_request(ctx, &api_key, Method::Post, &url, Some(Value::Object(payload)))
                    .await?
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
    Post,
    Put,
    Delete,
}

async fn tracking_request(
    ctx: &ExecutionContext,
    site_id: &str,
    api_key: &str,
    method: Method,
    url: &str,
    payload: Option<Value>,
) -> NodeResult<Value> {
    let mut req = match method {
        Method::Post => ctx.http.post(url),
        Method::Put => ctx.http.put(url),
        Method::Delete => ctx.http.delete(url),
    };
    req = req
        .basic_auth(site_id, Some(api_key))
        .header("Content-Type", "application/json");
    if let Some(body) = payload {
        req = req.json(&body);
    }
    finish_request(req).await
}

async fn app_request(
    ctx: &ExecutionContext,
    api_key: &str,
    method: Method,
    url: &str,
    payload: Option<Value>,
) -> NodeResult<Value> {
    let mut req = match method {
        Method::Post => ctx.http.post(url),
        Method::Put => ctx.http.put(url),
        Method::Delete => ctx.http.delete(url),
    };
    req = req
        .bearer_auth(api_key)
        .header("Content-Type", "application/json");
    if let Some(body) = payload {
        req = req.json(&body);
    }
    finish_request(req).await
}

async fn finish_request(req: reqwest::RequestBuilder) -> NodeResult<Value> {
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
