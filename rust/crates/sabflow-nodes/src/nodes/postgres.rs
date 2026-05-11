//! Postgres node.
//!
//! Uses `sqlx` (postgres + rustls) to run SQL against an arbitrary connection
//! string. Each execution opens a single connection (via `PgPool::connect` with
//! `max_connections = 1`) and returns it to drop when the call ends — there is
//! no cross-execution pool reuse (TODO: cache `PgPool` per credential id).
//!
//! Operations:
//!   - `executeQuery` — run raw SQL, return rows
//!   - `select`       — `SELECT {columns} FROM {table} [WHERE {where}]`
//!   - `insert`       — `INSERT INTO {table} ({cols}) VALUES (...) RETURNING *`
//!   - `update`       — `UPDATE {table} SET ... WHERE {where} RETURNING *`
//!   - `delete`       — `DELETE FROM {table} WHERE {where} RETURNING *`
//!
//! Builder-style operations (insert/update/delete/select) build the SQL string
//! by interpolating identifiers directly — callers must trust the table name
//! and WHERE clause. For untrusted input use `executeQuery` with `$1, $2, ...`
//! placeholders (raw SQL only, no bound params via the descriptor yet — TODO).
//!
//! Row → JSON: we use `sqlx::Column::type_info()` to dispatch the right typed
//! `try_get` and fall back to text for unknown types. NULLs become `null`.

use async_trait::async_trait;
use chrono::{DateTime, NaiveDate, NaiveDateTime, NaiveTime, Utc};
use serde_json::{Map, Value, json};
use sqlx::postgres::{PgPoolOptions, PgRow};
use sqlx::{Column, Row, TypeInfo};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{
        CredentialBinding, NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption,
        NodePropertyType,
    },
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct PostgresNode;

#[async_trait]
impl Node for PostgresNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "postgres",
            "Postgres",
            "Run SQL on PostgreSQL",
            NodeCategory::Database,
        )
        .icon("database")
        .color("#336791")
        .credentials(vec![CredentialBinding {
            name: "postgresDb".into(),
            display_name: "Postgres Connection".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "Execute Query".into(),
                        value: json!("executeQuery"),
                        description: Some("Run raw SQL".into()),
                    },
                    NodePropertyOption {
                        name: "Select".into(),
                        value: json!("select"),
                        description: Some("SELECT columns from table".into()),
                    },
                    NodePropertyOption {
                        name: "Insert".into(),
                        value: json!("insert"),
                        description: Some("INSERT row built from a JSON field map".into()),
                    },
                    NodePropertyOption {
                        name: "Update".into(),
                        value: json!("update"),
                        description: Some("UPDATE row(s) matching WHERE clause".into()),
                    },
                    NodePropertyOption {
                        name: "Delete".into(),
                        value: json!("delete"),
                        description: Some("DELETE row(s) matching WHERE clause".into()),
                    },
                ])
                .default(json!("executeQuery"))
                .required(),
            NodeProperty::new("query", "Query", NodePropertyType::String)
                .placeholder("SELECT * FROM users WHERE id = $1")
                .description("Raw SQL — use $1, $2, … for placeholders (not yet bound)")
                .show_when("operation", &["executeQuery"]),
            NodeProperty::new("table", "Table", NodePropertyType::String)
                .placeholder("public.users")
                .show_when("operation", &["insert", "update", "delete", "select"]),
            NodeProperty::new("data", "Data", NodePropertyType::Json)
                .description("Field → value map for INSERT / UPDATE")
                .default(json!({}))
                .show_when("operation", &["insert", "update"]),
            NodeProperty::new("where", "WHERE Clause", NodePropertyType::String)
                .placeholder("id = 1")
                .description("Raw WHERE clause without the WHERE keyword")
                .show_when("operation", &["update", "delete", "select"]),
            NodeProperty::new("columns", "Columns", NodePropertyType::String)
                .default(json!("*"))
                .placeholder("id, name, email")
                .description("Comma-separated columns for SELECT")
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
        let conn_str = cred
            .data
            .get("connectionString")
            .ok_or_else(|| NodeError::MissingParameter("connectionString".into()))?
            .clone();

        let operation = ctx.param_str(params, "operation")?;

        // One short-lived pool per execution. `max_connections(1)` keeps the
        // open file-descriptor footprint tight when many node instances run
        // concurrently. TODO: cache pools per credential id at engine level.
        let pool = PgPoolOptions::new()
            .max_connections(1)
            .connect(&conn_str)
            .await
            .map_err(|e| NodeError::DatabaseError(format!("postgres connect: {e}")))?;

        let result: NodeResult<NodeOutput> = match operation.as_str() {
            "executeQuery" => {
                let sql = ctx.param_str(params, "query")?;
                let rows = sqlx::query(&sql)
                    .fetch_all(&pool)
                    .await
                    .map_err(|e| NodeError::DatabaseError(format!("postgres query: {e}")))?;
                Ok(NodeOutput::single(rows_to_json(&rows)?))
            }
            "select" => {
                let table = ctx.param_str(params, "table")?;
                let cols = ctx
                    .param_str_opt(params, "columns")
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .unwrap_or_else(|| "*".to_string());
                let where_clause = ctx
                    .param_str_opt(params, "where")
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty());
                let sql = match where_clause {
                    Some(w) => format!(
                        "SELECT {cols} FROM {table} WHERE {w}",
                        cols = cols,
                        table = table,
                        w = w
                    ),
                    None => format!("SELECT {cols} FROM {table}", cols = cols, table = table),
                };
                let rows = sqlx::query(&sql)
                    .fetch_all(&pool)
                    .await
                    .map_err(|e| NodeError::DatabaseError(format!("postgres select: {e}")))?;
                Ok(NodeOutput::single(rows_to_json(&rows)?))
            }
            "insert" => {
                let table = ctx.param_str(params, "table")?;
                let data = read_object(ctx, params, "data")?;
                if data.is_empty() {
                    return Err(NodeError::InvalidParameter {
                        name: "data".into(),
                        reason: "no fields to insert".into(),
                    });
                }
                let mut cols: Vec<String> = Vec::with_capacity(data.len());
                let mut placeholders: Vec<String> = Vec::with_capacity(data.len());
                let mut values: Vec<Value> = Vec::with_capacity(data.len());
                for (i, (k, v)) in data.iter().enumerate() {
                    cols.push(quote_ident(k));
                    placeholders.push(format!("${}", i + 1));
                    values.push(v.clone());
                }
                let sql = format!(
                    "INSERT INTO {table} ({cols}) VALUES ({ph}) RETURNING *",
                    table = table,
                    cols = cols.join(", "),
                    ph = placeholders.join(", "),
                );
                let mut q = sqlx::query(&sql);
                for v in &values {
                    q = bind_value(q, v);
                }
                let rows = q
                    .fetch_all(&pool)
                    .await
                    .map_err(|e| NodeError::DatabaseError(format!("postgres insert: {e}")))?;
                Ok(NodeOutput::single(rows_to_json(&rows)?))
            }
            "update" => {
                let table = ctx.param_str(params, "table")?;
                let data = read_object(ctx, params, "data")?;
                if data.is_empty() {
                    return Err(NodeError::InvalidParameter {
                        name: "data".into(),
                        reason: "no fields to update".into(),
                    });
                }
                let where_clause = ctx
                    .param_str_opt(params, "where")
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .ok_or_else(|| NodeError::MissingParameter("where".into()))?;
                let mut set_parts: Vec<String> = Vec::with_capacity(data.len());
                let mut values: Vec<Value> = Vec::with_capacity(data.len());
                for (i, (k, v)) in data.iter().enumerate() {
                    set_parts.push(format!("{} = ${}", quote_ident(k), i + 1));
                    values.push(v.clone());
                }
                let sql = format!(
                    "UPDATE {table} SET {sets} WHERE {wh} RETURNING *",
                    table = table,
                    sets = set_parts.join(", "),
                    wh = where_clause,
                );
                let mut q = sqlx::query(&sql);
                for v in &values {
                    q = bind_value(q, v);
                }
                let rows = q
                    .fetch_all(&pool)
                    .await
                    .map_err(|e| NodeError::DatabaseError(format!("postgres update: {e}")))?;
                Ok(NodeOutput::single(rows_to_json(&rows)?))
            }
            "delete" => {
                let table = ctx.param_str(params, "table")?;
                let where_clause = ctx
                    .param_str_opt(params, "where")
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .ok_or_else(|| NodeError::MissingParameter("where".into()))?;
                let sql = format!(
                    "DELETE FROM {table} WHERE {wh} RETURNING *",
                    table = table,
                    wh = where_clause,
                );
                let rows = sqlx::query(&sql)
                    .fetch_all(&pool)
                    .await
                    .map_err(|e| NodeError::DatabaseError(format!("postgres delete: {e}")))?;
                Ok(NodeOutput::single(rows_to_json(&rows)?))
            }
            other => Err(NodeError::InvalidParameter {
                name: "operation".into(),
                reason: format!("unknown operation: {other}"),
            }),
        };

        pool.close().await;
        result
    }
}

/// Read a JSON object parameter (or JSON-encoded string of one).
fn read_object(
    ctx: &ExecutionContext,
    params: &Value,
    key: &str,
) -> NodeResult<Map<String, Value>> {
    let raw = params.get(key).cloned().unwrap_or(Value::Null);
    let parsed: Value = match raw {
        Value::String(s) => {
            let sub = ctx.substitute(&s);
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
        other => other,
    };
    match parsed {
        Value::Object(map) => Ok(map),
        _ => Err(NodeError::InvalidParameter {
            name: key.into(),
            reason: "must be a JSON object".into(),
        }),
    }
}

/// Quote a SQL identifier (column or table name) by wrapping in double quotes
/// and escaping any embedded double quotes.
fn quote_ident(s: &str) -> String {
    let escaped = s.replace('"', "\"\"");
    format!("\"{escaped}\"")
}

/// Bind a `serde_json::Value` to a sqlx query as the next placeholder.
fn bind_value<'q>(
    q: sqlx::query::Query<'q, sqlx::Postgres, sqlx::postgres::PgArguments>,
    v: &Value,
) -> sqlx::query::Query<'q, sqlx::Postgres, sqlx::postgres::PgArguments> {
    match v {
        Value::Null => q.bind(None::<String>),
        Value::Bool(b) => q.bind(*b),
        Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                q.bind(i)
            } else if let Some(f) = n.as_f64() {
                q.bind(f)
            } else {
                q.bind(n.to_string())
            }
        }
        Value::String(s) => q.bind(s.clone()),
        // Arrays and objects round-trip as JSON — Postgres will accept this
        // for `json`/`jsonb` columns and for text columns (as a string).
        Value::Array(_) | Value::Object(_) => q.bind(sqlx::types::Json(v.clone())),
    }
}

/// Convert a slice of `PgRow` to a vec of JSON objects.
fn rows_to_json(rows: &[PgRow]) -> NodeResult<Vec<Value>> {
    let mut out = Vec::with_capacity(rows.len());
    for row in rows {
        let mut obj = Map::new();
        for (i, col) in row.columns().iter().enumerate() {
            let name = col.name().to_string();
            let v = column_value(row, i, col.type_info().name())?;
            obj.insert(name, v);
        }
        out.push(Value::Object(obj));
    }
    Ok(out)
}

/// Dispatch on Postgres type name to extract the column at index `i` as JSON.
/// Falls back to fetching the column as `String` (then as `null` on failure).
fn column_value(row: &PgRow, i: usize, type_name: &str) -> NodeResult<Value> {
    // Try integer-ish first to avoid accidentally stringifying numbers.
    let v = match type_name {
        "BOOL" => row
            .try_get::<Option<bool>, _>(i)
            .ok()
            .flatten()
            .map(Value::Bool),
        "INT2" => row
            .try_get::<Option<i16>, _>(i)
            .ok()
            .flatten()
            .map(|n| json!(n)),
        "INT4" => row
            .try_get::<Option<i32>, _>(i)
            .ok()
            .flatten()
            .map(|n| json!(n)),
        "INT8" => row
            .try_get::<Option<i64>, _>(i)
            .ok()
            .flatten()
            .map(|n| json!(n)),
        "FLOAT4" => row
            .try_get::<Option<f32>, _>(i)
            .ok()
            .flatten()
            .map(|n| json!(n)),
        "FLOAT8" => row
            .try_get::<Option<f64>, _>(i)
            .ok()
            .flatten()
            .map(|n| json!(n)),
        "TEXT" | "VARCHAR" | "BPCHAR" | "NAME" | "CITEXT" | "UUID" => row
            .try_get::<Option<String>, _>(i)
            .ok()
            .flatten()
            .map(Value::String),
        "JSON" | "JSONB" => row
            .try_get::<Option<sqlx::types::Json<Value>>, _>(i)
            .ok()
            .flatten()
            .map(|j| j.0),
        "TIMESTAMPTZ" => row
            .try_get::<Option<DateTime<Utc>>, _>(i)
            .ok()
            .flatten()
            .map(|t| Value::String(t.to_rfc3339())),
        "TIMESTAMP" => row
            .try_get::<Option<NaiveDateTime>, _>(i)
            .ok()
            .flatten()
            .map(|t| Value::String(t.to_string())),
        "DATE" => row
            .try_get::<Option<NaiveDate>, _>(i)
            .ok()
            .flatten()
            .map(|t| Value::String(t.to_string())),
        "TIME" => row
            .try_get::<Option<NaiveTime>, _>(i)
            .ok()
            .flatten()
            .map(|t| Value::String(t.to_string())),
        _ => None,
    };

    if let Some(value) = v {
        return Ok(value);
    }

    // Fallback: try a string conversion, otherwise emit null. Some Postgres
    // types (arrays, custom domains) won't decode here — surfacing them as
    // null is friendlier than failing the whole row.
    let as_str: Option<String> = row.try_get::<Option<String>, _>(i).ok().flatten();
    Ok(match as_str {
        Some(s) => Value::String(s),
        None => Value::Null,
    })
}
