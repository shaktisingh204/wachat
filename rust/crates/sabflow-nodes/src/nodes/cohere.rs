//! Cohere node.
//!
//! Implements chat, embeddings, and rerank operations against the Cohere REST
//! API (https://api.cohere.com/v1). Authenticates with a bearer token supplied
//! via the `cohereApi` credential (`apiKey` field).

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

pub struct CohereNode;

const COHERE_API_BASE: &str = "https://api.cohere.com/v1";

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for CohereNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "cohere",
            "Cohere",
            "Cohere chat, embeddings, and reranking",
            NodeCategory::Ai,
        )
        .icon("sparkles")
        .color("#39594D")
        .credentials(vec![CredentialBinding {
            name: "cohereApi".into(),
            display_name: "Cohere API Key".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![
                    opt("Chat", "chat"),
                    opt("Embedding", "embedding"),
                    opt("Rerank", "rerank"),
                ])
                .default(json!("chat"))
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![opt("Send Message", "send")])
                .default(json!("send"))
                .show_when("resource", &["chat"])
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
            // shared
            NodeProperty::new("model", "Model", NodePropertyType::String)
                .default(json!("command-r-plus"))
                .placeholder("command-r-plus")
                .required(),
            // chat:send
            NodeProperty::new("message", "Message", NodePropertyType::String)
                .show_when("resource", &["chat"])
                .description("The user message to send"),
            NodeProperty::new("preamble", "System Preamble", NodePropertyType::String)
                .show_when("resource", &["chat"])
                .description("Optional system-style preamble"),
            NodeProperty::new("chatHistory", "Chat History", NodePropertyType::Json)
                .show_when("resource", &["chat"])
                .description("Optional JSON array of { role: 'USER' | 'CHATBOT', message }"),
            NodeProperty::new("temperature", "Temperature", NodePropertyType::Number)
                .default(json!(0.3))
                .show_when("resource", &["chat"]),
            // embedding:create
            NodeProperty::new("texts", "Texts", NodePropertyType::Json)
                .show_when("resource", &["embedding"])
                .description("JSON array of text strings to embed"),
            NodeProperty::new("inputType", "Input Type", NodePropertyType::Options)
                .options(vec![
                    opt("Search Document", "search_document"),
                    opt("Search Query", "search_query"),
                    opt("Classification", "classification"),
                    opt("Clustering", "clustering"),
                ])
                .default(json!("search_document"))
                .show_when("resource", &["embedding"]),
            // rerank
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
            .unwrap_or_else(|| "chat".to_string());
        let operation = ctx.param_str(params, "operation")?;
        let model = ctx.param_str(params, "model")?;

        let body: Value = match (resource.as_str(), operation.as_str()) {
            ("chat", "send") => {
                let message = ctx.param_str(params, "message")?;
                let temperature = ctx.param_f64(params, "temperature").unwrap_or(0.3);
                let mut payload = Map::new();
                payload.insert("model".into(), json!(model));
                payload.insert("message".into(), json!(message));
                payload.insert("temperature".into(), json!(temperature));
                if let Some(preamble) = ctx.param_str_opt(params, "preamble") {
                    if !preamble.trim().is_empty() {
                        payload.insert("preamble".into(), json!(preamble));
                    }
                }
                if let Some(history) = parse_json_param(ctx, params, "chatHistory") {
                    payload.insert("chat_history".into(), history);
                }
                post_json(ctx, &api_key, "chat", Value::Object(payload)).await?
            }
            ("embedding", "create") => {
                let texts = parse_json_param(ctx, params, "texts")
                    .unwrap_or_else(|| Value::Array(vec![]));
                let input_type = ctx
                    .param_str_opt(params, "inputType")
                    .unwrap_or_else(|| "search_document".to_string());
                let payload = json!({
                    "model": model,
                    "texts": texts,
                    "input_type": input_type,
                });
                post_json(ctx, &api_key, "embed", payload).await?
            }
            ("rerank", "rerank") => {
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
            (res, op) => {
                return Err(NodeError::InvalidParameter {
                    name: "operation".into(),
                    reason: format!("unknown {res} operation: {op}"),
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
    let url = format!("{COHERE_API_BASE}/{endpoint}");
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
