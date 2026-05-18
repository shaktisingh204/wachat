//! Qdrant node.
//!
//! Implements upsert / search / delete / retrieve operations against the
//! Qdrant REST API (https://qdrant.tech/documentation/concepts/points/).
//! Authenticates with the `api-key` header supplied via the `qdrantApi`
//! credential (`apiKey` field) — works for both Qdrant Cloud and self-hosted
//! deployments. The `url` parameter points at the Qdrant base (e.g.
//! `https://xxxxx.eu-central.aws.cloud.qdrant.io:6333`).

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

pub struct QdrantNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for QdrantNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "qdrant",
            "Qdrant",
            "Qdrant vector database — upsert, search, retrieve, delete",
            NodeCategory::Database,
        )
        .icon("database")
        .color("#DC382D")
        .credentials(vec![CredentialBinding {
            name: "qdrantApi".into(),
            display_name: "Qdrant API Key".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("url", "Qdrant Base URL", NodePropertyType::String)
                .placeholder("https://xxxxx.eu-central.aws.cloud.qdrant.io:6333")
                .required()
                .description("Base URL of the Qdrant cluster (no trailing /collections)"),
            NodeProperty::new("collection", "Collection", NodePropertyType::String)
                .required()
                .description("Target collection name"),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Upsert Points", "upsert"),
                    opt("Search Points", "search"),
                    opt("Retrieve Points", "retrieve"),
                    opt("Delete Points", "delete"),
                    opt("Get Collection Info", "info"),
                ])
                .default(json!("search"))
                .required(),
            // upsert
            NodeProperty::new("points", "Points", NodePropertyType::Json)
                .show_when("operation", &["upsert"])
                .description("JSON array of { id, vector, payload? }"),
            NodeProperty::new("wait", "Wait for Index", NodePropertyType::Boolean)
                .default(json!(true))
                .show_when("operation", &["upsert", "delete"]),
            // search
            NodeProperty::new("vector", "Query Vector", NodePropertyType::Json)
                .show_when("operation", &["search"])
                .description("JSON array of floats (embedding to query against)"),
            NodeProperty::new("limit", "Limit", NodePropertyType::Number)
                .default(json!(10))
                .show_when("operation", &["search"]),
            NodeProperty::new("filter", "Filter", NodePropertyType::Json)
                .show_when("operation", &["search"])
                .description("Optional Qdrant filter (JSON object)"),
            NodeProperty::new("withPayload", "With Payload", NodePropertyType::Boolean)
                .default(json!(true))
                .show_when("operation", &["search", "retrieve"]),
            NodeProperty::new("withVector", "With Vector", NodePropertyType::Boolean)
                .default(json!(false))
                .show_when("operation", &["search", "retrieve"]),
            NodeProperty::new("scoreThreshold", "Score Threshold", NodePropertyType::Number)
                .show_when("operation", &["search"]),
            // retrieve / delete by id
            NodeProperty::new("ids", "Point IDs", NodePropertyType::Json)
                .show_when("operation", &["retrieve", "delete"])
                .description("JSON array of point IDs (string or number)"),
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

        let raw_url = ctx.param_str(params, "url")?;
        let base = ctx.substitute(&raw_url);
        let base = base.trim_end_matches('/').to_string();
        if base.is_empty() {
            return Err(NodeError::MissingParameter("url".into()));
        }

        let collection = ctx.param_str(params, "collection")?;
        let operation = ctx.param_str(params, "operation")?;

        let body: Value = match operation.as_str() {
            "upsert" => {
                let points = parse_json_param(ctx, params, "points")
                    .unwrap_or_else(|| Value::Array(vec![]));
                let wait = ctx.param_bool(params, "wait", true);
                let url = format!(
                    "{base}/collections/{collection}/points?wait={wait}",
                    base = base,
                    collection = collection,
                    wait = wait
                );
                let payload = json!({ "points": points });
                qdrant_send(ctx, reqwest::Method::PUT, &url, &api_key, Some(payload)).await?
            }
            "search" => {
                let vector = parse_json_param(ctx, params, "vector")
                    .unwrap_or_else(|| Value::Array(vec![]));
                let limit = ctx.param_f64(params, "limit").unwrap_or(10.0) as i64;
                let with_payload = ctx.param_bool(params, "withPayload", true);
                let with_vector = ctx.param_bool(params, "withVector", false);
                let mut payload = Map::new();
                payload.insert("vector".into(), vector);
                payload.insert("limit".into(), json!(limit));
                payload.insert("with_payload".into(), json!(with_payload));
                payload.insert("with_vector".into(), json!(with_vector));
                if let Some(filter) = parse_json_param(ctx, params, "filter") {
                    payload.insert("filter".into(), filter);
                }
                if let Some(threshold) = ctx.param_f64(params, "scoreThreshold") {
                    payload.insert("score_threshold".into(), json!(threshold));
                }
                let url = format!("{base}/collections/{collection}/points/search");
                qdrant_send(
                    ctx,
                    reqwest::Method::POST,
                    &url,
                    &api_key,
                    Some(Value::Object(payload)),
                )
                .await?
            }
            "retrieve" => {
                let ids = parse_json_param(ctx, params, "ids")
                    .unwrap_or_else(|| Value::Array(vec![]));
                let with_payload = ctx.param_bool(params, "withPayload", true);
                let with_vector = ctx.param_bool(params, "withVector", false);
                let payload = json!({
                    "ids": ids,
                    "with_payload": with_payload,
                    "with_vector": with_vector,
                });
                let url = format!("{base}/collections/{collection}/points");
                qdrant_send(ctx, reqwest::Method::POST, &url, &api_key, Some(payload)).await?
            }
            "delete" => {
                let ids = parse_json_param(ctx, params, "ids")
                    .unwrap_or_else(|| Value::Array(vec![]));
                let wait = ctx.param_bool(params, "wait", true);
                let payload = json!({ "points": ids });
                let url = format!(
                    "{base}/collections/{collection}/points/delete?wait={wait}",
                    base = base,
                    collection = collection,
                    wait = wait
                );
                qdrant_send(ctx, reqwest::Method::POST, &url, &api_key, Some(payload)).await?
            }
            "info" => {
                let url = format!("{base}/collections/{collection}");
                qdrant_send(ctx, reqwest::Method::GET, &url, &api_key, None).await?
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

async fn qdrant_send(
    ctx: &ExecutionContext,
    method: reqwest::Method,
    url: &str,
    api_key: &str,
    payload: Option<Value>,
) -> NodeResult<Value> {
    let mut req = ctx
        .http
        .request(method, url)
        .header("api-key", api_key)
        .header("accept", "application/json");
    if let Some(body) = payload {
        req = req.json(&body);
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
