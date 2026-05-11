//! Magento node.
//!
//! Implements product, order, customer and invoice operations against the
//! Magento 2 REST API (`{baseUrl}/rest/V1`). Authenticates with a Bearer
//! access token supplied via the `magentoApi` credential.

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

pub struct MagentoNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for MagentoNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "magento",
            "Magento",
            "Manage Magento products, orders, customers and invoices",
            NodeCategory::Finance,
        )
        .icon("shopping-cart")
        .color("#EE672F")
        .credentials(vec![CredentialBinding {
            name: "magentoApi".into(),
            display_name: "Magento API".into(),
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
                    opt("Invoice", "invoice"),
                ])
                .default(json!("product"))
                .required(),
            // ----- per-resource operations -----
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Create", "create"),
                    opt("Get", "get"),
                    opt("Update", "update"),
                    opt("Delete", "delete"),
                    opt("List", "list"),
                ])
                .default(json!("list"))
                .show_when("resource", &["product"])
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Get", "get"),
                    opt("List", "list"),
                    opt("Cancel", "cancel"),
                ])
                .default(json!("list"))
                .show_when("resource", &["order"])
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Create", "create"),
                    opt("Get", "get"),
                    opt("Update", "update"),
                    opt("List", "list"),
                ])
                .default(json!("list"))
                .show_when("resource", &["customer"])
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![opt("Get", "get"), opt("List", "list")])
                .default(json!("list"))
                .show_when("resource", &["invoice"])
                .required(),
            // ----- identifiers -----
            NodeProperty::new("sku", "SKU", NodePropertyType::String)
                .placeholder("SKU-001")
                .show_when("resource", &["product"])
                .show_when("operation", &["get", "update", "delete"])
                .required(),
            NodeProperty::new("objectId", "ID", NodePropertyType::String)
                .placeholder("123")
                .show_when("resource", &["order", "customer", "invoice"])
                .show_when("operation", &["get", "update", "cancel"])
                .required(),
            // ----- payload -----
            NodeProperty::new("body", "Body (JSON)", NodePropertyType::Json)
                .placeholder("{ \"product\": { \"sku\": \"SKU-001\", \"name\": \"My Product\" } }")
                .show_when("operation", &["create", "update"])
                .description("Request payload as a JSON object"),
            // ----- list pagination -----
            NodeProperty::new("limit", "Page Size", NodePropertyType::Number)
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
        let token = cred
            .data
            .get("accessToken")
            .ok_or_else(|| NodeError::MissingParameter("accessToken".into()))?
            .clone();

        let resource = ctx
            .param_str_opt(params, "resource")
            .unwrap_or_else(|| "product".to_string());
        let operation = ctx.param_str(params, "operation")?;

        let api_base = format!("{base_url}/rest/V1");

        let body: Value = match (resource.as_str(), operation.as_str()) {
            // ----- product -----
            ("product", "create") => {
                let payload = parse_json_param(ctx, params, "body")
                    .unwrap_or_else(|| Value::Object(Map::new()));
                let url = format!("{api_base}/products");
                send_json(ctx, &token, reqwest::Method::POST, &url, Some(payload)).await?
            }
            ("product", "get") => {
                let raw_sku = ctx.param_str(params, "sku")?;
                let sku = ctx.substitute(&raw_sku);
                let encoded = urlencode(&sku);
                let url = format!("{api_base}/products/{encoded}");
                send_json(ctx, &token, reqwest::Method::GET, &url, None).await?
            }
            ("product", "update") => {
                let raw_sku = ctx.param_str(params, "sku")?;
                let sku = ctx.substitute(&raw_sku);
                let encoded = urlencode(&sku);
                let payload = parse_json_param(ctx, params, "body")
                    .unwrap_or_else(|| Value::Object(Map::new()));
                let url = format!("{api_base}/products/{encoded}");
                send_json(ctx, &token, reqwest::Method::PUT, &url, Some(payload)).await?
            }
            ("product", "delete") => {
                let raw_sku = ctx.param_str(params, "sku")?;
                let sku = ctx.substitute(&raw_sku);
                let encoded = urlencode(&sku);
                let url = format!("{api_base}/products/{encoded}");
                send_json(ctx, &token, reqwest::Method::DELETE, &url, None).await?
            }
            ("product", "list") => {
                let limit = list_limit(ctx, params);
                let url = format!("{api_base}/products?searchCriteria[pageSize]={limit}");
                send_json(ctx, &token, reqwest::Method::GET, &url, None).await?
            }

            // ----- order -----
            ("order", "get") => {
                let id = substitute_id(ctx, params)?;
                let url = format!("{api_base}/orders/{id}");
                send_json(ctx, &token, reqwest::Method::GET, &url, None).await?
            }
            ("order", "list") => {
                let limit = list_limit(ctx, params);
                let url = format!("{api_base}/orders?searchCriteria[pageSize]={limit}");
                send_json(ctx, &token, reqwest::Method::GET, &url, None).await?
            }
            ("order", "cancel") => {
                let id = substitute_id(ctx, params)?;
                let url = format!("{api_base}/orders/{id}/cancel");
                send_json(ctx, &token, reqwest::Method::POST, &url, None).await?
            }

            // ----- customer -----
            ("customer", "create") => {
                let payload = parse_json_param(ctx, params, "body")
                    .unwrap_or_else(|| Value::Object(Map::new()));
                let url = format!("{api_base}/customers");
                send_json(ctx, &token, reqwest::Method::POST, &url, Some(payload)).await?
            }
            ("customer", "get") => {
                let id = substitute_id(ctx, params)?;
                let url = format!("{api_base}/customers/{id}");
                send_json(ctx, &token, reqwest::Method::GET, &url, None).await?
            }
            ("customer", "update") => {
                let id = substitute_id(ctx, params)?;
                let payload = parse_json_param(ctx, params, "body")
                    .unwrap_or_else(|| Value::Object(Map::new()));
                let url = format!("{api_base}/customers/{id}");
                send_json(ctx, &token, reqwest::Method::PUT, &url, Some(payload)).await?
            }
            ("customer", "list") => {
                let limit = list_limit(ctx, params);
                let url = format!("{api_base}/customers/search?searchCriteria[pageSize]={limit}");
                send_json(ctx, &token, reqwest::Method::GET, &url, None).await?
            }

            // ----- invoice -----
            ("invoice", "get") => {
                let id = substitute_id(ctx, params)?;
                let url = format!("{api_base}/invoices/{id}");
                send_json(ctx, &token, reqwest::Method::GET, &url, None).await?
            }
            ("invoice", "list") => {
                let limit = list_limit(ctx, params);
                let url = format!("{api_base}/invoices?searchCriteria[pageSize]={limit}");
                send_json(ctx, &token, reqwest::Method::GET, &url, None).await?
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

fn substitute_id(ctx: &ExecutionContext, params: &Value) -> NodeResult<String> {
    let raw = ctx.param_str(params, "objectId")?;
    Ok(ctx.substitute(&raw))
}

fn list_limit(ctx: &ExecutionContext, params: &Value) -> i64 {
    ctx.param_f64(params, "limit")
        .map(|n| n.trunc() as i64)
        .unwrap_or(20)
}

/// Minimal percent-encoder for path segments — encodes characters outside the
/// unreserved set so that values like SKUs with slashes or spaces are safe to
/// drop into a URL path.
fn urlencode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.as_bytes() {
        let c = *b;
        let safe = c.is_ascii_alphanumeric() || matches!(c, b'-' | b'_' | b'.' | b'~');
        if safe {
            out.push(c as char);
        } else {
            out.push_str(&format!("%{:02X}", c));
        }
    }
    out
}

async fn send_json(
    ctx: &ExecutionContext,
    token: &str,
    method: reqwest::Method,
    url: &str,
    payload: Option<Value>,
) -> NodeResult<Value> {
    let mut req = ctx.http.request(method, url).bearer_auth(token);
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
