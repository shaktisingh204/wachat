//! Xero node.
//!
//! Implements contact, invoice and account operations against the Xero
//! Accounting API (https://api.xero.com/api.xro/2.0). Authenticates with an
//! OAuth2 access token (Bearer) and a `Xero-tenant-id` header, both supplied
//! via the `xeroOAuth2Api` credential (`accessToken`, `tenantId`).

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

pub struct XeroNode;

const XERO_API_BASE: &str = "https://api.xero.com/api.xro/2.0";

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for XeroNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "xero",
            "Xero",
            "Xero accounting — manage contacts, invoices and accounts",
            NodeCategory::Finance,
        )
        .icon("calculator")
        .color("#13B5EA")
        .credentials(vec![CredentialBinding {
            name: "xeroOAuth2Api".into(),
            display_name: "Xero OAuth2".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("tenantIdOverride", "Tenant ID Override", NodePropertyType::String)
                .description(
                    "Optional tenant id to override the value stored on the credential",
                ),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![
                    opt("Contact", "contact"),
                    opt("Invoice", "invoice"),
                    opt("Account", "account"),
                    opt("Organisation", "organisation"),
                ])
                .default(json!("invoice"))
                .required(),
            // ---- contact operations
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("List", "list"),
                    opt("Get", "get"),
                    opt("Create", "create"),
                    opt("Update", "update"),
                ])
                .default(json!("list"))
                .show_when("resource", &["contact"])
                .required(),
            // ---- invoice operations
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("List", "list"),
                    opt("Get", "get"),
                    opt("Create", "create"),
                    opt("Update", "update"),
                    opt("Email", "email"),
                ])
                .default(json!("list"))
                .show_when("resource", &["invoice"])
                .required(),
            // ---- account operations
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![opt("List", "list"), opt("Get", "get")])
                .default(json!("list"))
                .show_when("resource", &["account"])
                .required(),
            // ---- organisation operations
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![opt("Get", "get")])
                .default(json!("get"))
                .show_when("resource", &["organisation"])
                .required(),
            // ---- shared id
            NodeProperty::new("id", "ID (UUID)", NodePropertyType::String)
                .placeholder("00000000-0000-0000-0000-000000000000")
                .show_when("operation", &["get", "update", "email"])
                .required(),
            // ---- list filter
            NodeProperty::new("where", "Where Filter", NodePropertyType::String)
                .placeholder("Status==\"AUTHORISED\"")
                .show_when("operation", &["list"])
                .description("Xero query language `where` clause."),
            // ---- create / update payload
            NodeProperty::new("data", "Data (JSON)", NodePropertyType::Json)
                .show_when("operation", &["create", "update"])
                .description("Resource payload — sent as `{ \"<ResourcePlural>\": [ <data> ] }`."),
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

        let tenant_id = ctx
            .param_str_opt(params, "tenantIdOverride")
            .filter(|s| !s.trim().is_empty())
            .or_else(|| cred.data.get("tenantId").cloned())
            .ok_or_else(|| NodeError::MissingParameter("tenantId".into()))?;

        let resource = ctx
            .param_str_opt(params, "resource")
            .unwrap_or_else(|| "invoice".to_string());
        let operation = ctx.param_str(params, "operation")?;

        // Xero uses TitleCase plurals on its endpoints.
        let (collection, wrapper) = match resource.as_str() {
            "contact" => ("Contacts", "Contacts"),
            "invoice" => ("Invoices", "Invoices"),
            "account" => ("Accounts", "Accounts"),
            "organisation" => ("Organisation", "Organisation"),
            other => {
                return Err(NodeError::InvalidParameter {
                    name: "resource".into(),
                    reason: format!("unknown resource: {other}"),
                });
            }
        };

        let body: Value = match operation.as_str() {
            "list" => {
                let mut query: Vec<(String, String)> = Vec::new();
                if let Some(w) = ctx.param_str_opt(params, "where") {
                    if !w.trim().is_empty() {
                        query.push(("where".into(), w));
                    }
                }
                get_json(ctx, &token, &tenant_id, &format!("/{collection}"), &query).await?
            }
            "get" => {
                let id = ctx.param_str(params, "id")?;
                get_json(
                    ctx,
                    &token,
                    &tenant_id,
                    &format!("/{collection}/{id}"),
                    &[],
                )
                .await?
            }
            "create" => {
                let payload = parse_json_param(ctx, params, "data")
                    .unwrap_or_else(|| Value::Object(Map::new()));
                let mut wrapped = Map::new();
                wrapped.insert(wrapper.to_string(), Value::Array(vec![payload]));
                post_json(
                    ctx,
                    &token,
                    &tenant_id,
                    &format!("/{collection}"),
                    Value::Object(wrapped),
                )
                .await?
            }
            "update" => {
                let id = ctx.param_str(params, "id")?;
                let payload = parse_json_param(ctx, params, "data")
                    .unwrap_or_else(|| Value::Object(Map::new()));
                let mut wrapped = Map::new();
                wrapped.insert(wrapper.to_string(), Value::Array(vec![payload]));
                post_json(
                    ctx,
                    &token,
                    &tenant_id,
                    &format!("/{collection}/{id}"),
                    Value::Object(wrapped),
                )
                .await?
            }
            "email" if resource == "invoice" => {
                let id = ctx.param_str(params, "id")?;
                post_json(
                    ctx,
                    &token,
                    &tenant_id,
                    &format!("/Invoices/{id}/Email"),
                    Value::Object(Map::new()),
                )
                .await?
            }
            other => {
                return Err(NodeError::InvalidParameter {
                    name: "operation".into(),
                    reason: format!("unsupported operation '{other}' for resource '{resource}'"),
                });
            }
        };

        Ok(NodeOutput::single(vec![body]))
    }
}

async fn get_json(
    ctx: &ExecutionContext,
    token: &str,
    tenant_id: &str,
    path: &str,
    query: &[(String, String)],
) -> NodeResult<Value> {
    let url = format!("{XERO_API_BASE}{path}");
    let mut req = ctx
        .http
        .get(&url)
        .bearer_auth(token)
        .header("Xero-tenant-id", tenant_id)
        .header(reqwest::header::ACCEPT, "application/json");
    if !query.is_empty() {
        req = req.query(query);
    }
    finalize_response(req.send().await?).await
}

async fn post_json(
    ctx: &ExecutionContext,
    token: &str,
    tenant_id: &str,
    path: &str,
    payload: Value,
) -> NodeResult<Value> {
    let url = format!("{XERO_API_BASE}{path}");
    let res = ctx
        .http
        .post(&url)
        .bearer_auth(token)
        .header("Xero-tenant-id", tenant_id)
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
