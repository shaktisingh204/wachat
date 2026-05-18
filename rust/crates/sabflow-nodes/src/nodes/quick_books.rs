//! QuickBooks Online node.
//!
//! Implements customer, invoice and item operations against the QuickBooks
//! Online Accounting API v3
//! (https://quickbooks.api.intuit.com/v3/company/{realmId}). Authenticates with
//! an OAuth2 access token (Bearer) supplied via the `quickBooksOAuth2Api`
//! credential (`accessToken`, `realmId`, optional `sandbox` flag).

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

pub struct QuickBooksNode;

const QB_API_PROD: &str = "https://quickbooks.api.intuit.com";
const QB_API_SANDBOX: &str = "https://sandbox-quickbooks.api.intuit.com";

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for QuickBooksNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "quickBooks",
            "QuickBooks",
            "QuickBooks Online accounting — manage customers, invoices and items",
            NodeCategory::Finance,
        )
        .icon("calculator")
        .color("#2CA01C")
        .credentials(vec![CredentialBinding {
            name: "quickBooksOAuth2Api".into(),
            display_name: "QuickBooks OAuth2".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("realmIdOverride", "Realm ID Override", NodePropertyType::String)
                .description("Optional realm/company id to override the credential value"),
            NodeProperty::new("environment", "Environment", NodePropertyType::Options)
                .options(vec![opt("Production", "production"), opt("Sandbox", "sandbox")])
                .default(json!("production")),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![
                    opt("Customer", "customer"),
                    opt("Invoice", "invoice"),
                    opt("Item", "item"),
                    opt("Payment", "payment"),
                    opt("Company Info", "companyInfo"),
                ])
                .default(json!("customer"))
                .required(),
            // ---- common operations
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Get", "get"),
                    opt("Query", "query"),
                    opt("Create", "create"),
                    opt("Update", "update"),
                ])
                .default(json!("query"))
                .show_when("resource", &["customer", "invoice", "item", "payment"])
                .required(),
            // ---- company info
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![opt("Get", "get")])
                .default(json!("get"))
                .show_when("resource", &["companyInfo"])
                .required(),
            // ---- shared id
            NodeProperty::new("id", "ID", NodePropertyType::String)
                .show_when("operation", &["get", "update"])
                .required(),
            // ---- query
            NodeProperty::new("query", "Query", NodePropertyType::String)
                .placeholder("SELECT * FROM Customer WHERE Active = true MAXRESULTS 25")
                .show_when("operation", &["query"])
                .required()
                .description("QuickBooks SQL-like query (will be URL-encoded)."),
            // ---- create / update payload
            NodeProperty::new("data", "Data (JSON)", NodePropertyType::Json)
                .show_when("operation", &["create", "update"])
                .description(
                    "Resource payload — for `update`, include `Id` and `SyncToken`.",
                ),
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

        let realm_id = ctx
            .param_str_opt(params, "realmIdOverride")
            .filter(|s| !s.trim().is_empty())
            .or_else(|| cred.data.get("realmId").cloned())
            .ok_or_else(|| NodeError::MissingParameter("realmId".into()))?;

        let env = ctx
            .param_str_opt(params, "environment")
            .unwrap_or_else(|| "production".to_string());
        let api_base = if env == "sandbox" { QB_API_SANDBOX } else { QB_API_PROD };
        let base = format!("{api_base}/v3/company/{realm_id}");

        let resource = ctx
            .param_str_opt(params, "resource")
            .unwrap_or_else(|| "customer".to_string());
        let operation = ctx.param_str(params, "operation")?;

        let entity = match resource.as_str() {
            "customer" => "customer",
            "invoice" => "invoice",
            "item" => "item",
            "payment" => "payment",
            "companyInfo" => "companyinfo",
            other => {
                return Err(NodeError::InvalidParameter {
                    name: "resource".into(),
                    reason: format!("unknown resource: {other}"),
                });
            }
        };

        let body: Value = match (resource.as_str(), operation.as_str()) {
            ("companyInfo", "get") => {
                let path = format!("/companyinfo/{realm_id}");
                get_json(ctx, &base, &token, &path, &[]).await?
            }
            (_, "get") => {
                let id = ctx.param_str(params, "id")?;
                let path = format!("/{entity}/{id}");
                get_json(ctx, &base, &token, &path, &[]).await?
            }
            (_, "query") => {
                let q = ctx.param_str(params, "query")?;
                get_json(ctx, &base, &token, "/query", &[("query".into(), q)]).await?
            }
            (_, "create") => {
                let payload = parse_json_param(ctx, params, "data")
                    .unwrap_or_else(|| Value::Object(Map::new()));
                let path = format!("/{entity}");
                post_json(ctx, &base, &token, &path, payload).await?
            }
            (_, "update") => {
                // QuickBooks updates POST to the same entity endpoint; the body
                // must include `Id` and `SyncToken`.
                let payload = parse_json_param(ctx, params, "data")
                    .unwrap_or_else(|| Value::Object(Map::new()));
                let path = format!("/{entity}");
                post_json(ctx, &base, &token, &path, payload).await?
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

async fn get_json(
    ctx: &ExecutionContext,
    base: &str,
    token: &str,
    path: &str,
    query: &[(String, String)],
) -> NodeResult<Value> {
    let url = format!("{base}{path}");
    let mut req = ctx
        .http
        .get(&url)
        .bearer_auth(token)
        .header(reqwest::header::ACCEPT, "application/json");
    if !query.is_empty() {
        req = req.query(query);
    }
    finalize_response(req.send().await?).await
}

async fn post_json(
    ctx: &ExecutionContext,
    base: &str,
    token: &str,
    path: &str,
    payload: Value,
) -> NodeResult<Value> {
    let url = format!("{base}{path}");
    let res = ctx
        .http
        .post(&url)
        .bearer_auth(token)
        .header(reqwest::header::ACCEPT, "application/json")
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .json(&payload)
        .send()
        .await?;
    finalize_response(res).await
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
