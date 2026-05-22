//! Airtable node.
//!
//! Implements record CRUD against Airtable's REST API plus base/table
//! discovery via the metadata API.
//!
//! Auth: Personal Access Token (PAT) — `Authorization: Bearer <token>` where
//! the token is stored on the linked credential under `data["accessToken"]`.

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

const AIRTABLE_BASE: &str = "https://api.airtable.com/v0";

pub struct AirtableNode;

#[async_trait]
impl Node for AirtableNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "airtable",
            "Airtable",
            "Airtable base operations",
            NodeCategory::Database,
        )
        .icon("table")
        .color("#FFB400")
        .credentials(vec![CredentialBinding {
            name: "airtableApi".into(),
            display_name: "Airtable Personal Access Token".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "Record".into(),
                        value: json!("record"),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Base".into(),
                        value: json!("base"),
                        description: None,
                    },
                    NodePropertyOption {
                        name: "Table".into(),
                        value: json!("table"),
                        description: None,
                    },
                ])
                .default(json!("record"))
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "Create Record".into(),
                        value: json!("create"),
                        description: Some("Create a record in a table".into()),
                    },
                    NodePropertyOption {
                        name: "Get Record".into(),
                        value: json!("get"),
                        description: Some("Get a single record by ID".into()),
                    },
                    NodePropertyOption {
                        name: "List Records".into(),
                        value: json!("list"),
                        description: Some("List records from a table".into()),
                    },
                    NodePropertyOption {
                        name: "Update Record".into(),
                        value: json!("update"),
                        description: Some("Update a record's fields".into()),
                    },
                    NodePropertyOption {
                        name: "Upsert Record".into(),
                        value: json!("upsert"),
                        description: Some(
                            "Insert-or-update by matching on one or more field values".into(),
                        ),
                    },
                    NodePropertyOption {
                        name: "Delete Record".into(),
                        value: json!("delete"),
                        description: Some("Delete a record by ID".into()),
                    },
                    NodePropertyOption {
                        name: "List Bases".into(),
                        value: json!("listBases"),
                        description: Some("List bases accessible to the token".into()),
                    },
                    NodePropertyOption {
                        name: "Get Table Schema".into(),
                        value: json!("getSchema"),
                        description: Some("Return the table schema for a base".into()),
                    },
                ])
                .default(json!("create"))
                .required(),
            NodeProperty::new("baseId", "Base ID", NodePropertyType::String)
                .placeholder("appXXXXXXXXXXXXXX")
                .show_when(
                    "operation",
                    &[
                        "create",
                        "get",
                        "list",
                        "update",
                        "upsert",
                        "delete",
                        "getSchema",
                    ],
                )
                .required(),
            NodeProperty::new("tableId", "Table ID or Name", NodePropertyType::String)
                .placeholder("Table 1 or tblXXXXXXXXXXXXXX")
                .show_when("resource", &["record"])
                .required(),
            NodeProperty::new("recordId", "Record ID", NodePropertyType::String)
                .placeholder("recXXXXXXXXXXXXXX")
                .show_when("operation", &["get", "update", "delete"])
                .required(),
            NodeProperty::new("fields", "Fields", NodePropertyType::Json)
                .description("JSON object mapping field name to value")
                .default(json!({}))
                .show_when("operation", &["create", "update", "upsert"])
                .required(),
            NodeProperty::new("view", "View", NodePropertyType::String)
                .description("Optional Airtable view name or ID")
                .show_when("operation", &["list"]),
            NodeProperty::new(
                "filterByFormula",
                "Filter By Formula",
                NodePropertyType::String,
            )
            .description("Airtable formula expression to filter rows")
            .show_when("operation", &["list"]),
            NodeProperty::new("maxRecords", "Max Records", NodePropertyType::Number)
                .default(json!(100))
                .show_when("operation", &["list"]),
            NodeProperty::new("pageSize", "Page Size", NodePropertyType::Number)
                .default(json!(100))
                .show_when("operation", &["list"]),
            NodeProperty::new(
                "mergeOnFieldsKey",
                "Merge On Field",
                NodePropertyType::String,
            )
            .description("Field name(s) to match on, comma-separated for multiple")
            .show_when("operation", &["upsert"])
            .required(),
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

        let operation = ctx.param_str(params, "operation")?;

        match operation.as_str() {
            "create" => {
                let base_id = substituted(ctx, params, "baseId")?;
                let table_id = substituted(ctx, params, "tableId")?;
                let fields = read_fields(ctx, params, "fields")?;
                let url = format!(
                    "{AIRTABLE_BASE}/{}/{}",
                    encode_path(&base_id),
                    encode_path(&table_id)
                );
                let body = json!({ "records": [ { "fields": fields } ] });
                let res = ctx
                    .http
                    .post(&url)
                    .bearer_auth(&token)
                    .header("Content-Type", "application/json")
                    .json(&body)
                    .send()
                    .await?;
                json_or_err(res).await.map(|v| NodeOutput::single(vec![v]))
            }
            "get" => {
                let base_id = substituted(ctx, params, "baseId")?;
                let table_id = substituted(ctx, params, "tableId")?;
                let record_id = substituted(ctx, params, "recordId")?;
                let url = format!(
                    "{AIRTABLE_BASE}/{}/{}/{}",
                    encode_path(&base_id),
                    encode_path(&table_id),
                    encode_path(&record_id)
                );
                let res = ctx.http.get(&url).bearer_auth(&token).send().await?;
                json_or_err(res).await.map(|v| NodeOutput::single(vec![v]))
            }
            "list" => {
                let base_id = substituted(ctx, params, "baseId")?;
                let table_id = substituted(ctx, params, "tableId")?;
                let url = format!(
                    "{AIRTABLE_BASE}/{}/{}",
                    encode_path(&base_id),
                    encode_path(&table_id)
                );
                let mut query: Vec<(String, String)> = Vec::new();
                if let Some(view) = ctx.param_str_opt(params, "view") {
                    let s = ctx.substitute(&view);
                    if !s.is_empty() {
                        query.push(("view".into(), s));
                    }
                }
                if let Some(formula) = ctx.param_str_opt(params, "filterByFormula") {
                    let s = ctx.substitute(&formula);
                    if !s.is_empty() {
                        query.push(("filterByFormula".into(), s));
                    }
                }
                if let Some(max) = ctx.param_f64(params, "maxRecords") {
                    query.push(("maxRecords".into(), (max as i64).to_string()));
                }
                if let Some(page) = ctx.param_f64(params, "pageSize") {
                    query.push(("pageSize".into(), (page as i64).to_string()));
                }
                let res = ctx
                    .http
                    .get(&url)
                    .bearer_auth(&token)
                    .query(&query)
                    .send()
                    .await?;
                json_or_err(res).await.map(|v| NodeOutput::single(vec![v]))
            }
            "update" => {
                let base_id = substituted(ctx, params, "baseId")?;
                let table_id = substituted(ctx, params, "tableId")?;
                let record_id = substituted(ctx, params, "recordId")?;
                let fields = read_fields(ctx, params, "fields")?;
                let url = format!(
                    "{AIRTABLE_BASE}/{}/{}/{}",
                    encode_path(&base_id),
                    encode_path(&table_id),
                    encode_path(&record_id)
                );
                let body = json!({ "fields": fields });
                let res = ctx
                    .http
                    .patch(&url)
                    .bearer_auth(&token)
                    .header("Content-Type", "application/json")
                    .json(&body)
                    .send()
                    .await?;
                json_or_err(res).await.map(|v| NodeOutput::single(vec![v]))
            }
            "upsert" => {
                let base_id = substituted(ctx, params, "baseId")?;
                let table_id = substituted(ctx, params, "tableId")?;
                let fields = read_fields(ctx, params, "fields")?;
                let merge_key = substituted(ctx, params, "mergeOnFieldsKey")?;
                let merge_fields: Vec<String> = merge_key
                    .split(',')
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .collect();
                if merge_fields.is_empty() {
                    return Err(NodeError::MissingParameter("mergeOnFieldsKey".into()));
                }
                let url = format!(
                    "{AIRTABLE_BASE}/{}/{}",
                    encode_path(&base_id),
                    encode_path(&table_id)
                );
                let body = json!({
                    "records": [ { "fields": fields } ],
                    "performUpsert": { "fieldsToMergeOn": merge_fields },
                });
                let res = ctx
                    .http
                    .patch(&url)
                    .bearer_auth(&token)
                    .header("Content-Type", "application/json")
                    .json(&body)
                    .send()
                    .await?;
                json_or_err(res).await.map(|v| NodeOutput::single(vec![v]))
            }
            "delete" => {
                let base_id = substituted(ctx, params, "baseId")?;
                let table_id = substituted(ctx, params, "tableId")?;
                let record_id = substituted(ctx, params, "recordId")?;
                let url = format!(
                    "{AIRTABLE_BASE}/{}/{}/{}",
                    encode_path(&base_id),
                    encode_path(&table_id),
                    encode_path(&record_id)
                );
                let res = ctx.http.delete(&url).bearer_auth(&token).send().await?;
                json_or_err(res).await.map(|v| NodeOutput::single(vec![v]))
            }
            "listBases" => {
                let url = format!("{AIRTABLE_BASE}/meta/bases");
                let res = ctx.http.get(&url).bearer_auth(&token).send().await?;
                json_or_err(res).await.map(|v| NodeOutput::single(vec![v]))
            }
            "getSchema" => {
                let base_id = substituted(ctx, params, "baseId")?;
                let url = format!(
                    "{AIRTABLE_BASE}/meta/bases/{}/tables",
                    encode_path(&base_id)
                );
                let res = ctx.http.get(&url).bearer_auth(&token).send().await?;
                json_or_err(res).await.map(|v| NodeOutput::single(vec![v]))
            }
            other => Err(NodeError::InvalidParameter {
                name: "operation".into(),
                reason: format!("unknown operation: {other}"),
            }),
        }
    }
}

/// Read a string parameter and run `{{var}}` substitution on it.
fn substituted(ctx: &ExecutionContext, params: &Value, key: &str) -> NodeResult<String> {
    let raw = ctx.param_str(params, key)?;
    Ok(ctx.substitute(&raw))
}

/// Read the `fields` property — accepts either a JSON object directly or a
/// JSON string that parses to an object. Returns the object map.
fn read_fields(
    ctx: &ExecutionContext,
    params: &Value,
    key: &str,
) -> NodeResult<Map<String, Value>> {
    let value = match params.get(key) {
        Some(v) => v,
        None => &Value::Null,
    };
    let resolved: Value = match value {
        Value::String(s) => {
            let sub = ctx.substitute(s);
            let trimmed = sub.trim();
            if trimmed.is_empty() {
                Value::Object(Map::new())
            } else {
                serde_json::from_str(trimmed).map_err(|e| NodeError::InvalidParameter {
                    name: key.into(),
                    reason: format!("not valid JSON: {e}"),
                })?
            }
        }
        Value::Null => Value::Object(Map::new()),
        other => other.clone(),
    };
    match resolved {
        Value::Object(map) => Ok(map),
        _ => Err(NodeError::InvalidParameter {
            name: key.into(),
            reason: "fields must be a JSON object".into(),
        }),
    }
}

/// Percent-encode a single path segment so table names with spaces and other
/// reserved characters survive the URL round-trip.
fn encode_path(segment: &str) -> String {
    urlencoding::encode(segment).into_owned()
}

/// Parse the response body as JSON and return an `UpstreamError` for non-2xx.
async fn json_or_err(res: reqwest::Response) -> NodeResult<Value> {
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
    serde_json::from_str(&text).map_err(NodeError::from)
}
