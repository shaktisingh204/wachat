//! Jina AI node.
//!
//! Implements embeddings and reranking operations against the Jina AI REST API
//! (https://api.jina.ai/v1). Authenticates with a bearer token supplied via the
//! `jinaAiApi` credential (`apiKey` field).

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

pub struct JinaAiNode;

const JINA_API_BASE: &str = "https://api.jina.ai/v1";

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for JinaAiNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "jinaAi",
            "Jina AI",
            "Jina AI embeddings and reranking",
            NodeCategory::Ai,
        )
        .icon("sparkles")
        .color("#FBCFE8")
        .credentials(vec![CredentialBinding {
            name: "jinaAiApi".into(),
            display_name: "Jina AI API Key".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![opt("Embedding", "embedding"), opt("Rerank", "rerank")])
                .default(json!("embedding"))
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![opt("Create", "create")])
                .default(json!("create"))
                .show_when("resource", &["embedding"])
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![opt("Rerank", "rerank")])
                .default(json!("rerank"))
                .show_when("resource", &["rerank"])
                .required(),
            // embedding:create
            NodeProperty::new("embeddingModel", "Model", NodePropertyType::String)
                .default(json!("jina-embeddings-v3"))
                .placeholder("jina-embeddings-v3")
                .show_when("resource", &["embedding"])
                .required(),
            NodeProperty::new("input", "Input", NodePropertyType::Json)
                .show_when("resource", &["embedding"])
                .description("JSON array of text strings to embed"),
            NodeProperty::new("task", "Task", NodePropertyType::Options)
                .options(vec![
                    opt("Retrieval Passage", "retrieval.passage"),
                    opt("Retrieval Query", "retrieval.query"),
                    opt("Text Matching", "text-matching"),
                    opt("Classification", "classification"),
                    opt("Separation", "separation"),
                ])
                .default(json!("retrieval.passage"))
                .show_when("resource", &["embedding"]),
            NodeProperty::new("dimensions", "Dimensions", NodePropertyType::Number)
                .show_when("resource", &["embedding"])
                .description("Optional reduced embedding dimensionality (Matryoshka)"),
            // rerank
            NodeProperty::new("rerankModel", "Model", NodePropertyType::String)
                .default(json!("jina-reranker-v2-base-multilingual"))
                .placeholder("jina-reranker-v2-base-multilingual")
                .show_when("resource", &["rerank"])
                .required(),
            NodeProperty::new("query", "Query", NodePropertyType::String)
                .show_when("resource", &["rerank"])
                .description("Query to rerank documents against"),
            NodeProperty::new("documents", "Documents", NodePropertyType::Json)
                .show_when("resource", &["rerank"])
                .description("JSON array of document strings to rerank"),
            NodeProperty::new("topN", "Top N", NodePropertyType::Number)
                .default(json!(5))
                .show_when("resource", &["rerank"]),
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

        let resource = ctx
            .param_str_opt(params, "resource")
            .unwrap_or_else(|| "embedding".to_string());

        let body: Value = match resource.as_str() {
            "embedding" => {
                let model = ctx.param_str(params, "embeddingModel")?;
                let input = parse_json_param(ctx, params, "input")
                    .unwrap_or_else(|| Value::Array(vec![]));
                let task = ctx
                    .param_str_opt(params, "task")
                    .unwrap_or_else(|| "retrieval.passage".to_string());
                let mut payload = Map::new();
                payload.insert("model".into(), json!(model));
                payload.insert("input".into(), input);
                payload.insert("task".into(), json!(task));
                if let Some(dims) = ctx.param_f64(params, "dimensions") {
                    payload.insert("dimensions".into(), json!(dims as i64));
                }
                post_json(ctx, &api_key, "embeddings", Value::Object(payload)).await?
            }
            "rerank" => {
                let model = ctx.param_str(params, "rerankModel")?;
                let query = ctx.param_str(params, "query")?;
                let documents = parse_json_param(ctx, params, "documents")
                    .unwrap_or_else(|| Value::Array(vec![]));
                let top_n = ctx.param_f64(params, "topN").unwrap_or(5.0) as i64;
                let payload = json!({
                    "model": model,
                    "query": query,
                    "documents": documents,
                    "top_n": top_n,
                });
                post_json(ctx, &api_key, "rerank", payload).await?
            }
            other => {
                return Err(NodeError::InvalidParameter {
                    name: "resource".into(),
                    reason: format!("unknown resource: {other}"),
                });
            }
        };

        Ok(NodeOutput::single(vec![body]))
    }
}

async fn post_json(
    ctx: &ExecutionContext,
    api_key: &str,
    endpoint: &str,
    payload: Value,
) -> NodeResult<Value> {
    let url = format!("{JINA_API_BASE}/{endpoint}");
    let res = ctx
        .http
        .post(&url)
        .bearer_auth(api_key)
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
