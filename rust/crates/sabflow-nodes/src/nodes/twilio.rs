//! Twilio node.
//!
//! Implements SMS / MMS messaging and voice calls against the Twilio REST API
//! (https://api.twilio.com/2010-04-01). Authenticates with HTTP Basic using
//! the `twilioApi` credential (`accountSid` + `authToken`).

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

pub struct TwilioNode;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

const TWILIO_API_BASE: &str = "https://api.twilio.com/2010-04-01/Accounts";

#[async_trait]
impl Node for TwilioNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "twilio",
            "Twilio",
            "Send SMS/MMS and make voice calls via Twilio",
            NodeCategory::Communication,
        )
        .icon("phone")
        .color("#F22F46")
        .credentials(vec![CredentialBinding {
            name: "twilioApi".into(),
            display_name: "Twilio Account".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("resource", "Resource", NodePropertyType::Options)
                .options(vec![
                    opt("SMS", "sms"),
                    opt("MMS", "mms"),
                    opt("Call", "call"),
                ])
                .default(json!("sms"))
                .required(),
            // SMS operations
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Send", "send"),
                    opt("Get", "get"),
                    opt("List", "list"),
                ])
                .default(json!("send"))
                .show_when("resource", &["sms"])
                .required(),
            // MMS operations (send only — same flow as SMS plus mediaUrl)
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![opt("Send", "send")])
                .default(json!("send"))
                .show_when("resource", &["mms"])
                .required(),
            // Call operations
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![opt("Make", "make"), opt("Get", "get")])
                .default(json!("make"))
                .show_when("resource", &["call"])
                .required(),
            // Shared "from" / "to" fields for send/make
            NodeProperty::new("from", "From", NodePropertyType::String)
                .placeholder("+15551234567")
                .show_when("operation", &["send", "make"])
                .required(),
            NodeProperty::new("to", "To", NodePropertyType::String)
                .placeholder("+15557654321")
                .show_when("operation", &["send", "make"])
                .required(),
            // SMS / MMS body
            NodeProperty::new("body", "Message Body", NodePropertyType::String)
                .placeholder("Hello from SabFlow!")
                .show_when("operation", &["send"]),
            // MMS media URL — visible only for resource=mms + operation=send
            NodeProperty::new("mediaUrl", "Media URL", NodePropertyType::String)
                .placeholder("https://example.com/image.jpg")
                .show_when("resource", &["mms"])
                .show_when("operation", &["send"]),
            // SMS/MMS retrieval
            NodeProperty::new("messageSid", "Message SID", NodePropertyType::String)
                .placeholder("SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")
                .show_when("resource", &["sms", "mms"])
                .show_when("operation", &["get"]),
            // Call retrieval
            NodeProperty::new("callSid", "Call SID", NodePropertyType::String)
                .placeholder("CAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")
                .show_when("resource", &["call"])
                .show_when("operation", &["get"]),
            // Call TwiML URL
            NodeProperty::new("url", "TwiML URL", NodePropertyType::String)
                .placeholder("https://example.com/twiml.xml")
                .show_when("operation", &["make"]),
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
        let account_sid = cred
            .data
            .get("accountSid")
            .ok_or_else(|| NodeError::MissingParameter("accountSid".into()))?
            .clone();
        let auth_token = cred
            .data
            .get("authToken")
            .ok_or_else(|| NodeError::MissingParameter("authToken".into()))?
            .clone();

        let resource = ctx
            .param_str_opt(params, "resource")
            .unwrap_or_else(|| "sms".to_string());
        let operation = ctx.param_str(params, "operation")?;

        let body: Value = match (resource.as_str(), operation.as_str()) {
            // SMS / MMS send share the same Messages.json endpoint
            ("sms", "send") | ("mms", "send") => {
                let from = ctx.param_str(params, "from")?;
                let to = ctx.param_str(params, "to")?;
                let message_body = ctx.param_str_opt(params, "body").unwrap_or_default();
                let mut form: Vec<(&str, String)> =
                    vec![("From", from), ("To", to), ("Body", message_body)];
                if resource == "mms" {
                    if let Some(media) = ctx.param_str_opt(params, "mediaUrl") {
                        if !media.trim().is_empty() {
                            form.push(("MediaUrl", media));
                        }
                    }
                }
                post_form(ctx, &account_sid, &auth_token, "Messages.json", &form).await?
            }
            ("sms", "get") | ("mms", "get") => {
                let sid = ctx.param_str(params, "messageSid")?;
                let path = format!("Messages/{sid}.json");
                get_json(ctx, &account_sid, &auth_token, &path).await?
            }
            ("sms", "list") | ("mms", "list") => {
                get_json(ctx, &account_sid, &auth_token, "Messages.json").await?
            }
            ("call", "make") => {
                let from = ctx.param_str(params, "from")?;
                let to = ctx.param_str(params, "to")?;
                let url = ctx.param_str(params, "url")?;
                let form: Vec<(&str, String)> = vec![("From", from), ("To", to), ("Url", url)];
                post_form(ctx, &account_sid, &auth_token, "Calls.json", &form).await?
            }
            ("call", "get") => {
                let sid = ctx.param_str(params, "callSid")?;
                let path = format!("Calls/{sid}.json");
                get_json(ctx, &account_sid, &auth_token, &path).await?
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

async fn post_form(
    ctx: &ExecutionContext,
    account_sid: &str,
    auth_token: &str,
    endpoint: &str,
    form: &[(&str, String)],
) -> NodeResult<Value> {
    let url = format!("{TWILIO_API_BASE}/{account_sid}/{endpoint}");
    let res = ctx
        .http
        .post(&url)
        .basic_auth(account_sid, Some(auth_token))
        .form(form)
        .send()
        .await?;
    finalize_response(res).await
}

async fn get_json(
    ctx: &ExecutionContext,
    account_sid: &str,
    auth_token: &str,
    endpoint: &str,
) -> NodeResult<Value> {
    let url = format!("{TWILIO_API_BASE}/{account_sid}/{endpoint}");
    let res = ctx
        .http
        .get(&url)
        .basic_auth(account_sid, Some(auth_token))
        .send()
        .await?;
    finalize_response(res).await
}

async fn finalize_response(res: reqwest::Response) -> NodeResult<Value> {
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
