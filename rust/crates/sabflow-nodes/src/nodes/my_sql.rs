//! MySQL node.
//!
//! Uses `sqlx` (mysql + rustls) to run SQL against a `mysql://` connection
//! string supplied via the `mySqlDb` credential. Each execution opens a
//! single-connection pool that is closed when the call ends — no
//! cross-execution pool reuse (TODO: cache `MySqlPool` per credential id).
//!
//! Operations:
//!   - `executeQuery` — run raw SQL, return rows (SELECT) or `{affected, lastInsertId}` (DML)
//!   - `select`       — `SELECT {columns} FROM {table} [WHERE {where}]`
//!   - `insert`       — `INSERT INTO {table} ({cols}) VALUES (?, ?, …)`
//!   - `update`       — `UPDATE {table} SET ... WHERE {where}`
//!   - `delete`       — `DELETE FROM {table} WHERE {where}`
//!
//! Builder operations interpolate identifiers directly — callers must trust
//! the table name and WHERE clause. For untrusted input use `executeQuery`.
//!
//! MySQL has no `RETURNING *`, so INSERT/UPDATE/DELETE emit a single JSON
//! object describing rows affected (and last insert id for INSERT) instead.

use async_trait::async_trait;
use chrono::{DateTime, NaiveDate, NaiveDateTime, NaiveTime, Utc};
use serde_json::{Map, Value, json};
use sqlx::mysql::{MySqlPoolOptions, MySqlRow};
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

pub struct MySqlNode;

#[async_trait]
impl Node for MySqlNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "mySql",
            "MySQL",
            "Run SQL on MySQL / MariaDB",
            NodeCategory::Database,
        )
        .icon("database")
        .color("#4479A1")
        .credentials(vec![CredentialBinding {
            name: "mySqlDb".into(),
            display_name: "MySQL Connection".into(),
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
                .placeholder("SELECT * FROM users WHERE id = ?")
                .description("Raw SQL — use ? for placeholders (not yet bound)")
                .show_when("operation", &["executeQuery"]),
            NodeProperty::new("table", "Table", NodePropertyType::String)
                .placeholder("users")
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

        let pool = MySqlPoolOptions::new()
            .max_connections(1)
            .connect(&conn_str)
            .await
            .map_err(|e| NodeError::DatabaseError(format!("mysql connect: {e}")))?;

        let result: NodeResult<NodeOutput> = match operation.as_str() {
            "executeQuery" => {
                let sql = ctx.param_str(params, "query")?;
                run_query_or_exec(&pool, &sql, &[]).await
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
                    .map_err(|e| NodeError::DatabaseError(format!("mysql select: {e}")))?;
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
                for (k, v) in data.iter() {
                    cols.push(quote_ident(k));
                    placeholders.push("?".to_string());
                    values.push(v.clone());
                }
                let sql = format!(
                    "INSERT INTO {table} ({cols}) VALUES ({ph})",
                    table = table,
                    cols = cols.join(", "),
                    ph = placeholders.join(", "),
                );
                let mut q = sqlx::query(&sql);
                for v in &values {
                    q = bind_value(q, v);
                }
                let res = q
                    .execute(&pool)
                    .await
                    .map_err(|e| NodeError::DatabaseError(format!("mysql insert: {e}")))?;
                Ok(NodeOutput::single(vec![json!({
                    "affected": res.rows_affected(),
                    "lastInsertId": res.last_insert_id(),
                })]))
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
                for (k, v) in data.iter() {
                    set_parts.push(format!("{} = ?", quote_ident(k)));
                    values.push(v.clone());
                }
                let sql = format!(
                    "UPDATE {table} SET {sets} WHERE {wh}",
                    table = table,
                    sets = set_parts.join(", "),
                    wh = where_clause,
                );
                let mut q = sqlx::query(&sql);
                for v in &values {
                    q = bind_value(q, v);
                }
                let res = q
                    .execute(&pool)
                    .await
                    .map_err(|e| NodeError::DatabaseError(format!("mysql update: {e}")))?;
                Ok(NodeOutput::single(vec![json!({
                    "affected": res.rows_affected(),
                })]))
            }
            "delete" => {
                let table = ctx.param_str(params, "table")?;
                let where_clause = ctx
                    .param_str_opt(params, "where")
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .ok_or_else(|| NodeError::MissingParameter("where".into()))?;
                let sql = format!(
                    "DELETE FROM {table} WHERE {wh}",
                    table = table,
                    wh = where_clause,
                );
                let res = sqlx::query(&sql)
                    .execute(&pool)
                    .await
                    .map_err(|e| NodeError::DatabaseError(format!("mysql delete: {e}")))?;
                Ok(NodeOutput::single(vec![json!({
                    "affected": res.rows_affected(),
                })]))
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

/// Run a raw SQL statement. We try `fetch_all` first; if the statement is a
/// non-result-set query (INSERT/UPDATE/DELETE), MySQL returns zero columns and
/// we instead emit an `{affected, lastInsertId}` summary object.
async fn run_query_or_exec(
    pool: &sqlx::MySqlPool,
    sql: &str,
    _binds: &[Value],
) -> NodeResult<NodeOutput> {
    // Heuristic: a SELECT/SHOW/DESCRIBE/EXPLAIN/WITH returns rows; anything
    // else is treated as a statement.
    let trimmed = sql.trim_start();
    let head = trimmed
        .split_whitespace()
        .next()
        .map(|s| s.to_ascii_uppercase())
        .unwrap_or_default();
    let is_query = matches!(
        head.as_str(),
        "SELECT" | "SHOW" | "DESCRIBE" | "DESC" | "EXPLAIN" | "WITH" | "TABLE" | "VALUES"
    );

    if is_query {
        let rows = sqlx::query(sql)
            .fetch_all(pool)
            .await
            .map_err(|e| NodeError::DatabaseError(format!("mysql query: {e}")))?;
        Ok(NodeOutput::single(rows_to_json(&rows)?))
    } else {
        let res = sqlx::query(sql)
            .execute(pool)
            .await
            .map_err(|e| NodeError::DatabaseError(format!("mysql exec: {e}")))?;
        Ok(NodeOutput::single(vec![json!({
            "affected": res.rows_affected(),
            "lastInsertId": res.last_insert_id(),
        })]))
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

/// Quote a MySQL identifier (column or table name) with backticks, escaping
/// any embedded backticks.
fn quote_ident(s: &str) -> String {
    let escaped = s.replace('`', "``");
    format!("`{escaped}`")
}

/// Bind a `serde_json::Value` to a sqlx query as the next placeholder.
fn bind_value<'q>(
    q: sqlx::query::Query<'q, sqlx::MySql, sqlx::mysql::MySqlArguments>,
    v: &Value,
) -> sqlx::query::Query<'q, sqlx::MySql, sqlx::mysql::MySqlArguments> {
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
        // MySQL `JSON` columns accept stringified JSON; sqlx::types::Json also
        // works for `JSON` columns. Use a plain string for the broadest fit.
        Value::Array(_) | Value::Object(_) => q.bind(v.to_string()),
    }
}

/// Convert a slice of `MySqlRow` to a vec of JSON objects.
fn rows_to_json(rows: &[MySqlRow]) -> NodeResult<Vec<Value>> {
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

/// Dispatch on MySQL type name to extract the column at index `i` as JSON.
/// Falls back to fetching the column as `String` (then `null` on failure).
fn column_value(row: &MySqlRow, i: usize, type_name: &str) -> NodeResult<Value> {
    // Type names from sqlx-mysql are upper-case, e.g. "VARCHAR", "INT", "BIGINT".
    let v = match type_name {
        "BOOLEAN" | "BOOL" => row
            .try_get::<Option<bool>, _>(i)
            .ok()
            .flatten()
            .map(Value::Bool),
        "TINYINT" => row
            .try_get::<Option<i8>, _>(i)
            .ok()
            .flatten()
            .map(|n| json!(n)),
        "SMALLINT" => row
            .try_get::<Option<i16>, _>(i)
            .ok()
            .flatten()
            .map(|n| json!(n)),
        "INT" | "MEDIUMINT" => row
            .try_get::<Option<i32>, _>(i)
            .ok()
            .flatten()
            .map(|n| json!(n)),
        "BIGINT" => row
            .try_get::<Option<i64>, _>(i)
            .ok()
            .flatten()
            .map(|n| json!(n)),
        "TINYINT UNSIGNED" => row
            .try_get::<Option<u8>, _>(i)
            .ok()
            .flatten()
            .map(|n| json!(n)),
        "SMALLINT UNSIGNED" => row
            .try_get::<Option<u16>, _>(i)
            .ok()
            .flatten()
            .map(|n| json!(n)),
        "INT UNSIGNED" | "MEDIUMINT UNSIGNED" => row
            .try_get::<Option<u32>, _>(i)
            .ok()
            .flatten()
            .map(|n| json!(n)),
        "BIGINT UNSIGNED" => row
            .try_get::<Option<u64>, _>(i)
            .ok()
            .flatten()
            .map(|n| json!(n)),
        "FLOAT" => row
            .try_get::<Option<f32>, _>(i)
            .ok()
            .flatten()
            .map(|n| json!(n)),
        "DOUBLE" => row
            .try_get::<Option<f64>, _>(i)
            .ok()
            .flatten()
            .map(|n| json!(n)),
        "VARCHAR" | "CHAR" | "TEXT" | "TINYTEXT" | "MEDIUMTEXT" | "LONGTEXT" | "ENUM" | "SET" => {
            row.try_get::<Option<String>, _>(i)
                .ok()
                .flatten()
                .map(Value::String)
        }
        "JSON" => row
            .try_get::<Option<sqlx::types::Json<Value>>, _>(i)
            .ok()
            .flatten()
            .map(|j| j.0)
            .or_else(|| {
                row.try_get::<Option<String>, _>(i)
                    .ok()
                    .flatten()
                    .and_then(|s| serde_json::from_str::<Value>(&s).ok())
            }),
        "TIMESTAMP" => row
            .try_get::<Option<DateTime<Utc>>, _>(i)
            .ok()
            .flatten()
            .map(|t| Value::String(t.to_rfc3339()))
            .or_else(|| {
                row.try_get::<Option<NaiveDateTime>, _>(i)
                    .ok()
                    .flatten()
                    .map(|t| Value::String(t.to_string()))
            }),
        "DATETIME" => row
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
        "DECIMAL" | "NUMERIC" => row
            .try_get::<Option<String>, _>(i)
            .ok()
            .flatten()
            .map(Value::String),
        "BINARY" | "VARBINARY" | "BLOB" | "TINYBLOB" | "MEDIUMBLOB" | "LONGBLOB" => row
            .try_get::<Option<Vec<u8>>, _>(i)
            .ok()
            .flatten()
            .map(|b| {
                use base64::Engine;
                Value::String(base64::engine::general_purpose::STANDARD.encode(&b))
            }),
        _ => None,
    };

    if let Some(value) = v {
        return Ok(value);
    }

    // Fallback: try a string conversion, otherwise emit null.
    let as_str: Option<String> = row.try_get::<Option<String>, _>(i).ok().flatten();
    Ok(match as_str {
        Some(s) => Value::String(s),
        None => Value::Null,
    })
}
