//! Google Cloud Vision node.
//!
//! Implements the Vision v1 `images:annotate` endpoint — the single batch
//! endpoint that powers every Vision feature (label, text, face, landmark,
//! safe-search, object localization).
//!
//! Source images can be supplied as:
//!   - base64-encoded bytes (`contentBase64`), or
//!   - a Google Cloud Storage URI (`gs://bucket/object`), or
//!   - a public HTTPS image URL.
//!
//! Authentication: pre-refreshed OAuth2 bearer token at
//! `cred.data["accessToken"]` (scope
//! `https://www.googleapis.com/auth/cloud-vision`) — falls back to an
//! `apiKey` query parameter if `accessToken` is absent.

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

pub struct GoogleVisionNode;

const BASE_URL: &str = "https://vision.googleapis.com/v1/images:annotate";

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for GoogleVisionNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "googleVision",
            "Google Cloud Vision",
            "Annotate images with Google Cloud Vision (labels, text, faces, …)",
            NodeCategory::Ai,
        )
        .icon("eye")
        .color("#4285F4")
        .credentials(vec![CredentialBinding {
            name: "googleVisionOAuth2".into(),
            display_name: "Google Vision OAuth2 or API Key".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("feature", "Feature", NodePropertyType::Options)
                .options(vec![
                    opt("Label Detection", "LABEL_DETECTION"),
                    opt("Text Detection (OCR)", "TEXT_DETECTION"),
                    opt("Document Text Detection", "DOCUMENT_TEXT_DETECTION"),
                    opt("Face Detection", "FACE_DETECTION"),
                    opt("Landmark Detection", "LANDMARK_DETECTION"),
                    opt("Logo Detection", "LOGO_DETECTION"),
                    opt("Safe Search", "SAFE_SEARCH_DETECTION"),
                    opt("Image Properties", "IMAGE_PROPERTIES"),
                    opt("Object Localization", "OBJECT_LOCALIZATION"),
                    opt("Web Detection", "WEB_DETECTION"),
                ])
                .default(json!("LABEL_DETECTION"))
                .required(),
            NodeProperty::new("maxResults", "Max Results", NodePropertyType::Number)
                .default(json!(10)),
            NodeProperty::new("imageSource", "Image Source", NodePropertyType::Options)
                .options(vec![
                    opt("Base64 Content", "content"),
                    opt("GCS URI (gs://...)", "gcsUri"),
                    opt("Public Image URL", "imageUri"),
                ])
                .default(json!("imageUri"))
                .required(),
            NodeProperty::new("contentBase64", "Image Content (base64)", NodePropertyType::String)
                .placeholder("iVBORw0KGgoAAAANSUhEUg…")
                .show_when("imageSource", &["content"])
                .description("Raw base64-encoded image bytes."),
            NodeProperty::new("gcsUri", "GCS URI", NodePropertyType::String)
                .placeholder("gs://my-bucket/image.png")
                .show_when("imageSource", &["gcsUri"]),
            NodeProperty::new("imageUri", "Image URL", NodePropertyType::String)
                .placeholder("https://example.com/image.png")
                .show_when("imageSource", &["imageUri"]),
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

        let feature = ctx.param_str(params, "feature")?;
        let max_results = ctx
            .param_f64(params, "maxResults")
            .map(|n| n as u64)
            .unwrap_or(10);
        let source = ctx
            .param_str_opt(params, "imageSource")
            .unwrap_or_else(|| "imageUri".to_string());

        let mut image_obj = Map::new();
        match source.as_str() {
            "content" => {
                let content = ctx.param_str(params, "contentBase64")?;
                image_obj.insert("content".into(), Value::String(content));
            }
            "gcsUri" => {
                let uri = ctx.param_str(params, "gcsUri")?;
                let mut src = Map::new();
                src.insert("gcsImageUri".into(), Value::String(uri));
                image_obj.insert("source".into(), Value::Object(src));
            }
            "imageUri" => {
                let uri = ctx.param_str(params, "imageUri")?;
                let mut src = Map::new();
                src.insert("imageUri".into(), Value::String(uri));
                image_obj.insert("source".into(), Value::Object(src));
            }
            other => {
                return Err(NodeError::InvalidParameter {
                    name: "imageSource".into(),
                    reason: format!("unknown image source: {other}"),
                });
            }
        }

        let payload = json!({
            "requests": [
                {
                    "image": Value::Object(image_obj),
                    "features": [
                        { "type": feature, "maxResults": max_results }
                    ]
                }
            ]
        });

        let url = match (&api_key, &access_token) {
            (Some(k), _) if !k.is_empty() => {
                format!("{BASE_URL}?key={}", urlencoding::encode(k))
            }
            _ => BASE_URL.to_string(),
        };

        let mut req = ctx.http.post(&url).json(&payload);
        if api_key.is_none() {
            if let Some(t) = &access_token {
                req = req.bearer_auth(t);
            }
        }
        let res = req.send().await?;
        emit(res).await
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
