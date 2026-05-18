//! AWS SNS node — publish messages to a topic.
//!
//! Talks the SNS Query API (form-urlencoded over POST) with SigV4. No
//! `aws-sdk-sns` dependency. Credential schema: `awsApi`.

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

pub struct AwsSnsNode;

#[async_trait]
impl Node for AwsSnsNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "awsSns",
            "AWS SNS",
            "Publish messages to Amazon SNS topics",
            NodeCategory::Communication,
        )
        .icon("megaphone")
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
                        name: "Publish".into(),
                        value: json!("publish"),
                        description: Some("Publish a message to a topic".into()),
                    },
                    NodePropertyOption {
                        name: "List Topics".into(),
                        value: json!("listTopics"),
                        description: Some("List SNS topics in the region".into()),
                    },
                ])
                .default(json!("publish"))
                .required(),
            NodeProperty::new("topicArn", "Topic ARN", NodePropertyType::String)
                .placeholder("arn:aws:sns:us-east-1:123456789012:my-topic")
                .show_when("operation", &["publish"])
                .required(),
            NodeProperty::new("subject", "Subject", NodePropertyType::String)
                .show_when("operation", &["publish"]),
            NodeProperty::new("message", "Message", NodePropertyType::String)
                .show_when("operation", &["publish"])
                .required(),
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

        let mut form: Vec<(String, String)> = Vec::new();
        match operation.as_str() {
            "publish" => {
                let topic_arn = ctx.param_str(params, "topicArn")?;
                let message = ctx.param_str(params, "message")?;
                let subject = ctx.param_str_opt(params, "subject").unwrap_or_default();
                form.push(("Action".into(), "Publish".into()));
                form.push(("Version".into(), "2010-03-31".into()));
                form.push(("TopicArn".into(), topic_arn));
                form.push(("Message".into(), message));
                if !subject.is_empty() {
                    form.push(("Subject".into(), subject));
                }
            }
            "listTopics" => {
                form.push(("Action".into(), "ListTopics".into()));
                form.push(("Version".into(), "2010-03-31".into()));
            }
            other => {
                return Err(NodeError::InvalidParameter {
                    name: "operation".into(),
                    reason: format!("unknown operation: {other}"),
                });
            }
        }

        send_query(ctx, &creds, "sns", form).await
    }
}

/// Shared helper: sign and POST a Query-API form body, parse the XML response
/// into a JSON-ish blob (status + raw XML body — the consumer can re-parse if
/// they care).
pub(crate) async fn send_query(
    ctx: &mut ExecutionContext,
    creds: &AwsCreds,
    service: &str,
    form: Vec<(String, String)>,
) -> NodeResult<NodeOutput> {
    let host = match service {
        "sns" => format!("sns.{}.amazonaws.com", creds.region),
        "sqs" => format!("sqs.{}.amazonaws.com", creds.region),
        "monitoring" => format!("monitoring.{}.amazonaws.com", creds.region),
        other => return Err(NodeError::Other(format!("AWS Query: unsupported service {other}"))),
    };
    let url: reqwest::Url = format!("https://{host}/")
        .parse()
        .map_err(|e| NodeError::Other(format!("AWS Query: bad URL: {e}")))?;

    let body = encode_form(&form);
    let mut headers = HeaderMap::new();
    headers.insert(
        "content-type",
        HeaderValue::from_static("application/x-www-form-urlencoded; charset=utf-8"),
    );

    let req = sign_request(SignParams {
        method: Method::POST,
        url,
        extra_headers: headers,
        body: body.into_bytes(),
        region: &creds.region,
        service,
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
    Ok(NodeOutput::single(vec![json!({
        "statusCode": status.as_u16(),
        "body": text,
    })]))
}

fn encode_form(pairs: &[(String, String)]) -> String {
    pairs
        .iter()
        .map(|(k, v)| format!("{}={}", urlencoding::encode(k), urlencoding::encode(v)))
        .collect::<Vec<_>>()
        .join("&")
}
