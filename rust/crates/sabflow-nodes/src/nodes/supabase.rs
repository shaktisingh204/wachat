//! Supabase node.
//!
//! Talks to a Supabase project over PostgREST (`{projectUrl}/rest/v1/{table}`).
//! Authenticates with either the service-role key (server-side, bypasses RLS)
//! or the anon key (subject to RLS). The chosen key is sent as both
//! `apikey: <key>` and `Authorization: Bearer <key>` headers.
//!
//! Operations:
//!   - `select` — GET   `/rest/v1/{table}?select={columns}&{filter}&limit={limit}`
//!   - `insert` — POST  `/rest/v1/{table}`  (body: JSON array or object)
//!   - `update` — PATCH `/rest/v1/{table}?{filter}`
//!   - `delete` — DELETE `/rest/v1/{table}?{filter}`
//!   - `upsert` — POST  `/rest/v1/{table}`  with `Prefer: resolution=merge-duplicates`
//!
//! Filters are passed through as raw PostgREST query strings, e.g.
//! `email=eq.user@example.com&status=in.(active,pending)`.

use async_trait::async_trait;
use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
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

pub struct SupabaseNode;

#[async_trait]
impl Node for SupabaseNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "supabase",
            "Supabase",
            "Supabase database operations via PostgREST",
            NodeCategory::Database,
        )
        .icon("database")
        .color("#3ECF8E")
        .credentials(vec![CredentialBinding {
            name: "supabaseApi".into(),
            display_name: "Supabase Project".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("table", "Table", NodePropertyType::String)
                .placeholder("users")
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "Select".into(),
                        value: json!("select"),
                        description: Some("Fetch rows".into()),
                    },
                    NodePropertyOption {
                        name: "Insert".into(),
                        value: json!("insert"),
                        description: Some("Create new rows".into()),
                    },
                    NodePropertyOption {
                        name: "Update".into(),
                        value: json!("update"),
                        description: Some("Update rows matching filter".into()),
                    },
                    NodePropertyOption {
                        name: "Delete".into(),
                        value: json!("delete"),
                        description: Some("Delete rows matching filter".into()),
                    },
                    NodePropertyOption {
                        name: "Upsert".into(),
                        value: json!("upsert"),
                        description: Some("Insert or update on conflict".into()),
                    },
                ])
                .default(json!("select"))
                .required(),
            NodeProperty::new("filter", "Filter", NodePropertyType::String)
                .placeholder("email=eq.user@example.com")
                .description(
                    "PostgREST filter — e.g. id=eq.5, status=in.(active,pending). \
                     Multiple filters joined with `&`.",
                )
                .show_when("operation", &["select", "update", "delete"]),
            NodeProperty::new("data", "Data", NodePropertyType::Json)
                .description("Row data — JSON object or array of objects")
                .default(json!({}))
                .show_when("operation", &["insert", "update", "upsert"]),
            NodeProperty::new("columns", "Columns", NodePropertyType::String)
                .default(json!("*"))
                .placeholder("id,name,email")
                .description("Comma-separated columns for SELECT")
                .show_when("operation", &["select"]),
            NodeProperty::new("limit", "Limit", NodePropertyType::Number)
                .default(json!(100))
                .show_when("operation", &["select"]),
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
        let project_url = cred
            .data
            .get("projectUrl")
            .map(|s| s.trim_end_matches('/').to_string())
            .ok_or_else(|| NodeError::MissingParameter("projectUrl".into()))?;
        // Either service-role or anon key works; prefer service-role.
        let api_key = cred
            .data
            .get("serviceRoleKey")
            .or_else(|| cred.data.get("anonKey"))
            .cloned()
            .ok_or_else(|| {
                NodeError::MissingParameter("serviceRoleKey or anonKey".into())
            })?;

        let table = ctx.substitute(&ctx.param_str(params, "table")?);
        if table.is_empty() {
            return Err(NodeError::MissingParameter("table".into()));
        }
        let operation = ctx.param_str(params, "operation")?;

        let base = format!(
            "{base}/rest/v1/{table}",
            base = project_url,
            table = urlencoding::encode(&table),
        );

        let mut headers = HeaderMap::new();
        let key_val = HeaderValue::from_str(&api_key)
            .map_err(|e| NodeError::AuthError(format!("invalid api key: {e}")))?;
        headers.insert(HeaderName::from_static("apikey"), key_val.clone());
        let bearer = HeaderValue::from_str(&format!("Bearer {api_key}"))
            .map_err(|e| NodeError::AuthError(format!("invalid bearer: {e}")))?;
        headers.insert(reqwest::header::AUTHORIZATION, bearer);

        match operation.as_str() {
            "select" => {
                let cols = ctx
                    .param_str_opt(params, "columns")
                    .map(|s| ctx.substitute(s.trim()))
                    .filter(|s| !s.is_empty())
                    .unwrap_or_else(|| "*".to_string());
                let limit = ctx.param_f64(params, "limit").unwrap_or(100.0) as i64;
                let filter = ctx
                    .param_str_opt(params, "filter")
                    .map(|s| ctx.substitute(s.trim()))
                    .filter(|s| !s.is_empty());

                let mut url = format!(
                    "{base}?select={cols}&limit={limit}",
                    base = base,
                    cols = urlencoding::encode(&cols),
                    limit = limit,
                );
                if let Some(f) = filter {
                    // Filter is a raw PostgREST string. We append as-is so
                    // multi-filter expressions stay intact.
                    url.push('&');
                    url.push_str(&f);
                }

                let res = ctx
                    .http
                    .get(&url)
                    .headers(headers)
                    .send()
                    .await?;
                read_json(res).await
            }
            "insert" => {
                let body = read_json_value(ctx, params, "data")?;
                let mut req_headers = headers;
                req_headers.insert(
                    HeaderName::from_static("prefer"),
                    HeaderValue::from_static("return=representation"),
                );
                req_headers.insert(
                    reqwest::header::CONTENT_TYPE,
                    HeaderValue::from_static("application/json"),
                );
                let res = ctx
                    .http
                    .post(&base)
                    .headers(req_headers)
                    .json(&body)
                    .send()
                    .await?;
                read_json(res).await
            }
            "update" => {
                let filter = ctx
                    .param_str_opt(params, "filter")
                    .map(|s| ctx.substitute(s.trim()))
                    .filter(|s| !s.is_empty())
                    .ok_or_else(|| NodeError::MissingParameter("filter".into()))?;
                let body = read_json_value(ctx, params, "data")?;
                let url = format!("{base}?{filter}");
                let mut req_headers = headers;
                req_headers.insert(
                    HeaderName::from_static("prefer"),
                    HeaderValue::from_static("return=representation"),
                );
                req_headers.insert(
                    reqwest::header::CONTENT_TYPE,
                    HeaderValue::from_static("application/json"),
                );
                let res = ctx
                    .http
                    .patch(&url)
                    .headers(req_headers)
                    .json(&body)
                    .send()
                    .await?;
                read_json(res).await
            }
            "delete" => {
                let filter = ctx
                    .param_str_opt(params, "filter")
                    .map(|s| ctx.substitute(s.trim()))
                    .filter(|s| !s.is_empty())
                    .ok_or_else(|| NodeError::MissingParameter("filter".into()))?;
                let url = format!("{base}?{filter}");
                let mut req_headers = headers;
                req_headers.insert(
                    HeaderName::from_static("prefer"),
                    HeaderValue::from_static("return=representation"),
                );
                let res = ctx
                    .http
                    .delete(&url)
                    .headers(req_headers)
                    .send()
                    .await?;
                read_json(res).await
            }
            "upsert" => {
                let body = read_json_value(ctx, params, "data")?;
                let mut req_headers = headers;
                req_headers.insert(
                    HeaderName::from_static("prefer"),
                    HeaderValue::from_static(
                        "resolution=merge-duplicates,return=representation",
                    ),
                );
                req_headers.insert(
                    reqwest::header::CONTENT_TYPE,
                    HeaderValue::from_static("application/json"),
                );
                let res = ctx
                    .http
                    .post(&base)
                    .headers(req_headers)
                    .json(&body)
                    .send()
                    .await?;
                read_json(res).await
            }
            other => Err(NodeError::InvalidParameter {
                name: "operation".into(),
                reason: format!("unknown operation: {other}"),
            }),
        }
    }
}

/// Read a JSON-typed parameter. Accepts a JSON object/array directly or a
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

/// Parse a Supabase REST response. Non-2xx responses surface as
/// `UpstreamError`. 204 (no body, e.g. DELETE without Prefer) returns an
/// empty branch. The success body is wrapped so that an array of rows becomes
/// multiple items and a single object becomes one item.
async fn read_json(res: reqwest::Response) -> NodeResult<NodeOutput> {
    let status = res.status();
    if status.as_u16() == 204 {
        return Ok(NodeOutput::single(vec![]));
    }
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
        NodeError::SerializationError(format!("supabase response: {e}; body: {text}"))
    })?;
    let items = match parsed {
        Value::Array(arr) => arr,
        other => vec![other],
    };
    Ok(NodeOutput::single(items))
}
