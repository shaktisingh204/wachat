//! Vonage (formerly Nexmo) node.
//!
//! Sends SMS via the Vonage SMS API
//! (`https://rest.nexmo.com/sms/json`). Credentials use API key / secret
//! form-body authentication — the most common Vonage SMS auth path.
//!
//! Quality bar: C.5 typed-stub-with-descriptor — the `sendSms` operation is
//! fully wired; additional resources/operations land in follow-up work.

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

const VONAGE_SMS_URL: &str = "https://rest.nexmo.com/sms/json";

pub struct VonageNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for VonageNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "vonage",
            "Vonage",
            "Send SMS messages via the Vonage (Nexmo) Messaging API",
            NodeCategory::Communication,
        )
        .icon("phone")
        .color("#871FFF")
        .credentials(vec![CredentialBinding {
            name: "vonageApi".into(),
            display_name: "Vonage API Key & Secret".into(),
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
            NodeProperty::new("from", "From", NodePropertyType::String)
                .placeholder("MyBrand")
                .description("Sender ID (alphanumeric, max 11 chars) or E.164 number")
                .show_when("operation", &["send"])
                .required(),
            NodeProperty::new("to", "To", NodePropertyType::String)
                .placeholder("15551234567")
                .description("Recipient phone number in E.164 (no leading +)")
                .show_when("operation", &["send"])
                .required(),
            NodeProperty::new("text", "Text", NodePropertyType::String)
                .placeholder("Hello from SabFlow!")
                .show_when("operation", &["send"])
                .required(),
            NodeProperty::new("type", "Message Type", NodePropertyType::Options)
                .options(vec![
                    opt("Text", "text"),
                    opt("Unicode", "unicode"),
                    opt("Binary", "binary"),
                ])
                .default(json!("text"))
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
        let api_key = cred
            .data
            .get("apiKey")
            .and_then(|v| v.as_str())
            .ok_or_else(|| NodeError::MissingParameter("apiKey".into()))?
            .to_string();
        let api_secret = cred
            .data
            .get("apiSecret")
            .and_then(|v| v.as_str())
            .ok_or_else(|| NodeError::MissingParameter("apiSecret".into()))?
            .to_string();

        let resource = ctx
            .param_str_opt(params, "resource")
            .unwrap_or_else(|| "sms".to_string());
        let operation = ctx
            .param_str_opt(params, "operation")
            .unwrap_or_else(|| "send".to_string());

        match (resource.as_str(), operation.as_str()) {
            ("sms", "send") => {
                let from = ctx.param_str(params, "from")?;
                let to = ctx.param_str(params, "to")?;
                let text = ctx.param_str(params, "text")?;
                let msg_type = ctx
                    .param_str_opt(params, "type")
                    .unwrap_or_else(|| "text".to_string());

                let form = [
                    ("api_key", api_key.as_str()),
                    ("api_secret", api_secret.as_str()),
                    ("from", from.as_str()),
                    ("to", to.as_str()),
                    ("text", text.as_str()),
                    ("type", msg_type.as_str()),
                ];

                let res = ctx
                    .http
                    .post(VONAGE_SMS_URL)
                    .header("Accept", "application/json")
                    .form(&form)
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
                reason: format!("unsupported vonage {res} operation: {op}"),
            }),
        }
    }
}
