//! Google BigQuery node.
//!
//! Implements the BigQuery REST API v2 for the most common analytics
//! operations: running synchronous queries (`jobs.query`), listing datasets
//! / tables, fetching table metadata, and streaming row inserts.
//!
//! Authentication: we expect the credential to be a pre-refreshed OAuth2
//! access token stored at `cred.data["accessToken"]` (the `googleApi` /
//! `googleBigQueryOAuth2` credential type used elsewhere in SabFlow). The
//! token must have the `https://www.googleapis.com/auth/bigquery` scope.
//!
//! TODO(sabflow): wire up full OAuth2 refresh-token handling — currently the
//! credential is assumed to already hold a valid, non-expired access token.

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

pub struct GoogleBigQueryNode;

const BASE_URL: &str = "https://bigquery.googleapis.com/bigquery/v2";

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for GoogleBigQueryNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "googleBigQuery",
            "Google BigQuery",
            "Run queries and manage datasets in Google BigQuery",
            NodeCategory::Analytics,
        )
        .icon("database")
        .color("#4285F4")
        .credentials(vec![CredentialBinding {
            name: "googleBigQueryOAuth2".into(),
            display_name: "Google BigQuery OAuth2".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("projectId", "Project ID", NodePropertyType::String)
                .placeholder("my-gcp-project")
                .required()
                .description("GCP project the request is billed to."),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![
                    opt("Query", "query"),
                    opt("Dataset", "dataset"),
                    opt("Table", "table"),
                ])
                .default(json!("query"))
                .required(),
            // ── Query operations ───────────────────────────────────────────
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![opt("Run Query", "run")])
                .default(json!("run"))
                .show_when("resource", &["query"])
                .required(),
            NodeProperty::new("sql", "SQL", NodePropertyType::String)
                .placeholder("SELECT * FROM `project.dataset.table` LIMIT 100")
                .description("Standard-SQL query text.")
                .show_when("operation", &["run"])
                .required(),
            NodeProperty::new("useLegacySql", "Use Legacy SQL", NodePropertyType::Boolean)
                .default(json!(false))
                .show_when("operation", &["run"]),
            NodeProperty::new("maxResults", "Max Results", NodePropertyType::Number)
                .default(json!(1000))
                .show_when("operation", &["run"]),
            // ── Dataset operations ─────────────────────────────────────────
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("List", "list"),
                    opt("Get", "get"),
                    opt("Create", "create"),
                    opt("Delete", "delete"),
                ])
                .default(json!("list"))
                .show_when("resource", &["dataset"])
                .required(),
            NodeProperty::new("datasetId", "Dataset ID", NodePropertyType::String)
                .show_when("operation", &["get", "create", "delete", "insertAll"])
                .description("Dataset identifier (e.g. `analytics`)."),
            // ── Table operations ───────────────────────────────────────────
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("List", "list"),
                    opt("Get", "get"),
                    opt("Insert Rows", "insertAll"),
                ])
                .default(json!("list"))
                .show_when("resource", &["table"])
                .required(),
            NodeProperty::new("tableId", "Table ID", NodePropertyType::String)
                .show_when("operation", &["get", "insertAll"])
                .description("Table identifier within the dataset."),
            NodeProperty::new("rows", "Rows", NodePropertyType::Json)
                .placeholder("[ { \"json\": { \"col1\": \"value\" } } ]")
                .description("Array of rows for streaming insert — `[ { json: { ... } } ]`.")
                .show_when("operation", &["insertAll"]),
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
            .ok_or_else(|| NodeError::MissingParameter("accessToken".into()))?
            .clone();

        let project_id = ctx.param_str(params, "projectId")?;
        let resource = ctx.param_str(params, "resource")?;
        let operation = ctx.param_str(params, "operation")?;

        match (resource.as_str(), operation.as_str()) {
            // ── Synchronous query (jobs.query) ─────────────────────────────
            ("query", "run") => {
                let sql = ctx.param_str(params, "sql")?;
                let use_legacy = ctx.param_bool(params, "useLegacySql", false);
                let max_results = ctx
                    .param_f64(params, "maxResults")
                    .map(|n| n as u64)
                    .unwrap_or(1000);
                let url = format!(
                    "{BASE_URL}/projects/{}/queries",
                    urlencoding::encode(&project_id)
                );
                let payload = json!({
                    "query": sql,
                    "useLegacySql": use_legacy,
                    "maxResults": max_results,
                });
                post_json(ctx, &token, &url, payload).await
            }
            // ── Datasets ───────────────────────────────────────────────────
            ("dataset", "list") => {
                let url = format!(
                    "{BASE_URL}/projects/{}/datasets",
                    urlencoding::encode(&project_id)
                );
                get_json(ctx, &token, &url).await
            }
            ("dataset", "get") => {
                let dataset_id = ctx.param_str(params, "datasetId")?;
                let url = format!(
                    "{BASE_URL}/projects/{}/datasets/{}",
                    urlencoding::encode(&project_id),
                    urlencoding::encode(&dataset_id)
                );
                get_json(ctx, &token, &url).await
            }
            ("dataset", "create") => {
                let dataset_id = ctx.param_str(params, "datasetId")?;
                let url = format!(
                    "{BASE_URL}/projects/{}/datasets",
                    urlencoding::encode(&project_id)
                );
                let payload = json!({
                    "datasetReference": {
                        "projectId": project_id,
                        "datasetId": dataset_id,
                    }
                });
                post_json(ctx, &token, &url, payload).await
            }
            ("dataset", "delete") => {
                let dataset_id = ctx.param_str(params, "datasetId")?;
                let url = format!(
                    "{BASE_URL}/projects/{}/datasets/{}",
                    urlencoding::encode(&project_id),
                    urlencoding::encode(&dataset_id)
                );
                delete_request(ctx, &token, &url).await
            }
            // ── Tables ─────────────────────────────────────────────────────
            ("table", "list") => {
                let dataset_id = ctx.param_str(params, "datasetId")?;
                let url = format!(
                    "{BASE_URL}/projects/{}/datasets/{}/tables",
                    urlencoding::encode(&project_id),
                    urlencoding::encode(&dataset_id)
                );
                get_json(ctx, &token, &url).await
            }
            ("table", "get") => {
                let dataset_id = ctx.param_str(params, "datasetId")?;
                let table_id = ctx.param_str(params, "tableId")?;
                let url = format!(
                    "{BASE_URL}/projects/{}/datasets/{}/tables/{}",
                    urlencoding::encode(&project_id),
                    urlencoding::encode(&dataset_id),
                    urlencoding::encode(&table_id)
                );
                get_json(ctx, &token, &url).await
            }
            ("table", "insertAll") => {
                let dataset_id = ctx.param_str(params, "datasetId")?;
                let table_id = ctx.param_str(params, "tableId")?;
                let rows = parse_json_param(ctx, params, "rows")
                    .unwrap_or_else(|| Value::Array(vec![]));
                let url = format!(
                    "{BASE_URL}/projects/{}/datasets/{}/tables/{}/insertAll",
                    urlencoding::encode(&project_id),
                    urlencoding::encode(&dataset_id),
                    urlencoding::encode(&table_id)
                );
                let payload = json!({ "rows": rows });
                post_json(ctx, &token, &url, payload).await
            }
            (res, op) => Err(NodeError::InvalidParameter {
                name: "operation".into(),
                reason: format!("unsupported BigQuery operation: {res}/{op}"),
            }),
        }
    }
}

async fn get_json(
    ctx: &ExecutionContext,
    token: &str,
    url: &str,
) -> NodeResult<NodeOutput> {
    let res = ctx.http.get(url).bearer_auth(token).send().await?;
    emit(res).await
}

async fn post_json(
    ctx: &ExecutionContext,
    token: &str,
    url: &str,
    payload: Value,
) -> NodeResult<NodeOutput> {
    let res = ctx
        .http
        .post(url)
        .bearer_auth(token)
        .json(&payload)
        .send()
        .await?;
    emit(res).await
}

async fn delete_request(
    ctx: &ExecutionContext,
    token: &str,
    url: &str,
) -> NodeResult<NodeOutput> {
    let res = ctx.http.delete(url).bearer_auth(token).send().await?;
    let status = res.status();
    let text = res.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: text,
        });
    }
    Ok(NodeOutput::single(vec![json!({ "deleted": true })]))
}

async fn emit(res: reqwest::Response) -> NodeResult<NodeOutput> {
    let status = res.status();
    let text = res.text().await.unwrap_or_default();
    let body: Value =
        serde_json::from_str(&text).unwrap_or_else(|_| json!({ "body": text.clone() }));
    if !status.is_success() {
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: body.to_string(),
        });
    }
    Ok(NodeOutput::single(vec![body]))
}

/// Pull a JSON-shaped property out of `params`. Accepts native JSON or a
/// string blob (the frontend sometimes submits JSON props as strings).
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
