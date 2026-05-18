//! Google Translate (Cloud Translation v2) node.
//!
//! Implements the public Translate v2 REST endpoints:
//!   - POST /language/translate/v2          → translate text
//!   - POST /language/translate/v2/detect   → detect language
//!   - GET  /language/translate/v2/languages → list supported target languages
//!
//! Authentication: either an OAuth2 bearer token (`accessToken`, scope
//! `https://www.googleapis.com/auth/cloud-translation`) or a simple
//! API key (`apiKey`). The credential type field selects between the two.
//!
//! Pricing note: Cloud Translation is billed per character — we don't cap
//! input length here, but consumers should pre-filter long blobs.

use async_trait::async_trait;
use serde_json::{Value, json};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{
        CredentialBinding, NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption,
        NodePropertyType,
    },
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct GoogleTranslateNode;

const BASE_URL: &str = "https://translation.googleapis.com/language/translate/v2";

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for GoogleTranslateNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "googleTranslate",
            "Google Translate",
            "Translate text and detect language with Google Cloud Translation",
            NodeCategory::Ai,
        )
        .icon("languages")
        .color("#4285F4")
        .credentials(vec![CredentialBinding {
            name: "googleTranslateOAuth2".into(),
            display_name: "Google Translate OAuth2 or API Key".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Translate", "translate"),
                    opt("Detect Language", "detect"),
                    opt("List Supported Languages", "languages"),
                ])
                .default(json!("translate"))
                .required(),
            NodeProperty::new("text", "Text", NodePropertyType::String)
                .placeholder("Hello world")
                .description("Text to translate or detect.")
                .show_when("operation", &["translate", "detect"])
                .required(),
            NodeProperty::new("targetLanguage", "Target Language", NodePropertyType::String)
                .placeholder("es")
                .description("BCP-47 code of the target language (e.g. `es`, `fr`, `de`).")
                .show_when("operation", &["translate"])
                .required(),
            NodeProperty::new("sourceLanguage", "Source Language", NodePropertyType::String)
                .placeholder("auto")
                .description("Optional source language code; omit for auto-detect.")
                .show_when("operation", &["translate"]),
            NodeProperty::new("format", "Format", NodePropertyType::Options)
                .options(vec![opt("Text", "text"), opt("HTML", "html")])
                .default(json!("text"))
                .show_when("operation", &["translate"]),
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
        let access_token = cred.data.get("accessToken").cloned();
        let api_key = cred.data.get("apiKey").cloned();
        if access_token.is_none() && api_key.is_none() {
            return Err(NodeError::MissingParameter(
                "accessToken or apiKey".into(),
            ));
        }

        let operation = ctx.param_str(params, "operation")?;
        match operation.as_str() {
            "translate" => {
                let text = ctx.param_str(params, "text")?;
                let target = ctx.param_str(params, "targetLanguage")?;
                let source = ctx.param_str_opt(params, "sourceLanguage").unwrap_or_default();
                let format = ctx
                    .param_str_opt(params, "format")
                    .unwrap_or_else(|| "text".to_string());

                let mut payload = json!({
                    "q": text,
                    "target": target,
                    "format": format,
                });
                if !source.is_empty() {
                    payload["source"] = json!(source);
                }
                let url = build_url(BASE_URL, api_key.as_deref());
                let mut req = ctx
                    .http
                    .post(&url)
                    .json(&payload);
                if api_key.is_none() {
                    if let Some(t) = &access_token {
                        req = req.bearer_auth(t);
                    }
                }
                emit(req.send().await?).await
            }
            "detect" => {
                let text = ctx.param_str(params, "text")?;
                let url = build_url(&format!("{BASE_URL}/detect"), api_key.as_deref());
                let payload = json!({ "q": text });
                let mut req = ctx.http.post(&url).json(&payload);
                if api_key.is_none() {
                    if let Some(t) = &access_token {
                        req = req.bearer_auth(t);
                    }
                }
                emit(req.send().await?).await
            }
            "languages" => {
                let url = build_url(&format!("{BASE_URL}/languages"), api_key.as_deref());
                let mut req = ctx.http.get(&url);
                if api_key.is_none() {
                    if let Some(t) = &access_token {
                        req = req.bearer_auth(t);
                    }
                }
                emit(req.send().await?).await
            }
            other => Err(NodeError::InvalidParameter {
                name: "operation".into(),
                reason: format!("unsupported operation: {other}"),
            }),
        }
    }
}

fn build_url(base: &str, api_key: Option<&str>) -> String {
    match api_key {
        Some(key) if !key.is_empty() => {
            let sep = if base.contains('?') { '&' } else { '?' };
            format!("{base}{sep}key={}", urlencoding::encode(key))
        }
        _ => base.to_string(),
    }
}

async fn emit(res: reqwest::Response) -> NodeResult<NodeOutput> {
    let status = res.status();
    let text = res.text().await.unwrap_or_default();
    let body: Value =
        serde_json::from_str(&text).unwrap_or_else(|_| json!({ "body": text.clone() }));
    if !status.is_success() {
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: body.to_string(),
        });
    }
    Ok(NodeOutput::single(vec![body]))
}
