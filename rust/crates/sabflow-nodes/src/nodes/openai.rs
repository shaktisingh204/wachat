//! OpenAI node.
//!
//! Implements chat / completion / embedding / image / audio operations against
//! the OpenAI REST API (https://api.openai.com/v1). Authenticates with a bearer
//! token supplied via the `openAiApi` credential (`apiKey` field).

use async_trait::async_trait;
use base64::Engine;
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

pub struct OpenAiNode;

const OPENAI_API_BASE: &str = "https://api.openai.com/v1";

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for OpenAiNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "openAi",
            "OpenAI",
            "OpenAI chat, completions, embeddings, images, and audio",
            NodeCategory::Ai,
        )
        .icon("sparkles")
        .color("#10A37F")
        .credentials(vec![CredentialBinding {
            name: "openAiApi".into(),
            display_name: "OpenAI API Key".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![
                    opt("Chat", "chat"),
                    opt("Completion", "completion"),
                    opt("Embedding", "embedding"),
                    opt("Image", "image"),
                    opt("Audio", "audio"),
                ])
                .default(json!("chat"))
                .required(),
            // Chat operations
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![opt("Complete", "complete")])
                .default(json!("complete"))
                .show_when("resource", &["chat"])
                .required(),
            // Completion operations
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![opt("Complete", "complete")])
                .default(json!("complete"))
                .show_when("resource", &["completion"])
                .required(),
            // Embedding operations
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![opt("Create", "create")])
                .default(json!("create"))
                .show_when("resource", &["embedding"])
                .required(),
            // Image operations
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![opt("Generate", "generate"), opt("Edit", "edit")])
                .default(json!("generate"))
                .show_when("resource", &["image"])
                .required(),
            // Audio operations
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Transcribe", "transcribe"),
                    opt("Speech", "speech"),
                ])
                .default(json!("transcribe"))
                .show_when("resource", &["audio"])
                .required(),
            // Shared model field
            NodeProperty::new("model", "Model", NodePropertyType::String)
                .default(json!("gpt-4o-mini"))
                .placeholder("gpt-4o-mini")
                .required(),
            // chat:complete — messages JSON array
            NodeProperty::new("messages", "Messages", NodePropertyType::Json)
                .show_when("operation", &["complete"])
                .show_when("resource", &["chat"])
                .description("JSON array of { role, content } messages"),
            // completion / image / audio — prompt
            NodeProperty::new("prompt", "Prompt", NodePropertyType::String)
                .show_when("resource", &["completion", "image", "audio"]),
            // chat / completion shared knobs
            NodeProperty::new("temperature", "Temperature", NodePropertyType::Number)
                .default(json!(0.7))
                .show_when("operation", &["complete"]),
            NodeProperty::new("maxTokens", "Max Tokens", NodePropertyType::Number)
                .default(json!(1000))
                .show_when("operation", &["complete"]),
            NodeProperty::new("topP", "Top P", NodePropertyType::Number)
                .default(json!(1.0))
                .show_when("operation", &["complete"]),
            // embedding:create
            NodeProperty::new("inputText", "Input Text", NodePropertyType::String)
                .show_when("operation", &["create"])
                .show_when("resource", &["embedding"]),
            // image:generate
            NodeProperty::new("n", "Number of Images", NodePropertyType::Number)
                .default(json!(1))
                .show_when("operation", &["generate"])
                .show_when("resource", &["image"]),
            NodeProperty::new("size", "Size", NodePropertyType::Options)
                .options(vec![
                    opt("256x256", "256x256"),
                    opt("512x512", "512x512"),
                    opt("1024x1024", "1024x1024"),
                    opt("1792x1024", "1792x1024"),
                    opt("1024x1792", "1024x1792"),
                ])
                .default(json!("1024x1024"))
                .show_when("operation", &["generate"]),
            // audio:transcribe
            NodeProperty::new("audioUrl", "Audio URL", NodePropertyType::String)
                .show_when("operation", &["transcribe"]),
            // audio:speech
            NodeProperty::new("voice", "Voice", NodePropertyType::Options)
                .options(vec![
                    opt("Alloy", "alloy"),
                    opt("Echo", "echo"),
                    opt("Fable", "fable"),
                    opt("Onyx", "onyx"),
                    opt("Nova", "nova"),
                    opt("Shimmer", "shimmer"),
                ])
                .default(json!("alloy"))
                .show_when("operation", &["speech"]),
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
            // ----- Chat completions -----
            ("chat", "complete") => {
                let messages = parse_json_param(ctx, params, "messages")
                    .unwrap_or_else(|| Value::Array(vec![]));
                let temperature = ctx.param_f64(params, "temperature").unwrap_or(0.7);
                let max_tokens = ctx.param_f64(params, "maxTokens").unwrap_or(1000.0) as i64;
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
            // ----- Legacy completions -----
            ("completion", "complete") => {
                let prompt = ctx.param_str(params, "prompt")?;
                let temperature = ctx.param_f64(params, "temperature").unwrap_or(0.7);
                let max_tokens = ctx.param_f64(params, "maxTokens").unwrap_or(1000.0) as i64;
                let top_p = ctx.param_f64(params, "topP").unwrap_or(1.0);
                let payload = json!({
                    "model": model,
                    "prompt": prompt,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                    "top_p": top_p,
                });
                post_json(ctx, &api_key, "completions", payload).await?
            }
            // ----- Embeddings -----
            ("embedding", "create") => {
                let input_text = ctx.param_str(params, "inputText")?;
                let payload = json!({
                    "model": model,
                    "input": input_text,
                });
                post_json(ctx, &api_key, "embeddings", payload).await?
            }
            // ----- Images -----
            ("image", "generate") => {
                let prompt = ctx.param_str(params, "prompt")?;
                let n = ctx.param_f64(params, "n").unwrap_or(1.0) as i64;
                let size = ctx
                    .param_str_opt(params, "size")
                    .unwrap_or_else(|| "1024x1024".to_string());
                let payload = json!({
                    "model": "dall-e-3",
                    "prompt": prompt,
                    "n": n,
                    "size": size,
                });
                post_json(ctx, &api_key, "images/generations", payload).await?
            }
            ("image", "edit") => {
                // TODO(sabflow): image edits require multipart upload of the
                // source image + mask; not implementable as a plain JSON POST.
                return Err(NodeError::NotImplemented(
                    "OpenAI image:edit requires multipart file upload — not yet implemented"
                        .to_string(),
                ));
            }
            // ----- Audio -----
            ("audio", "transcribe") => {
                // TODO(sabflow): audio transcription needs multipart upload of
                // the audio file; not implementable as a plain JSON POST.
                return Err(NodeError::NotImplemented(
                    "OpenAI audio:transcribe requires multipart file upload — not yet implemented"
                        .to_string(),
                ));
            }
            ("audio", "speech") => {
                let prompt = ctx.param_str(params, "prompt")?;
                let voice = ctx
                    .param_str_opt(params, "voice")
                    .unwrap_or_else(|| "alloy".to_string());
                let payload = json!({
                    "model": "tts-1",
                    "input": prompt,
                    "voice": voice,
                });
                let url = format!("{OPENAI_API_BASE}/audio/speech");
                let res = ctx
                    .http
                    .post(&url)
                    .bearer_auth(&api_key)
                    .json(&payload)
                    .send()
                    .await?;
                let status = res.status();
                let bytes = res.bytes().await?;
                if !status.is_success() {
                    let body = String::from_utf8_lossy(&bytes).to_string();
                    return Err(NodeError::UpstreamError {
                        status: status.as_u16(),
                        body,
                    });
                }
                let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
                json!({ "audio_base64": b64 })
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

/// POST a JSON payload to `{OPENAI_API_BASE}/{endpoint}` with bearer auth.
async fn post_json(
    ctx: &ExecutionContext,
    api_key: &str,
    endpoint: &str,
    payload: Value,
) -> NodeResult<Value> {
    let url = format!("{OPENAI_API_BASE}/{endpoint}");
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
