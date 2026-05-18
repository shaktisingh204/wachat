//! SabFlow executor — Rust candidate (Track B Phase 1 bench).
//!
//! Mirrors `node/server.js`: HTTP POST `/run` accepts
//!   { workflow: { node, expression, outputField }, items: [...] }
//! and returns
//!   { items: [...], elapsedMs: f64 }
//!
//! v1 supports the `$json.<field>.toUpperCase()` / `.toLowerCase()` /
//! passthrough expression shape. Anything else is rejected — see
//! `docs/adr/sabflow-executor-rust-bench.md` §3.
//!
//! This crate is standalone (its own `[workspace]` root in Cargo.toml) and is
//! NOT a member of `rust/Cargo.toml` workspace.

use std::net::SocketAddr;
use std::time::Instant;

use axum::{
    extract::Json,
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

#[derive(Debug, Deserialize)]
struct Workflow {
    node: String,
    expression: String,
    #[serde(default = "default_output_field")]
    #[serde(rename = "outputField")]
    output_field: String,
}

fn default_output_field() -> String {
    "out".to_string()
}

#[derive(Debug, Deserialize)]
struct RunRequest {
    workflow: Workflow,
    items: Vec<Value>,
}

#[derive(Debug, Serialize)]
struct RunResponse {
    items: Vec<Value>,
    #[serde(rename = "elapsedMs")]
    elapsed_ms: f64,
}

#[derive(Debug, Serialize)]
struct ErrorBody {
    error: String,
}

/// Compiled expression. Closes over the field name so the hot loop avoids
/// re-parsing per item.
enum CompiledExpr {
    Upper(String),
    Lower(String),
    Pass(String),
}

impl CompiledExpr {
    fn eval(&self, item: &Value) -> Value {
        match self {
            CompiledExpr::Upper(field) => match item.get(field) {
                Some(Value::String(s)) => Value::String(s.to_uppercase()),
                Some(other) => Value::String(value_to_string(other).to_uppercase()),
                None => Value::Null,
            },
            CompiledExpr::Lower(field) => match item.get(field) {
                Some(Value::String(s)) => Value::String(s.to_lowercase()),
                Some(other) => Value::String(value_to_string(other).to_lowercase()),
                None => Value::Null,
            },
            CompiledExpr::Pass(field) => item.get(field).cloned().unwrap_or(Value::Null),
        }
    }
}

fn value_to_string(v: &Value) -> String {
    match v {
        Value::String(s) => s.clone(),
        Value::Null => "null".to_string(),
        other => other.to_string(),
    }
}

/// v1 grammar:
///   $json.<field>.toUpperCase()
///   $json.<field>.toLowerCase()
///   $json.<field>
fn compile_expression(src: &str) -> Result<CompiledExpr, String> {
    let trimmed = src.trim();

    let body = trimmed
        .strip_prefix("$json.")
        .ok_or_else(|| format!("unsupported expression: {src}"))?;

    if let Some(field) = body.strip_suffix(".toUpperCase()") {
        validate_ident(field)?;
        return Ok(CompiledExpr::Upper(field.to_string()));
    }
    if let Some(field) = body.strip_suffix(".toLowerCase()") {
        validate_ident(field)?;
        return Ok(CompiledExpr::Lower(field.to_string()));
    }
    validate_ident(body)?;
    Ok(CompiledExpr::Pass(body.to_string()))
}

fn validate_ident(s: &str) -> Result<(), String> {
    if s.is_empty() {
        return Err("empty field name".to_string());
    }
    let mut chars = s.chars();
    let first = chars.next().unwrap();
    if !(first.is_ascii_alphabetic() || first == '_') {
        return Err(format!("invalid field name: {s}"));
    }
    for c in chars {
        if !(c.is_ascii_alphanumeric() || c == '_') {
            return Err(format!("invalid field name: {s}"));
        }
    }
    Ok(())
}

fn run_workflow(workflow: &Workflow, items: Vec<Value>) -> Result<Vec<Value>, String> {
    if workflow.node != "set" {
        return Err("only node=set is supported in v1".to_string());
    }
    let expr = compile_expression(&workflow.expression)?;
    let out_field = workflow.output_field.as_str();

    let mut out = Vec::with_capacity(items.len());
    for item in items.iter() {
        let mut next: Map<String, Value> = match item {
            Value::Object(map) => map.clone(),
            // Non-object items: wrap so the output has a consistent shape.
            other => {
                let mut m = Map::new();
                m.insert("_value".to_string(), other.clone());
                m
            }
        };
        next.insert(out_field.to_string(), expr.eval(item));
        out.push(Value::Object(next));
    }
    Ok(out)
}

async fn health() -> impl IntoResponse {
    Json(serde_json::json!({ "ok": true, "impl": "rust" }))
}

async fn run(Json(body): Json<RunRequest>) -> Result<Json<RunResponse>, (StatusCode, Json<ErrorBody>)> {
    let t0 = Instant::now();
    let items = run_workflow(&body.workflow, body.items).map_err(|err| {
        (StatusCode::BAD_REQUEST, Json(ErrorBody { error: err }))
    })?;
    let elapsed_ms = t0.elapsed().as_secs_f64() * 1000.0;
    Ok(Json(RunResponse { items, elapsed_ms }))
}

fn parse_port(args: &[String]) -> u16 {
    let mut iter = args.iter();
    while let Some(arg) = iter.next() {
        if arg == "--port" {
            if let Some(v) = iter.next() {
                if let Ok(p) = v.parse::<u16>() {
                    return p;
                }
            }
        }
    }
    7070
}

#[tokio::main]
async fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let port = parse_port(&args);

    let app: Router = Router::new()
        .route("/health", get(health))
        .route("/run", post(run));

    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("bind 127.0.0.1");

    // The driver greps stderr for "listening on" to know it's ready.
    eprintln!("sabflow-bench[rust] listening on {addr}");

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .expect("serve");
}

async fn shutdown_signal() {
    let _ = tokio::signal::ctrl_c().await;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compiles_upper() {
        let e = compile_expression("$json.foo.toUpperCase()").unwrap();
        let item = serde_json::json!({ "foo": "abc" });
        assert_eq!(e.eval(&item), Value::String("ABC".into()));
    }

    #[test]
    fn compiles_lower() {
        let e = compile_expression("$json.foo.toLowerCase()").unwrap();
        let item = serde_json::json!({ "foo": "ABC" });
        assert_eq!(e.eval(&item), Value::String("abc".into()));
    }

    #[test]
    fn compiles_pass() {
        let e = compile_expression("$json.foo").unwrap();
        let item = serde_json::json!({ "foo": "abc" });
        assert_eq!(e.eval(&item), Value::String("abc".into()));
    }

    #[test]
    fn rejects_unknown() {
        assert!(compile_expression("$json.foo.weird()").is_err());
        assert!(compile_expression("bogus").is_err());
    }

    #[test]
    fn run_workflow_writes_output_field() {
        let wf = Workflow {
            node: "set".into(),
            expression: "$json.foo.toUpperCase()".into(),
            output_field: "fooUpper".into(),
        };
        let items = vec![serde_json::json!({ "foo": "abc", "n": 1 })];
        let out = run_workflow(&wf, items).unwrap();
        assert_eq!(out[0]["fooUpper"], Value::String("ABC".into()));
        assert_eq!(out[0]["foo"], Value::String("abc".into()));
    }
}
