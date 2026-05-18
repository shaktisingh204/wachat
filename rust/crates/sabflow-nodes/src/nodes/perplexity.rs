//! Perplexity node.
//!
//! Implements chat completions against the Perplexity REST API
//! (https://api.perplexity.ai). Perplexity is OpenAI-compatible at the wire
//! level — `/chat/completions` accepts the same JSON shape — so this node is a
//! thin wrapper around `POST /chat/completions` with bearer auth supplied by
//! the `perplexityApi` credential (`apiKey` field).

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

pub struct PerplexityNode;

const PERPLEXITY_API_BASE: &str = "https://api.perplexity.ai";

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for PerplexityNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "perplexity",
            "Perplexity",
            "Perplexity AI search-grounded chat completions",
            NodeCategory::Ai,
        )
        .icon("sparkles")
        .color("#20808D")
        .credentials(vec![CredentialBinding {
            name: "perplexityApi".into(),
            display_name: "Perplexity API Key".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![opt("Chat Completion", "complete")])
                .default(json!("complete"))
                .required(),
            NodeProperty::new("model", "Model", NodePropertyType::String)
                .default(json!("sonar"))
                .placeholder("sonar")
                .required()
                .description("Perplexity model id (e.g. sonar, sonar-pro, sonar-reasoning)"),
            NodeProperty::new("messages", "Messages", NodePropertyType::Json)
                .description("JSON array of { role: 'system' | 'user' | 'assistant', content }"),
            NodeProperty::new("temperature", "Temperature", NodePropertyType::Number)
                .default(json!(0.2)),
            NodeProperty::new("maxTokens", "Max Tokens", NodePropertyType::Number)
                .default(json!(1024)),
            NodeProperty::new("topP", "Top P", NodePropertyType::Number)
                .default(json!(0.9)),
            NodeProperty::new(
                "returnCitations",
                "Return Citations",
                NodePropertyType::Boolean,
            )
            .default(json!(true)),
            NodeProperty::new("searchDomainFilter", "Search Domain Filter", NodePropertyType::Json)
                .description("Optional JSON array of allowed/blocked domains"),
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

        let operation = ctx
            .param_str_opt(params, "operation")
            .unwrap_or_else(|| "complete".to_string());
        if operation != "complete" {
            return Err(NodeError::InvalidParameter {
                name: "operation".into(),
                reason: format!("unknown operation: {operation}"),
            });
        }

        let model = ctx.param_str(params, "model")?;
        let messages = parse_json_param(ctx, params, "messages")
            .unwrap_or_else(|| Value::Array(vec![]));
        let temperature = ctx.param_f64(params, "temperature").unwrap_or(0.2);
        let max_tokens = ctx.param_f64(params, "maxTokens").unwrap_or(1024.0) as i64;
        let top_p = ctx.param_f64(params, "topP").unwrap_or(0.9);
        let return_citations = ctx.param_bool(params, "returnCitations", true);

        let mut payload = Map::new();
        payload.insert("model".into(), json!(model));
        payload.insert("messages".into(), messages);
        payload.insert("temperature".into(), json!(temperature));
        payload.insert("max_tokens".into(), json!(max_tokens));
        payload.insert("top_p".into(), json!(top_p));
        payload.insert("return_citations".into(), json!(return_citations));
        if let Some(filter) = parse_json_param(ctx, params, "searchDomainFilter") {
            payload.insert("search_domain_filter".into(), filter);
        }

        let body = post_json(ctx, &api_key, "chat/completions", Value::Object(payload)).await?;
        Ok(NodeOutput::single(vec![body]))
    }
}

async fn post_json(
    ctx: &ExecutionContext,
    api_key: &str,
    endpoint: &str,
    payload: Value,
) -> NodeResult<Value> {
    let url = format!("{PERPLEXITY_API_BASE}/{endpoint}");
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
