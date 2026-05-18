//! Elasticsearch node — REST-API client for index/document operations.
//!
//! Talks to an Elasticsearch cluster over its public REST API
//! (`{baseUrl}/{index}/_search`, `_doc`, `_update`, `_delete`, `_bulk`) using
//! the workspace `reqwest` client. The credential supplies the cluster base
//! URL plus either Basic Auth (user/pass), an API key (`ApiKey {base64}`), or
//! a Bearer token. No new top-level deps are introduced.
//!
//! Operations implemented:
//!   - `search`     — POST `/{index}/_search` with a JSON query body
//!   - `index`      — POST `/{index}/_doc` (or `PUT /{index}/_doc/{id}` if id is set)
//!   - `get`        — GET   `/{index}/_doc/{id}`
//!   - `update`     — POST `/{index}/_update/{id}` with `{ "doc": {...} }`
//!   - `delete`     — DELETE `/{index}/_doc/{id}`
//!   - `count`      — POST `/{index}/_count` with optional query body
//!
//! Non-2xx responses surface as `UpstreamError` with the cluster's JSON body.

use async_trait::async_trait;
use reqwest::{
    Method,
    header::{HeaderMap, HeaderValue},
};
use serde_json::{Value, json};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{
        CredentialBinding, NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption,
        NodePropertyType,
    },
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct ElasticsearchNode;

#[async_trait]
impl Node for ElasticsearchNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "elasticsearch",
            "Elasticsearch",
            "Search, index, update, and delete Elasticsearch documents",
            NodeCategory::Database,
        )
        .icon("database")
        .color("#005571")
        .credentials(vec![CredentialBinding {
            name: "elasticsearchApi".into(),
            display_name: "Elasticsearch Cluster".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("index", "Index", NodePropertyType::String)
                .placeholder("logs-2026.05")
                .description("Target index (or comma-separated indices for search)")
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "Search".into(),
                        value: json!("search"),
                        description: Some("Run a query against the index".into()),
                    },
                    NodePropertyOption {
                        name: "Index Document".into(),
                        value: json!("index"),
                        description: Some("Create or replace a document".into()),
                    },
                    NodePropertyOption {
                        name: "Get Document".into(),
                        value: json!("get"),
                        description: Some("Fetch a document by id".into()),
                    },
                    NodePropertyOption {
                        name: "Update Document".into(),
                        value: json!("update"),
                        description: Some("Partial update by id".into()),
                    },
                    NodePropertyOption {
                        name: "Delete Document".into(),
                        value: json!("delete"),
                        description: Some("Delete a document by id".into()),
                    },
                    NodePropertyOption {
                        name: "Count".into(),
                        value: json!("count"),
                        description: Some("Count matching documents".into()),
                    },
                ])
                .default(json!("search"))
                .required(),
            NodeProperty::new("documentId", "Document ID", NodePropertyType::String)
                .placeholder("doc-123")
                .show_when("operation", &["index", "get", "update", "delete"])
                .description("Document _id. Required for get/update/delete. \
                             Optional for index (omit to auto-generate)."),
            NodeProperty::new("query", "Query Body", NodePropertyType::Json)
                .description("Elasticsearch DSL — e.g. {\"query\":{\"match_all\":{}}}")
                .default(json!({ "query": { "match_all": {} } }))
                .show_when("operation", &["search", "count"]),
            NodeProperty::new("document", "Document", NodePropertyType::Json)
                .description("Document JSON body for index / update operations")
                .default(json!({}))
                .show_when("operation", &["index", "update"]),
            NodeProperty::new("size", "Size", NodePropertyType::Number)
                .default(json!(10))
                .description("Max hits to return")
                .show_when("operation", &["search"]),
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
            .map(|s| s.trim_end_matches('/').to_string())
            .ok_or_else(|| NodeError::MissingParameter("baseUrl".into()))?;

        let index_raw = ctx.param_str(params, "index")?;
        let index = ctx.substitute(&index_raw);
        if index.is_empty() {
            return Err(NodeError::MissingParameter("index".into()));
        }

        let operation = ctx.param_str(params, "operation")?;

        let mut headers = HeaderMap::new();
        headers.insert(
            reqwest::header::CONTENT_TYPE,
            HeaderValue::from_static("application/json"),
        );
        headers.insert(
            reqwest::header::ACCEPT,
            HeaderValue::from_static("application/json"),
        );
        apply_auth(&mut headers, &cred.data)?;

        match operation.as_str() {
            "search" => {
                let body = read_json_value(ctx, params, "query")?;
                let size = ctx.param_f64(params, "size").map(|n| n as i64).unwrap_or(10);
                let url = format!(
                    "{base}/{idx}/_search?size={size}",
                    base = base_url,
                    idx = urlencoding::encode(&index),
                    size = size,
                );
                send(ctx, Method::POST, &url, headers, Some(body)).await
            }
            "index" => {
                let body = read_json_value(ctx, params, "document")?;
                let doc_id = ctx
                    .param_str_opt(params, "documentId")
                    .map(|s| ctx.substitute(s.trim()))
                    .filter(|s| !s.is_empty());
                let (method, url) = match doc_id {
                    Some(id) => (
                        Method::PUT,
                        format!(
                            "{base}/{idx}/_doc/{id}",
                            base = base_url,
                            idx = urlencoding::encode(&index),
                            id = urlencoding::encode(&id),
                        ),
                    ),
                    None => (
                        Method::POST,
                        format!(
                            "{base}/{idx}/_doc",
                            base = base_url,
                            idx = urlencoding::encode(&index),
                        ),
                    ),
                };
                send(ctx, method, &url, headers, Some(body)).await
            }
            "get" => {
                let id = ctx.substitute(&ctx.param_str(params, "documentId")?);
                if id.is_empty() {
                    return Err(NodeError::MissingParameter("documentId".into()));
                }
                let url = format!(
                    "{base}/{idx}/_doc/{id}",
                    base = base_url,
                    idx = urlencoding::encode(&index),
                    id = urlencoding::encode(&id),
                );
                send(ctx, Method::GET, &url, headers, None).await
            }
            "update" => {
                let id = ctx.substitute(&ctx.param_str(params, "documentId")?);
                if id.is_empty() {
                    return Err(NodeError::MissingParameter("documentId".into()));
                }
                let doc = read_json_value(ctx, params, "document")?;
                let body = json!({ "doc": doc });
                let url = format!(
                    "{base}/{idx}/_update/{id}",
                    base = base_url,
                    idx = urlencoding::encode(&index),
                    id = urlencoding::encode(&id),
                );
                send(ctx, Method::POST, &url, headers, Some(body)).await
            }
            "delete" => {
                let id = ctx.substitute(&ctx.param_str(params, "documentId")?);
                if id.is_empty() {
                    return Err(NodeError::MissingParameter("documentId".into()));
                }
                let url = format!(
                    "{base}/{idx}/_doc/{id}",
                    base = base_url,
                    idx = urlencoding::encode(&index),
                    id = urlencoding::encode(&id),
                );
                send(ctx, Method::DELETE, &url, headers, None).await
            }
            "count" => {
                let body = read_json_value(ctx, params, "query")?;
                let url = format!(
                    "{base}/{idx}/_count",
                    base = base_url,
                    idx = urlencoding::encode(&index),
                );
                send(ctx, Method::POST, &url, headers, Some(body)).await
            }
            other => Err(NodeError::InvalidParameter {
                name: "operation".into(),
                reason: format!("unknown operation: {other}"),
            }),
        }
    }
}

/// Apply auth headers in order of preference: API key → Bearer → Basic.
fn apply_auth(
    headers: &mut HeaderMap,
    data: &std::collections::HashMap<String, String>,
) -> NodeResult<()> {
    if let Some(api_key) = data.get("apiKey").filter(|s| !s.is_empty()) {
        let v = HeaderValue::from_str(&format!("ApiKey {api_key}"))
            .map_err(|e| NodeError::AuthError(format!("invalid apiKey: {e}")))?;
        headers.insert(reqwest::header::AUTHORIZATION, v);
        return Ok(());
    }
    if let Some(bearer) = data.get("bearerToken").filter(|s| !s.is_empty()) {
        let v = HeaderValue::from_str(&format!("Bearer {bearer}"))
            .map_err(|e| NodeError::AuthError(format!("invalid bearer: {e}")))?;
        headers.insert(reqwest::header::AUTHORIZATION, v);
        return Ok(());
    }
    if let Some(user) = data.get("username").filter(|s| !s.is_empty()) {
        let pass = data.get("password").cloned().unwrap_or_default();
        let raw = format!("{user}:{pass}");
        let encoded = base64::Engine::encode(
            &base64::engine::general_purpose::STANDARD,
            raw.as_bytes(),
        );
        let v = HeaderValue::from_str(&format!("Basic {encoded}"))
            .map_err(|e| NodeError::AuthError(format!("invalid basic auth: {e}")))?;
        headers.insert(reqwest::header::AUTHORIZATION, v);
    }
    // No auth supplied — allowed (open clusters in dev). Don't error.
    Ok(())
}

/// Read a JSON-typed parameter. Accepts a JSON object/array directly, or a
/// JSON-encoded string (with `{{var}}` substitution applied to the string form).
fn read_json_value(ctx: &ExecutionContext, params: &Value, key: &str) -> NodeResult<Value> {
    let raw = params.get(key).cloned().unwrap_or(Value::Null);
    match raw {
        Value::String(s) => {
            let sub = ctx.substitute(&s);
            let trimmed = sub.trim();
            if trimmed.is_empty() {
                Ok(Value::Object(serde_json::Map::new()))
            } else {
                serde_json::from_str::<Value>(trimmed).map_err(|e| {
                    NodeError::InvalidParameter {
                        name: key.into(),
                        reason: format!("not valid JSON: {e}"),
                    }
                })
            }
        }
        Value::Null => Ok(Value::Object(serde_json::Map::new())),
        other => Ok(other),
    }
}

/// Issue an HTTP request, decode JSON, surface non-2xx as UpstreamError.
async fn send(
    ctx: &ExecutionContext,
    method: Method,
    url: &str,
    headers: HeaderMap,
    body: Option<Value>,
) -> NodeResult<NodeOutput> {
    let mut req = ctx.http.request(method, url).headers(headers);
    if let Some(b) = body {
        req = req.json(&b);
    }
    let res = req.send().await?;
    let status = res.status();
    let text = res.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: text,
        });
    }
    if text.trim().is_empty() {
        return Ok(NodeOutput::single(vec![]));
    }
    let parsed: Value = serde_json::from_str(&text).map_err(|e| {
        NodeError::SerializationError(format!("elasticsearch response: {e}; body: {text}"))
    })?;
    Ok(NodeOutput::single(vec![parsed]))
}
