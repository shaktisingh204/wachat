//! Mistral AI node.
//!
//! Implements chat completions and embeddings against the Mistral REST API
//! (https://api.mistral.ai/v1). Authenticates with a bearer token supplied via
//! the `mistralAiApi` credential (`apiKey` field).
//!
//! Mistral's API is OpenAI-compatible at the wire level — `/chat/completions`
//! and `/embeddings` take the same JSON shapes, so this node is a thin wrapper
//! that mirrors the OpenAI node's surface.

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

pub struct MistralAiNode;

const MISTRAL_API_BASE: &str = "https://api.mistral.ai/v1";

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for MistralAiNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "mistralAi",
            "Mistral AI",
            "Mistral AI chat completions and embeddings",
            NodeCategory::Ai,
        )
        .icon("sparkles")
        .color("#FF7000")
        .credentials(vec![CredentialBinding {
            name: "mistralAiApi".into(),
            display_name: "Mistral AI API Key".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![opt("Chat", "chat"), opt("Embedding", "embedding")])
                .default(json!("chat"))
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![opt("Complete", "complete")])
                .default(json!("complete"))
                .show_when("resource", &["chat"])
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![opt("Create", "create")])
                .default(json!("create"))
                .show_when("resource", &["embedding"])
                .required(),
            NodeProperty::new("model", "Model", NodePropertyType::String)
                .default(json!("mistral-large-latest"))
                .placeholder("mistral-large-latest")
                .required(),
            // chat:complete
            NodeProperty::new("messages", "Messages", NodePropertyType::Json)
                .show_when("resource", &["chat"])
                .description("JSON array of { role, content } messages"),
            NodeProperty::new("temperature", "Temperature", NodePropertyType::Number)
                .default(json!(0.7))
                .show_when("resource", &["chat"]),
            NodeProperty::new("maxTokens", "Max Tokens", NodePropertyType::Number)
                .default(json!(1024))
                .show_when("resource", &["chat"]),
            NodeProperty::new("topP", "Top P", NodePropertyType::Number)
                .default(json!(1.0))
                .show_when("resource", &["chat"]),
            // embedding:create
            NodeProperty::new("inputText", "Input Text", NodePropertyType::String)
                .show_when("resource", &["embedding"])
                .description("Text to embed (string or JSON array of strings)"),
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
            ("chat", "complete") => {
                let messages = parse_json_param(ctx, params, "messages")
                    .unwrap_or_else(|| Value::Array(vec![]));
                let temperature = ctx.param_f64(params, "temperature").unwrap_or(0.7);
                let max_tokens = ctx.param_f64(params, "maxTokens").unwrap_or(1024.0) as i64;
                let top_p = ctx.param_f64(params, "topP").unwrap_or(1.0);
                let payload = json!({
                    "model": model,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                    "top_p": top_p,
                });
                post_json(ctx, &api_key, "chat/completions", payload).await?
            }
            ("embedding", "create") => {
                let raw = ctx.param_str(params, "inputText")?;
                // Accept either a JSON array of strings or a single string.
                let input_value = serde_json::from_str::<Value>(&raw)
                    .ok()
                    .filter(|v| v.is_array())
                    .unwrap_or_else(|| Value::String(raw));
                let payload = json!({
                    "model": model,
                    "input": input_value,
                });
                post_json(ctx, &api_key, "embeddings", payload).await?
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
    let url = format!("{MISTRAL_API_BASE}/{endpoint}");
    let res = ctx
        .http
        .post(&url)
        .bearer_auth(api_key)
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
