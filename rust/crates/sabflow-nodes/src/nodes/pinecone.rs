//! Pinecone node.
//!
//! Implements upsert / query / fetch / delete operations against the Pinecone
//! Data Plane REST API. Pinecone serverless / pod indexes each expose a unique
//! host URL of the form `https://{index}-{project}.svc.{region}.pinecone.io`;
//! this node treats `host` as the index endpoint base and authenticates with the
//! `Api-Key` header supplied via the `pineconeApi` credential (`apiKey` field).
//!
//! Reference: https://docs.pinecone.io/reference/data-plane

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

pub struct PineconeNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for PineconeNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "pinecone",
            "Pinecone",
            "Pinecone vector database — upsert, query, fetch, delete",
            NodeCategory::Database,
        )
        .icon("database")
        .color("#1F1F1F")
        .credentials(vec![CredentialBinding {
            name: "pineconeApi".into(),
            display_name: "Pinecone API Key".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("host", "Index Host URL", NodePropertyType::String)
                .placeholder("https://my-index-abcd.svc.us-east-1-aws.pinecone.io")
                .required()
                .description("Full HTTPS host URL of the Pinecone index (from index dashboard)"),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Upsert Vectors", "upsert"),
                    opt("Query Vectors", "query"),
                    opt("Fetch Vectors", "fetch"),
                    opt("Delete Vectors", "delete"),
                    opt("Describe Index Stats", "describeStats"),
                ])
                .default(json!("query"))
                .required(),
            NodeProperty::new("namespace", "Namespace", NodePropertyType::String)
                .description("Optional namespace within the index"),
            // upsert
            NodeProperty::new("vectors", "Vectors", NodePropertyType::Json)
                .show_when("operation", &["upsert"])
                .description("JSON array of { id, values, metadata? }"),
            // query
            NodeProperty::new("vector", "Query Vector", NodePropertyType::Json)
                .show_when("operation", &["query"])
                .description("JSON array of floats (embedding to query against)"),
            NodeProperty::new("topK", "Top K", NodePropertyType::Number)
                .default(json!(10))
                .show_when("operation", &["query"]),
            NodeProperty::new("filter", "Filter", NodePropertyType::Json)
                .show_when("operation", &["query"])
                .description("Optional metadata filter (JSON object)"),
            NodeProperty::new(
                "includeMetadata",
                "Include Metadata",
                NodePropertyType::Boolean,
            )
            .default(json!(true))
            .show_when("operation", &["query"]),
            NodeProperty::new("includeValues", "Include Values", NodePropertyType::Boolean)
                .default(json!(false))
                .show_when("operation", &["query"]),
            // fetch / delete (by id)
            NodeProperty::new("ids", "Vector IDs", NodePropertyType::Json)
                .show_when("operation", &["fetch", "delete"])
                .description("JSON array of vector ID strings"),
            NodeProperty::new("deleteAll", "Delete All", NodePropertyType::Boolean)
                .default(json!(false))
                .show_when("operation", &["delete"])
                .description("If true, deletes ALL vectors in the namespace"),
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
        let api_key = cred
            .data
            .get("apiKey")
            .ok_or_else(|| NodeError::MissingParameter("apiKey".into()))?
            .clone();

        let raw_host = ctx.param_str(params, "host")?;
        let host = ctx.substitute(&raw_host);
        let host = host.trim_end_matches('/').to_string();
        if host.is_empty() {
            return Err(NodeError::MissingParameter("host".into()));
        }

        let operation = ctx.param_str(params, "operation")?;
        let namespace = ctx
            .param_str_opt(params, "namespace")
            .filter(|s| !s.trim().is_empty());

        let body: Value = match operation.as_str() {
            "upsert" => {
                let vectors = parse_json_param(ctx, params, "vectors")
                    .unwrap_or_else(|| Value::Array(vec![]));
                let mut payload = Map::new();
                payload.insert("vectors".into(), vectors);
                if let Some(ns) = namespace {
                    payload.insert("namespace".into(), json!(ns));
                }
                pinecone_post(ctx, &host, &api_key, "vectors/upsert", Value::Object(payload))
                    .await?
            }
            "query" => {
                let vector = parse_json_param(ctx, params, "vector")
                    .unwrap_or_else(|| Value::Array(vec![]));
                let top_k = ctx.param_f64(params, "topK").unwrap_or(10.0) as i64;
                let include_metadata = ctx.param_bool(params, "includeMetadata", true);
                let include_values = ctx.param_bool(params, "includeValues", false);
                let filter = parse_json_param(ctx, params, "filter");

                let mut payload = Map::new();
                payload.insert("vector".into(), vector);
                payload.insert("topK".into(), json!(top_k));
                payload.insert("includeMetadata".into(), json!(include_metadata));
                payload.insert("includeValues".into(), json!(include_values));
                if let Some(ns) = namespace {
                    payload.insert("namespace".into(), json!(ns));
                }
                if let Some(f) = filter {
                    payload.insert("filter".into(), f);
                }
                pinecone_post(ctx, &host, &api_key, "query", Value::Object(payload)).await?
            }
            "fetch" => {
                let ids = parse_json_param(ctx, params, "ids")
                    .unwrap_or_else(|| Value::Array(vec![]));
                // Pinecone fetch is a GET with repeated `ids=` query params.
                let id_list: Vec<String> = match ids {
                    Value::Array(arr) => arr
                        .into_iter()
                        .filter_map(|v| v.as_str().map(|s| s.to_string()))
                        .collect(),
                    _ => vec![],
                };
                let url = format!("{host}/vectors/fetch");
                let mut req = ctx
                    .http
                    .get(&url)
                    .header("Api-Key", &api_key)
                    .header("accept", "application/json");
                let pairs: Vec<(String, String)> =
                    id_list.iter().map(|id| ("ids".to_string(), id.clone())).collect();
                if !pairs.is_empty() {
                    req = req.query(&pairs);
                }
                if let Some(ns) = &namespace {
                    req = req.query(&[("namespace", ns.as_str())]);
                }
                let res = req.send().await?;
                let status = res.status();
                let body: Value = res.json().await.unwrap_or(Value::Null);
                if !status.is_success() {
                    return Err(NodeError::UpstreamError {
                        status: status.as_u16(),
                        body: body.to_string(),
                    });
                }
                body
            }
            "delete" => {
                let mut payload = Map::new();
                if ctx.param_bool(params, "deleteAll", false) {
                    payload.insert("deleteAll".into(), json!(true));
                } else if let Some(ids) = parse_json_param(ctx, params, "ids") {
                    payload.insert("ids".into(), ids);
                }
                if let Some(ns) = namespace {
                    payload.insert("namespace".into(), json!(ns));
                }
                pinecone_post(ctx, &host, &api_key, "vectors/delete", Value::Object(payload))
                    .await?
            }
            "describeStats" => {
                pinecone_post(
                    ctx,
                    &host,
                    &api_key,
                    "describe_index_stats",
                    Value::Object(Map::new()),
                )
                .await?
            }
            other => {
                return Err(NodeError::InvalidParameter {
                    name: "operation".into(),
                    reason: format!("unknown operation: {other}"),
                });
            }
        };

        Ok(NodeOutput::single(vec![body]))
    }
}

async fn pinecone_post(
    ctx: &ExecutionContext,
    host: &str,
    api_key: &str,
    endpoint: &str,
    payload: Value,
) -> NodeResult<Value> {
    let url = format!("{host}/{endpoint}");
    let res = ctx
        .http
        .post(&url)
        .header("Api-Key", api_key)
        .header("accept", "application/json")
        .json(&payload)
        .send()
        .await?;
    let status = res.status();
    let body: Value = res.json().await.unwrap_or(Value::Null);
    if !status.is_success() {
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: body.to_string(),
        });
    }
    Ok(body)
}

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
