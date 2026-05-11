//! NocoDB node.
//!
//! Implements record CRUD against the NocoDB v2 REST API.
//!
//! Auth: `xc-token` API token — set on the linked credential under
//! `data["authToken"]`. The base URL (e.g. `https://app.nocodb.com`) is read
//! from `data["baseUrl"]`.

use async_trait::async_trait;
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

pub struct NocoDbNode;

#[async_trait]
impl Node for NocoDbNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "nocoDb",
            "NocoDB",
            "NocoDB database operations (v2 API)",
            NodeCategory::Database,
        )
        .icon("database")
        .color("#1A1A1A")
        .credentials(vec![CredentialBinding {
            name: "nocoDbApi".into(),
            display_name: "NocoDB API".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "List Records".into(),
                        value: json!("list"),
                        description: Some("List records from a table".into()),
                    },
                    NodePropertyOption {
                        name: "Get Record".into(),
                        value: json!("get"),
                        description: Some("Get a single record by ID".into()),
                    },
                    NodePropertyOption {
                        name: "Create Record".into(),
                        value: json!("create"),
                        description: Some("Create one or more records".into()),
                    },
                    NodePropertyOption {
                        name: "Update Record".into(),
                        value: json!("update"),
                        description: Some("Update a record's fields".into()),
                    },
                    NodePropertyOption {
                        name: "Delete Record".into(),
                        value: json!("delete"),
                        description: Some("Delete a record by ID".into()),
                    },
                    NodePropertyOption {
                        name: "Count Records".into(),
                        value: json!("count"),
                        description: Some("Count records matching a filter".into()),
                    },
                ])
                .default(json!("list"))
                .required(),
            NodeProperty::new("tableId", "Table ID", NodePropertyType::String)
                .placeholder("mxxxxxxxxxxxxxx")
                .description("The NocoDB v2 table ID")
                .required(),
            NodeProperty::new("recordId", "Record ID", NodePropertyType::String)
                .placeholder("1")
                .description("The primary key of the record")
                .show_when("operation", &["get", "update", "delete"])
                .required(),
            NodeProperty::new("data", "Data", NodePropertyType::Json)
                .description(
                    "Record data — object for single record or array of objects for bulk",
                )
                .default(json!({}))
                .show_when("operation", &["create", "update"])
                .required(),
            NodeProperty::new("where", "Where", NodePropertyType::String)
                .placeholder("(field,eq,value)")
                .description("NocoDB where clause, e.g. `(Title,eq,Hello)`")
                .show_when("operation", &["list", "count"]),
            NodeProperty::new("fields", "Fields", NodePropertyType::String)
                .placeholder("Title,Status,CreatedAt")
                .description("Comma-separated list of fields to return")
                .show_when("operation", &["list"]),
            NodeProperty::new("limit", "Limit", NodePropertyType::Number)
                .default(json!(25))
                .show_when("operation", &["list"]),
            NodeProperty::new("offset", "Offset", NodePropertyType::Number)
                .default(json!(0))
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
            .get("authToken")
            .ok_or_else(|| NodeError::MissingParameter("authToken".into()))?
            .clone();

        let operation = ctx.param_str(params, "operation")?;
        let table_id = substituted(ctx, params, "tableId")?;
        if table_id.is_empty() {
            return Err(NodeError::MissingParameter("tableId".into()));
        }
        let records_url = format!(
            "{base_url}/api/v2/tables/{}/records",
            encode_path(&table_id)
        );

        match operation.as_str() {
            "list" => {
                let mut query: Vec<(String, String)> = Vec::new();
                if let Some(fields) = ctx.param_str_opt(params, "fields") {
                    if !fields.is_empty() {
                        query.push(("fields".into(), fields));
                    }
                }
                if let Some(where_clause) = ctx.param_str_opt(params, "where") {
                    if !where_clause.is_empty() {
                        query.push(("where".into(), where_clause));
                    }
                }
                let limit = ctx.param_f64(params, "limit").unwrap_or(25.0) as i64;
                query.push(("limit".into(), limit.to_string()));
                let offset = ctx.param_f64(params, "offset").unwrap_or(0.0) as i64;
                query.push(("offset".into(), offset.to_string()));

                let res = ctx
                    .http
                    .get(&records_url)
                    .header("xc-token", &token)
                    .header("Content-Type", "application/json")
                    .query(&query)
                    .send()
                    .await?;
                json_or_err(res).await.map(|v| NodeOutput::single(vec![v]))
            }
            "get" => {
                let record_id = substituted(ctx, params, "recordId")?;
                if record_id.is_empty() {
                    return Err(NodeError::MissingParameter("recordId".into()));
                }
                let url = format!("{records_url}/{}", encode_path(&record_id));
                let res = ctx
                    .http
                    .get(&url)
                    .header("xc-token", &token)
                    .header("Content-Type", "application/json")
                    .send()
                    .await?;
                json_or_err(res).await.map(|v| NodeOutput::single(vec![v]))
            }
            "create" => {
                let body = read_json(ctx, params, "data")?;
                let res = ctx
                    .http
                    .post(&records_url)
                    .header("xc-token", &token)
                    .header("Content-Type", "application/json")
                    .json(&body)
                    .send()
                    .await?;
                json_or_err(res).await.map(|v| NodeOutput::single(vec![v]))
            }
            "update" => {
                let record_id = substituted(ctx, params, "recordId")?;
                if record_id.is_empty() {
                    return Err(NodeError::MissingParameter("recordId".into()));
                }
                let data = read_json(ctx, params, "data")?;
                // NocoDB v2 expects an array of records with Id field for PATCH.
                let body = match data {
                    Value::Object(mut map) => {
                        // Inject Id (string form is accepted; numeric also fine).
                        if !map.contains_key("Id") && !map.contains_key("id") {
                            // Try to parse numeric, otherwise keep as string.
                            let id_val: Value = match record_id.parse::<i64>() {
                                Ok(n) => json!(n),
                                Err(_) => json!(record_id),
                            };
                            map.insert("Id".into(), id_val);
                        }
                        Value::Array(vec![Value::Object(map)])
                    }
                    Value::Array(arr) => Value::Array(arr),
                    other => {
                        return Err(NodeError::InvalidParameter {
                            name: "data".into(),
                            reason: format!(
                                "expected object or array, got {}",
                                value_type_name(&other)
                            ),
                        });
                    }
                };
                let res = ctx
                    .http
                    .patch(&records_url)
                    .header("xc-token", &token)
                    .header("Content-Type", "application/json")
                    .json(&body)
                    .send()
                    .await?;
                json_or_err(res).await.map(|v| NodeOutput::single(vec![v]))
            }
            "delete" => {
                let record_id = substituted(ctx, params, "recordId")?;
                if record_id.is_empty() {
                    return Err(NodeError::MissingParameter("recordId".into()));
                }
                let id_val: Value = match record_id.parse::<i64>() {
                    Ok(n) => json!(n),
                    Err(_) => json!(record_id),
                };
                let body = json!([{ "Id": id_val }]);
                let res = ctx
                    .http
                    .delete(&records_url)
                    .header("xc-token", &token)
                    .header("Content-Type", "application/json")
                    .json(&body)
                    .send()
                    .await?;
                json_or_err(res).await.map(|v| NodeOutput::single(vec![v]))
            }
            "count" => {
                let url = format!("{records_url}/count");
                let mut query: Vec<(String, String)> = Vec::new();
                if let Some(where_clause) = ctx.param_str_opt(params, "where") {
                    if !where_clause.is_empty() {
                        query.push(("where".into(), where_clause));
                    }
                }
                let res = ctx
                    .http
                    .get(&url)
                    .header("xc-token", &token)
                    .header("Content-Type", "application/json")
                    .query(&query)
                    .send()
                    .await?;
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

/// Read a JSON parameter. Accepts a JSON object/array directly or a JSON string
/// (which is `{{var}}`-substituted then parsed). Empty/null becomes an empty
/// object.
fn read_json(ctx: &ExecutionContext, params: &Value, key: &str) -> NodeResult<Value> {
    let value = params.get(key).cloned().unwrap_or(Value::Null);
    match value {
        Value::String(s) => {
            let sub = ctx.substitute(&s);
            let trimmed = sub.trim();
            if trimmed.is_empty() {
                Ok(Value::Object(Default::default()))
            } else {
                serde_json::from_str(trimmed).map_err(|e| NodeError::InvalidParameter {
                    name: key.into(),
                    reason: format!("not valid JSON: {e}"),
                })
            }
        }
        Value::Null => Ok(Value::Object(Default::default())),
        other => Ok(other),
    }
}

fn value_type_name(v: &Value) -> &'static str {
    match v {
        Value::Null => "null",
        Value::Bool(_) => "bool",
        Value::Number(_) => "number",
        Value::String(_) => "string",
        Value::Array(_) => "array",
        Value::Object(_) => "object",
    }
}

/// Percent-encode a single path segment.
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
