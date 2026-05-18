//! AWS Comprehend node — language detection, sentiment, entity extraction.
//!
//! Speaks the Comprehend JSON 1.1 API (`X-Amz-Target` + AWS4-HMAC-SHA256) over
//! plain HTTPS — no `aws-sdk-comprehend` dep. Credential schema: `awsApi`.

use async_trait::async_trait;
use chrono::Utc;
use reqwest::{
    Method,
    header::{HeaderMap, HeaderValue},
};
use serde_json::{Value, json};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{
        CredentialBinding, NodeCategory, NodeDescriptor, NodeProperty, NodePropertyOption,
        NodePropertyType,
    },
    error::{NodeError, NodeResult},
    node::Node,
    nodes::aws_sigv4::{AwsCreds, SignParams, sign_request},
};

pub struct AwsComprehendNode;

#[async_trait]
impl Node for AwsComprehendNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "awsComprehend",
            "AWS Comprehend",
            "Detect language, sentiment, and entities with Amazon Comprehend",
            NodeCategory::Ai,
        )
        .icon("brain")
        .color("#FF9900")
        .credentials(vec![CredentialBinding {
            name: "awsApi".into(),
            display_name: "AWS API".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    NodePropertyOption {
                        name: "Detect Dominant Language".into(),
                        value: json!("detectDominantLanguage"),
                        description: Some("Identify the language of a text".into()),
                    },
                    NodePropertyOption {
                        name: "Detect Sentiment".into(),
                        value: json!("detectSentiment"),
                        description: Some("POSITIVE / NEGATIVE / NEUTRAL / MIXED".into()),
                    },
                    NodePropertyOption {
                        name: "Detect Entities".into(),
                        value: json!("detectEntities"),
                        description: Some("Named-entity extraction".into()),
                    },
                    NodePropertyOption {
                        name: "Detect Key Phrases".into(),
                        value: json!("detectKeyPhrases"),
                        description: Some("Extract notable phrases".into()),
                    },
                    NodePropertyOption {
                        name: "Detect PII".into(),
                        value: json!("detectPiiEntities"),
                        description: Some("Find personally identifiable information".into()),
                    },
                ])
                .default(json!("detectSentiment"))
                .required(),
            NodeProperty::new("text", "Text", NodePropertyType::String)
                .description("UTF-8 text to analyze (up to 5,000 bytes)")
                .required(),
            NodeProperty::new("languageCode", "Language Code", NodePropertyType::String)
                .description(
                    "Required for every op except detectDominantLanguage (e.g. en, es, fr, de, ja)",
                )
                .default(json!("en")),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        let cred_id = ctx.param_str(params, "credentialId")?;
        let creds = AwsCreds::from_credential(ctx.credential(&cred_id)?)?;
        let operation = ctx.param_str(params, "operation")?;
        let text = ctx.param_str(params, "text")?;
        let lang = ctx
            .param_str_opt(params, "languageCode")
            .unwrap_or_else(|| "en".to_string());

        let (target, body) = match operation.as_str() {
            "detectDominantLanguage" => (
                "Comprehend_20171127.DetectDominantLanguage",
                json!({ "Text": text }),
            ),
            "detectSentiment" => (
                "Comprehend_20171127.DetectSentiment",
                json!({ "Text": text, "LanguageCode": lang }),
            ),
            "detectEntities" => (
                "Comprehend_20171127.DetectEntities",
                json!({ "Text": text, "LanguageCode": lang }),
            ),
            "detectKeyPhrases" => (
                "Comprehend_20171127.DetectKeyPhrases",
                json!({ "Text": text, "LanguageCode": lang }),
            ),
            "detectPiiEntities" => (
                "Comprehend_20171127.DetectPiiEntities",
                json!({ "Text": text, "LanguageCode": lang }),
            ),
            other => {
                return Err(NodeError::InvalidParameter {
                    name: "operation".into(),
                    reason: format!("unknown operation: {other}"),
                });
            }
        };

        let url: reqwest::Url = format!("https://comprehend.{}.amazonaws.com/", creds.region)
            .parse()
            .map_err(|e| NodeError::Other(format!("AWS Comprehend: bad URL: {e}")))?;
        let body_bytes = serde_json::to_vec(&body)?;
        let mut headers = HeaderMap::new();
        headers.insert(
            "content-type",
            HeaderValue::from_static("application/x-amz-json-1.1"),
        );
        headers.insert(
            "x-amz-target",
            HeaderValue::from_str(target)
                .map_err(|e| NodeError::Other(format!("AWS Comprehend: {e}")))?,
        );

        let req = sign_request(SignParams {
            method: Method::POST,
            url,
            extra_headers: headers,
            body: body_bytes,
            region: &creds.region,
            service: "comprehend",
            access_key_id: &creds.access_key_id,
            secret_access_key: &creds.secret_access_key,
            session_token: creds.session_token.as_deref(),
            now: Utc::now(),
        })?;
        let resp = ctx.http.execute(req).await?;
        let status = resp.status();
        let text = resp.text().await?;
        if !status.is_success() {
            return Err(NodeError::UpstreamError {
                status: status.as_u16(),
                body: text,
            });
        }
        let parsed: Value = serde_json::from_str(&text).unwrap_or(Value::String(text));
        Ok(NodeOutput::single(vec![parsed]))
    }
}
