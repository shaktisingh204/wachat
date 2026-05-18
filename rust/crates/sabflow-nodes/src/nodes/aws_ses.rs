//! AWS SES node — send email through Amazon SES.
//!
//! Uses the SES v2 JSON API (`POST /v2/email/outbound-emails`) with SigV4.
//! No `aws-sdk-ses` dependency. Credential schema mirrors the other AWS nodes
//! (`accessKeyId`, `secretAccessKey`, `region`, optional `sessionToken`).

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

pub struct AwsSesNode;

#[async_trait]
impl Node for AwsSesNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "awsSes",
            "AWS SES",
            "Send email through Amazon SES",
            NodeCategory::Communication,
        )
        .icon("mail")
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
                .options(vec![NodePropertyOption {
                    name: "Send Email".into(),
                    value: json!("send"),
                    description: Some("Send a formatted email".into()),
                }])
                .default(json!("send"))
                .required(),
            NodeProperty::new("fromAddress", "From", NodePropertyType::String)
                .placeholder("noreply@example.com")
                .show_when("operation", &["send"])
                .required(),
            NodeProperty::new("toAddresses", "To (comma-separated)", NodePropertyType::String)
                .placeholder("user@example.com,other@example.com")
                .show_when("operation", &["send"])
                .required(),
            NodeProperty::new("ccAddresses", "Cc (comma-separated)", NodePropertyType::String)
                .show_when("operation", &["send"]),
            NodeProperty::new("bccAddresses", "Bcc (comma-separated)", NodePropertyType::String)
                .show_when("operation", &["send"]),
            NodeProperty::new("subject", "Subject", NodePropertyType::String)
                .show_when("operation", &["send"])
                .required(),
            NodeProperty::new("bodyText", "Body (text)", NodePropertyType::String)
                .show_when("operation", &["send"]),
            NodeProperty::new("bodyHtml", "Body (HTML)", NodePropertyType::String)
                .show_when("operation", &["send"]),
            NodeProperty::new(
                "configurationSetName",
                "Configuration Set",
                NodePropertyType::String,
            )
            .show_when("operation", &["send"]),
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

        let from = ctx.param_str(params, "fromAddress")?;
        let to = split_addresses(&ctx.param_str(params, "toAddresses")?);
        let cc = ctx
            .param_str_opt(params, "ccAddresses")
            .map(|s| split_addresses(&s))
            .unwrap_or_default();
        let bcc = ctx
            .param_str_opt(params, "bccAddresses")
            .map(|s| split_addresses(&s))
            .unwrap_or_default();
        let subject = ctx.param_str(params, "subject")?;
        let body_text = ctx.param_str_opt(params, "bodyText").unwrap_or_default();
        let body_html = ctx.param_str_opt(params, "bodyHtml").unwrap_or_default();
        let configuration_set = ctx.param_str_opt(params, "configurationSetName");

        if body_text.is_empty() && body_html.is_empty() {
            return Err(NodeError::InvalidParameter {
                name: "bodyText".into(),
                reason: "either bodyText or bodyHtml is required".into(),
            });
        }

        let mut body_obj = serde_json::Map::new();
        if !body_text.is_empty() {
            body_obj.insert("Text".into(), json!({ "Data": body_text, "Charset": "UTF-8" }));
        }
        if !body_html.is_empty() {
            body_obj.insert("Html".into(), json!({ "Data": body_html, "Charset": "UTF-8" }));
        }

        let mut destination = serde_json::Map::new();
        destination.insert("ToAddresses".into(), json!(to));
        if !cc.is_empty() {
            destination.insert("CcAddresses".into(), json!(cc));
        }
        if !bcc.is_empty() {
            destination.insert("BccAddresses".into(), json!(bcc));
        }

        let mut request = serde_json::Map::new();
        request.insert("FromEmailAddress".into(), json!(from));
        request.insert("Destination".into(), Value::Object(destination));
        request.insert(
            "Content".into(),
            json!({
                "Simple": {
                    "Subject": { "Data": subject, "Charset": "UTF-8" },
                    "Body": Value::Object(body_obj),
                }
            }),
        );
        if let Some(cs) = configuration_set.filter(|s| !s.is_empty()) {
            request.insert("ConfigurationSetName".into(), json!(cs));
        }

        let body = serde_json::to_vec(&Value::Object(request))?;
        let url: reqwest::Url = format!(
            "https://email.{region}.amazonaws.com/v2/email/outbound-emails",
            region = creds.region
        )
        .parse()
        .map_err(|e| NodeError::Other(format!("AWS SES: bad URL: {e}")))?;

        let mut headers = HeaderMap::new();
        headers.insert("content-type", HeaderValue::from_static("application/json"));

        let req = sign_request(SignParams {
            method: Method::POST,
            url,
            extra_headers: headers,
            body,
            region: &creds.region,
            service: "ses",
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
        let parsed: Value =
            serde_json::from_str(&text).unwrap_or_else(|_| Value::String(text.clone()));
        Ok(NodeOutput::single(vec![parsed]))
    }
}

fn split_addresses(s: &str) -> Vec<String> {
    s.split(',')
        .map(|p| p.trim().to_string())
        .filter(|p| !p.is_empty())
        .collect()
}
