//! Metabase node.
//!
//! Implements read operations against a Metabase instance's REST API at
//! `{baseUrl}/api`. Authenticates via the `metabaseApi` credential, which
//! supplies a `baseUrl` and either a `sessionToken` (sent as the
//! `X-Metabase-Session` header) or an `apiKey` (sent as the `X-API-KEY`
//! header). Supports `question` (Metabase "card"), `dashboard`, `database`
//! and `collection` resources.

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

pub struct MetabaseNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for MetabaseNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "metabase",
            "Metabase",
            "Query Metabase questions, dashboards, databases and collections",
            NodeCategory::Analytics,
        )
        .icon("bar-chart-3")
        .color("#509EE3")
        .credentials(vec![CredentialBinding {
            name: "metabaseApi".into(),
            display_name: "Metabase API".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![
                    opt("Question", "question"),
                    opt("Dashboard", "dashboard"),
                    opt("Database", "database"),
                    opt("Collection", "collection"),
                ])
                .default(json!("question"))
                .required(),
            // Question operations
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("List", "list"),
                    opt("Get", "get"),
                    opt("Query", "query"),
                ])
                .default(json!("list"))
                .show_when("resource", &["question"])
                .required(),
            // Dashboard operations
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("List", "list"),
                    opt("Get", "get"),
                    opt("Create", "create"),
                ])
                .default(json!("list"))
                .show_when("resource", &["dashboard"])
                .required(),
            // Database operations
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![opt("List", "list"), opt("Get", "get")])
                .default(json!("list"))
                .show_when("resource", &["database"])
                .required(),
            // Collection operations
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("List", "list"),
                    opt("Get", "get"),
                    opt("Get Items", "getItems"),
                ])
                .default(json!("list"))
                .show_when("resource", &["collection"])
                .required(),
            // Object ID — required for any per-object operation
            NodeProperty::new("objectId", "Object ID", NodePropertyType::String)
                .placeholder("123")
                .show_when("operation", &["get", "query", "getItems"])
                .required(),
            // Create-dashboard fields
            NodeProperty::new("name", "Name", NodePropertyType::String)
                .placeholder("Sales overview")
                .show_when("operation", &["create"])
                .required(),
            NodeProperty::new("description", "Description", NodePropertyType::String)
                .placeholder("Top-line KPIs refreshed daily")
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
        let base_url = cred
            .data
            .get("baseUrl")
            .ok_or_else(|| NodeError::MissingParameter("baseUrl".into()))?
            .trim_end_matches('/')
            .to_string();

        let session_token = cred
            .data
            .get("sessionToken")
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());
        let api_key = cred
            .data
            .get("apiKey")
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());

        if session_token.is_none() && api_key.is_none() {
            return Err(NodeError::AuthError(
                "metabaseApi credential must supply either sessionToken or apiKey".into(),
            ));
        }

        let auth = AuthHeader {
            session_token,
            api_key,
        };

        let api_base = format!("{base_url}/api");
        let resource = ctx
            .param_str_opt(params, "resource")
            .unwrap_or_else(|| "question".to_string());
        let operation = ctx.param_str(params, "operation")?;

        let body: Value = match (resource.as_str(), operation.as_str()) {
            // Questions (Metabase "cards")
            ("question", "list") => get_json(ctx, &auth, &format!("{api_base}/card")).await?,
            ("question", "get") => {
                let id = require_id(ctx, params)?;
                get_json(ctx, &auth, &format!("{api_base}/card/{id}")).await?
            }
            ("question", "query") => {
                let id = require_id(ctx, params)?;
                post_json(
                    ctx,
                    &auth,
                    &format!("{api_base}/card/{id}/query/json"),
                    Value::Object(Map::new()),
                )
                .await?
            }

            // Dashboards
            ("dashboard", "list") => get_json(ctx, &auth, &format!("{api_base}/dashboard")).await?,
            ("dashboard", "get") => {
                let id = require_id(ctx, params)?;
                get_json(ctx, &auth, &format!("{api_base}/dashboard/{id}")).await?
            }
            ("dashboard", "create") => {
                let name_raw = ctx.param_str(params, "name")?;
                let name = ctx.substitute(&name_raw);
                let mut payload = Map::new();
                payload.insert("name".into(), Value::String(name));
                if let Some(desc) = ctx.param_str_opt(params, "description") {
                    let desc = ctx.substitute(&desc);
                    if !desc.is_empty() {
                        payload.insert("description".into(), Value::String(desc));
                    }
                }
                post_json(
                    ctx,
                    &auth,
                    &format!("{api_base}/dashboard"),
                    Value::Object(payload),
                )
                .await?
            }

            // Databases
            ("database", "list") => get_json(ctx, &auth, &format!("{api_base}/database")).await?,
            ("database", "get") => {
                let id = require_id(ctx, params)?;
                get_json(ctx, &auth, &format!("{api_base}/database/{id}")).await?
            }

            // Collections
            ("collection", "list") => {
                get_json(ctx, &auth, &format!("{api_base}/collection")).await?
            }
            ("collection", "get") => {
                let id = require_id(ctx, params)?;
                get_json(ctx, &auth, &format!("{api_base}/collection/{id}")).await?
            }
            ("collection", "getItems") => {
                let id = require_id(ctx, params)?;
                get_json(ctx, &auth, &format!("{api_base}/collection/{id}/items")).await?
            }

            (res, op) => {
                return Err(NodeError::InvalidParameter {
                    name: "operation".into(),
                    reason: format!("unsupported resource/operation: {res}/{op}"),
                });
            }
        };

        Ok(NodeOutput::single(vec![body]))
    }
}

struct AuthHeader {
    session_token: Option<String>,
    api_key: Option<String>,
}

fn apply_auth(mut req: reqwest::RequestBuilder, auth: &AuthHeader) -> reqwest::RequestBuilder {
    if let Some(token) = &auth.session_token {
        req = req.header("X-Metabase-Session", token);
    } else if let Some(key) = &auth.api_key {
        req = req.header("X-API-KEY", key);
    }
    req
}

fn require_id(ctx: &ExecutionContext, params: &Value) -> NodeResult<String> {
    let raw = ctx.param_str(params, "objectId")?;
    let substituted = ctx.substitute(&raw);
    let trimmed = substituted.trim();
    if trimmed.is_empty() {
        return Err(NodeError::MissingParameter("objectId".into()));
    }
    Ok(trimmed.to_string())
}

async fn get_json(ctx: &ExecutionContext, auth: &AuthHeader, url: &str) -> NodeResult<Value> {
    let req = apply_auth(ctx.http.get(url), auth);
    let res = req.send().await?;
    finalize_response(res).await
}

async fn post_json(
    ctx: &ExecutionContext,
    auth: &AuthHeader,
    url: &str,
    payload: Value,
) -> NodeResult<Value> {
    let req = apply_auth(
        ctx.http
            .post(url)
            .header(reqwest::header::CONTENT_TYPE, "application/json")
            .json(&payload),
        auth,
    );
    let res = req.send().await?;
    finalize_response(res).await
}

async fn finalize_response(res: reqwest::Response) -> NodeResult<Value> {
    let status = res.status();
    let text = res.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: text,
        });
    }
    if text.is_empty() {
        return Ok(Value::Null);
    }
    match serde_json::from_str::<Value>(&text) {
        Ok(v) => Ok(v),
        Err(_) => Ok(Value::String(text)),
    }
}
