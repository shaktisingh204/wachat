//! WooCommerce node.
//!
//! Implements product, order, customer and coupon CRUD against the
//! WooCommerce REST API v3 (`{baseUrl}/wp-json/wc/v3`). Authenticates via
//! HTTP Basic auth using the consumer key/secret from the `wooCommerceApi`
//! credential.

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

pub struct WooCommerceNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for WooCommerceNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "wooCommerce",
            "WooCommerce",
            "Manage WooCommerce products, orders, customers and coupons",
            NodeCategory::Finance,
        )
        .icon("shopping-cart")
        .color("#7F54B3")
        .credentials(vec![CredentialBinding {
            name: "wooCommerceApi".into(),
            display_name: "WooCommerce API".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![
                    opt("Product", "product"),
                    opt("Order", "order"),
                    opt("Customer", "customer"),
                    opt("Coupon", "coupon"),
                ])
                .default(json!("product"))
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Create", "create"),
                    opt("Get", "get"),
                    opt("Update", "update"),
                    opt("Delete", "delete"),
                    opt("List", "list"),
                ])
                .default(json!("list"))
                .required(),
            NodeProperty::new("objectId", "ID", NodePropertyType::String)
                .placeholder("123")
                .show_when("operation", &["get", "update", "delete"])
                .required(),
            NodeProperty::new("body", "Body (JSON)", NodePropertyType::Json)
                .placeholder("{ \"name\": \"My Product\", \"regular_price\": \"9.99\" }")
                .show_when("operation", &["create", "update"])
                .description("Request payload as a JSON object"),
            NodeProperty::new("limit", "Per Page", NodePropertyType::Number)
                .default(json!(20))
                .show_when("operation", &["list"]),
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
        let base_url = cred
            .data
            .get("baseUrl")
            .ok_or_else(|| NodeError::MissingParameter("baseUrl".into()))?
            .trim_end_matches('/')
            .to_string();
        let consumer_key = cred
            .data
            .get("consumerKey")
            .ok_or_else(|| NodeError::MissingParameter("consumerKey".into()))?
            .clone();
        let consumer_secret = cred
            .data
            .get("consumerSecret")
            .ok_or_else(|| NodeError::MissingParameter("consumerSecret".into()))?
            .clone();

        let resource = ctx
            .param_str_opt(params, "resource")
            .unwrap_or_else(|| "product".to_string());
        let operation = ctx.param_str(params, "operation")?;

        let collection = resource_collection(&resource).ok_or_else(|| {
            NodeError::InvalidParameter {
                name: "resource".into(),
                reason: format!("unknown resource: {resource}"),
            }
        })?;

        let api_base = format!("{base_url}/wp-json/wc/v3");

        let body: Value = match operation.as_str() {
            "create" => {
                let payload = parse_json_param(ctx, params, "body")
                    .unwrap_or_else(|| Value::Object(Map::new()));
                let url = format!("{api_base}/{collection}");
                send_json(ctx, &consumer_key, &consumer_secret, reqwest::Method::POST, &url, Some(payload)).await?
            }
            "get" => {
                let raw_id = ctx.param_str(params, "objectId")?;
                let id = ctx.substitute(&raw_id);
                let url = format!("{api_base}/{collection}/{id}");
                send_json(ctx, &consumer_key, &consumer_secret, reqwest::Method::GET, &url, None).await?
            }
            "update" => {
                let raw_id = ctx.param_str(params, "objectId")?;
                let id = ctx.substitute(&raw_id);
                let payload = parse_json_param(ctx, params, "body")
                    .unwrap_or_else(|| Value::Object(Map::new()));
                let url = format!("{api_base}/{collection}/{id}");
                send_json(ctx, &consumer_key, &consumer_secret, reqwest::Method::PUT, &url, Some(payload)).await?
            }
            "delete" => {
                let raw_id = ctx.param_str(params, "objectId")?;
                let id = ctx.substitute(&raw_id);
                let url = format!("{api_base}/{collection}/{id}?force=true");
                send_json(ctx, &consumer_key, &consumer_secret, reqwest::Method::DELETE, &url, None).await?
            }
            "list" => {
                let limit = ctx
                    .param_f64(params, "limit")
                    .map(|n| n.trunc() as i64)
                    .unwrap_or(20);
                let url = format!("{api_base}/{collection}?per_page={limit}");
                send_json(ctx, &consumer_key, &consumer_secret, reqwest::Method::GET, &url, None).await?
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

fn resource_collection(resource: &str) -> Option<&'static str> {
    match resource {
        "product" => Some("products"),
        "order" => Some("orders"),
        "customer" => Some("customers"),
        "coupon" => Some("coupons"),
        _ => None,
    }
}

async fn send_json(
    ctx: &ExecutionContext,
    consumer_key: &str,
    consumer_secret: &str,
    method: reqwest::Method,
    url: &str,
    payload: Option<Value>,
) -> NodeResult<Value> {
    let mut req = ctx
        .http
        .request(method, url)
        .basic_auth(consumer_key, Some(consumer_secret));
    if let Some(p) = payload {
        req = req
            .header(reqwest::header::CONTENT_TYPE, "application/json")
            .json(&p);
    }
    let res = req.send().await?;
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
/// value (array/object) or a string holding JSON. Returns `None` if absent
/// or empty.
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

/// Recursively run `ctx.substitute` over all string leaves of a JSON value.
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
