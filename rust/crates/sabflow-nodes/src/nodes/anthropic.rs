//! Anthropic node.
//!
//! Implements messages / completion operations against the Anthropic REST API
//! (https://api.anthropic.com/v1). Authenticates with an API key supplied via
//! the `anthropicApi` credential (`apiKey` field).

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

pub struct AnthropicNode;

const ANTHROPIC_API_BASE: &str = "https://api.anthropic.com/v1";
const ANTHROPIC_VERSION: &str = "2023-06-01";

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for AnthropicNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "anthropic",
            "Anthropic",
            "Anthropic Claude messages and legacy completions",
            NodeCategory::Ai,
        )
        .icon("sparkles")
        .color("#D97757")
        .credentials(vec![CredentialBinding {
            name: "anthropicApi".into(),
            display_name: "Anthropic API Key".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Messages", "messages"),
                    opt("Completion", "completion"),
                ])
                .default(json!("messages"))
                .required(),
            NodeProperty::new("model", "Model", NodePropertyType::String)
                .default(json!("claude-sonnet-4-6"))
                .placeholder("claude-sonnet-4-6")
                .required(),
            NodeProperty::new("system", "System Prompt", NodePropertyType::String)
                .show_when("operation", &["messages"])
                .description("Optional system prompt for the conversation"),
            NodeProperty::new("messages", "Messages", NodePropertyType::Json)
                .show_when("operation", &["messages"])
                .description("JSON array of { role: 'user' | 'assistant', content: string }"),
            NodeProperty::new("prompt", "Prompt", NodePropertyType::String)
                .show_when("operation", &["completion"])
                .description("Legacy text-completion prompt"),
            NodeProperty::new("maxTokens", "Max Tokens", NodePropertyType::Number)
                .default(json!(1024)),
            NodeProperty::new("temperature", "Temperature", NodePropertyType::Number)
                .default(json!(1.0)),
            NodeProperty::new("topP", "Top P", NodePropertyType::Number).default(json!(1.0)),
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

        let operation = ctx.param_str(params, "operation")?;
        let model = ctx.param_str(params, "model")?;
        let max_tokens = ctx.param_f64(params, "maxTokens").unwrap_or(1024.0) as i64;
        let temperature = ctx.param_f64(params, "temperature").unwrap_or(1.0);
        let top_p = ctx.param_f64(params, "topP").unwrap_or(1.0);

        let body: Value = match operation.as_str() {
            "messages" => {
                let messages = parse_json_param(ctx, params, "messages")
                    .unwrap_or_else(|| Value::Array(vec![]));
                let mut payload = Map::new();
                payload.insert("model".into(), json!(model));
                payload.insert("max_tokens".into(), json!(max_tokens));
                payload.insert("temperature".into(), json!(temperature));
                payload.insert("top_p".into(), json!(top_p));
                if let Some(system) = ctx.param_str_opt(params, "system") {
                    if !system.trim().is_empty() {
                        payload.insert("system".into(), json!(system));
                    }
                }
                payload.insert("messages".into(), messages);
                post_json(ctx, &api_key, "messages", Value::Object(payload)).await?
            }
            "completion" => {
                let prompt = ctx.param_str(params, "prompt")?;
                let payload = json!({
                    "model": model,
                    "prompt": prompt,
                    "max_tokens_to_sample": max_tokens,
                    "temperature": temperature,
                    "top_p": top_p,
                });
                post_json(ctx, &api_key, "complete", payload).await?
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

/// POST a JSON payload to `{ANTHROPIC_API_BASE}/{endpoint}` with the required
/// `x-api-key` and `anthropic-version` headers.
async fn post_json(
    ctx: &ExecutionContext,
    api_key: &str,
    endpoint: &str,
    payload: Value,
) -> NodeResult<Value> {
    let url = format!("{ANTHROPIC_API_BASE}/{endpoint}");
    let res = ctx
        .http
        .post(&url)
        .header("x-api-key", api_key)
        .header("anthropic-version", ANTHROPIC_VERSION)
        .header("content-type", "application/json")
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

/// Pull a JSON-shaped property out of `params`. Accepts either a native JSON
/// value (array/object) or a string holding JSON. Returns `None` if absent
/// or unparseable-but-empty.
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

/// Recursively run `ctx.substitute` over all string leaves of a JSON value.
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
