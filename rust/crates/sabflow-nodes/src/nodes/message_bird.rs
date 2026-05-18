//! MessageBird (Bird) node.
//!
//! Sends SMS via the MessageBird REST API
//! (`https://rest.messagebird.com/messages`). Auth uses an
//! `Authorization: AccessKey <key>` header.
//!
//! Quality bar: C.5 typed-stub-with-descriptor — `sendSms` is wired.

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

const MESSAGEBIRD_URL: &str = "https://rest.messagebird.com";

pub struct MessageBirdNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for MessageBirdNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "messageBird",
            "MessageBird",
            "Send SMS messages via the MessageBird (Bird) Messaging API",
            NodeCategory::Communication,
        )
        .icon("send")
        .color("#2481D7")
        .credentials(vec![CredentialBinding {
            name: "messageBirdApi".into(),
            display_name: "MessageBird Access Key".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![opt("SMS", "sms")])
                .default(json!("sms"))
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![opt("Send", "send")])
                .default(json!("send"))
                .show_when("resource", &["sms"])
                .required(),
            NodeProperty::new("originator", "Originator (From)", NodePropertyType::String)
                .placeholder("MyBrand")
                .description("Alphanumeric sender ID (max 11 chars) or E.164 number")
                .show_when("operation", &["send"])
                .required(),
            NodeProperty::new("recipients", "Recipients", NodePropertyType::String)
                .placeholder("31612345678,31698765432")
                .description("Comma-separated recipient phone numbers in E.164 (no leading +)")
                .show_when("operation", &["send"])
                .required(),
            NodeProperty::new("body", "Body", NodePropertyType::String)
                .placeholder("Hello from SabFlow!")
                .show_when("operation", &["send"])
                .required(),
            NodeProperty::new("type", "Message Type", NodePropertyType::Options)
                .options(vec![
                    opt("SMS", "sms"),
                    opt("Binary", "binary"),
                    opt("Flash", "flash"),
                ])
                .default(json!("sms"))
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
        let cred = ctx.credential(&cred_id)?;
        let access_key = cred
            .data
            .get("accessKey")
            .and_then(|v| v.as_str())
            .ok_or_else(|| NodeError::MissingParameter("accessKey".into()))?
            .to_string();

        let resource = ctx
            .param_str_opt(params, "resource")
            .unwrap_or_else(|| "sms".to_string());
        let operation = ctx
            .param_str_opt(params, "operation")
            .unwrap_or_else(|| "send".to_string());

        match (resource.as_str(), operation.as_str()) {
            ("sms", "send") => {
                let originator = ctx.param_str(params, "originator")?;
                let recipients_raw = ctx.param_str(params, "recipients")?;
                let body_text = ctx.param_str(params, "body")?;
                let msg_type = ctx
                    .param_str_opt(params, "type")
                    .unwrap_or_else(|| "sms".to_string());

                let recipients: Vec<String> = recipients_raw
                    .split(',')
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .collect();
                if recipients.is_empty() {
                    return Err(NodeError::MissingParameter("recipients".into()));
                }

                let payload = json!({
                    "originator": originator,
                    "recipients": recipients,
                    "body": body_text,
                    "type": msg_type,
                });

                let url = format!("{MESSAGEBIRD_URL}/messages");
                let res = ctx
                    .http
                    .post(&url)
                    .header("Authorization", format!("AccessKey {access_key}"))
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .json(&payload)
                    .send()
                    .await?;
                let status = res.status();
                let text_body = res.text().await.unwrap_or_default();
                let body: Value = serde_json::from_str(&text_body)
                    .unwrap_or(Value::String(text_body.clone()));
                if !status.is_success() {
                    return Err(NodeError::UpstreamError {
                        status: status.as_u16(),
                        body: body.to_string(),
                    });
                }
                Ok(NodeOutput::single(vec![body]))
            }
            (res, op) => Err(NodeError::InvalidParameter {
                name: "operation".into(),
                reason: format!("unsupported messageBird {res} operation: {op}"),
            }),
        }
    }
}
