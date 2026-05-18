//! Coda node — Coda Docs API v1 (`https://coda.io/apis/v1`).
//!
//! Coda is an all-in-one document, spreadsheet, and database tool. Their REST
//! API uses a personal API token (`Bearer <token>`) issued from the Coda
//! account settings page.
//!
//! Supported operations:
//!   - `doc.list`, `doc.get`               → manage docs
//!   - `table.list`                        → list tables in a doc
//!   - `row.list`, `row.get`, `row.upsert` → read/write rows in a table
//!
//! Auth: the linked credential's `data["apiToken"]` is sent as a bearer token.

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

const CODA_BASE: &str = "https://coda.io/apis/v1";

pub struct CodaNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for CodaNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new("coda", "Coda", "Coda Docs API", NodeCategory::Productivity)
            .icon("file-text")
            .color("#F46A54")
            .credentials(vec![CredentialBinding {
                name: "codaApi".into(),
                display_name: "Coda API Token".into(),
                required: true,
            }])
            .properties(vec![
                NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                    .required(),
                NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                    .options(vec![
                        opt("List Docs", "doc.list"),
                        opt("Get Doc", "doc.get"),
                        opt("List Tables", "table.list"),
                        opt("List Rows", "row.list"),
                        opt("Get Row", "row.get"),
                        opt("Upsert Rows", "row.upsert"),
                    ])
                    .default(json!("doc.list"))
                    .required(),
                NodeProperty::new("docId", "Doc ID", NodePropertyType::String)
                    .placeholder("aBcDeFgHiJ")
                    .show_when(
                        "operation",
                        &["doc.get", "table.list", "row.list", "row.get", "row.upsert"],
                    )
                    .description("Coda document id (the part after `_d` in the URL)"),
                NodeProperty::new("tableId", "Table ID", NodePropertyType::String)
                    .placeholder("grid-xxxxxxxx")
                    .show_when("operation", &["row.list", "row.get", "row.upsert"])
                    .description("Table or view id"),
                NodeProperty::new("rowId", "Row ID", NodePropertyType::String)
                    .show_when("operation", &["row.get"]),
                NodeProperty::new("limit", "Limit", NodePropertyType::Number)
                    .default(json!(25))
                    .show_when("operation", &["doc.list", "row.list"]),
                NodeProperty::new("query", "Query", NodePropertyType::String)
                    .show_when("operation", &["row.list"])
                    .description("Filter rows: `<columnIdOrName>:<value>`"),
                NodeProperty::new("rows", "Rows", NodePropertyType::Json)
                    .show_when("operation", &["row.upsert"])
                    .description(
                        "Array of `{cells:[{column,value}]}` objects per the Coda upsert schema",
                    ),
                NodeProperty::new("keyColumns", "Key Columns", NodePropertyType::String)
                    .show_when("operation", &["row.upsert"])
                    .description("Comma-separated column ids/names to use for upsert matching"),
            ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let cred_id = ctx.param_str(params, "credentialId")?;
        let token = ctx
            .credential(&cred_id)?
            .data
            .get("apiToken")
            .ok_or_else(|| NodeError::MissingParameter("apiToken".into()))?
            .clone();

        let operation = ctx.param_str(params, "operation")?;

        match operation.as_str() {
            "doc.list" => {
                let limit = ctx.param_f64(params, "limit").unwrap_or(25.0) as i64;
                let url = format!("{CODA_BASE}/docs");
                let res = ctx
                    .http
                    .get(&url)
                    .bearer_auth(&token)
                    .query(&[("limit", limit.to_string())])
                    .send()
                    .await?;
                wrap(res).await
            }
            "doc.get" => {
                let doc_id = sub(ctx, params, "docId")?;
                let url = format!("{CODA_BASE}/docs/{}", urlencoding::encode(&doc_id));
                let res = ctx.http.get(&url).bearer_auth(&token).send().await?;
                wrap(res).await
            }
            "table.list" => {
                let doc_id = sub(ctx, params, "docId")?;
                let url = format!("{CODA_BASE}/docs/{}/tables", urlencoding::encode(&doc_id));
                let res = ctx.http.get(&url).bearer_auth(&token).send().await?;
                wrap(res).await
            }
            "row.list" => {
                let doc_id = sub(ctx, params, "docId")?;
                let table_id = sub(ctx, params, "tableId")?;
                let limit = ctx.param_f64(params, "limit").unwrap_or(25.0) as i64;
                let url = format!(
                    "{CODA_BASE}/docs/{}/tables/{}/rows",
                    urlencoding::encode(&doc_id),
                    urlencoding::encode(&table_id),
                );
                let mut query: Vec<(String, String)> =
                    vec![("limit".into(), limit.to_string())];
                if let Some(q) = sub_opt(ctx, params, "query") {
                    if !q.is_empty() {
                        query.push(("query".into(), q));
                    }
                }
                let res = ctx
                    .http
                    .get(&url)
                    .bearer_auth(&token)
                    .query(&query)
                    .send()
                    .await?;
                wrap(res).await
            }
            "row.get" => {
                let doc_id = sub(ctx, params, "docId")?;
                let table_id = sub(ctx, params, "tableId")?;
                let row_id = sub(ctx, params, "rowId")?;
                let url = format!(
                    "{CODA_BASE}/docs/{}/tables/{}/rows/{}",
                    urlencoding::encode(&doc_id),
                    urlencoding::encode(&table_id),
                    urlencoding::encode(&row_id),
                );
                let res = ctx.http.get(&url).bearer_auth(&token).send().await?;
                wrap(res).await
            }
            "row.upsert" => {
                let doc_id = sub(ctx, params, "docId")?;
                let table_id = sub(ctx, params, "tableId")?;
                let rows = params
                    .get("rows")
                    .cloned()
                    .ok_or_else(|| NodeError::MissingParameter("rows".into()))?;
                let rows = match rows {
                    Value::String(s) => {
                        let s = ctx.substitute(&s);
                        serde_json::from_str::<Value>(&s).unwrap_or(Value::Array(vec![]))
                    }
                    other => other,
                };
                let mut body = Map::new();
                body.insert("rows".into(), rows);
                if let Some(keys) = sub_opt(ctx, params, "keyColumns") {
                    let list: Vec<Value> = keys
                        .split(',')
                        .map(|s| s.trim())
                        .filter(|s| !s.is_empty())
                        .map(|s| Value::String(s.to_string()))
                        .collect();
                    if !list.is_empty() {
                        body.insert("keyColumns".into(), Value::Array(list));
                    }
                }
                let url = format!(
                    "{CODA_BASE}/docs/{}/tables/{}/rows",
                    urlencoding::encode(&doc_id),
                    urlencoding::encode(&table_id),
                );
                let res = ctx
                    .http
                    .post(&url)
                    .bearer_auth(&token)
                    .json(&Value::Object(body))
                    .send()
                    .await?;
                wrap(res).await
            }
            other => Err(NodeError::InvalidParameter {
                name: "operation".into(),
                reason: format!("unknown operation: {other}"),
            }),
        }
    }
}

fn sub(ctx: &ExecutionContext, params: &Value, key: &str) -> NodeResult<String> {
    let raw = ctx.param_str(params, key)?;
    let v = ctx.substitute(&raw);
    if v.trim().is_empty() {
        return Err(NodeError::MissingParameter(key.to_string()));
    }
    Ok(v)
}

fn sub_opt(ctx: &ExecutionContext, params: &Value, key: &str) -> Option<String> {
    ctx.param_str_opt(params, key).map(|s| ctx.substitute(&s))
}

async fn wrap(res: reqwest::Response) -> NodeResult<NodeOutput> {
    let status = res.status();
    let text = res.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: text,
        });
    }
    let value: Value = if text.is_empty() {
        Value::Null
    } else {
        serde_json::from_str(&text)
            .unwrap_or_else(|_| Value::String(text))
    };
    Ok(NodeOutput::single(vec![value]))
}
