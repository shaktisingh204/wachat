//! SIGNL4 node — raise, acknowledge, and resolve mobile on-call alerts via
//! the SIGNL4 Webhook API (`https://connect.signl4.com/webhook/{teamSecret}`).
//!
//! Credentials: `signl4Api` with a single `teamSecret` field — the alphanumeric
//! token that identifies a SIGNL4 team. SIGNL4 uses the team secret in the
//! webhook URL path; there is no separate auth header.

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

const SIGNL4_WEBHOOK_BASE: &str = "https://connect.signl4.com/webhook";

pub struct Signl4Node;

fn opt(name: &str, value: &str) -> NodePropertyOption {
    NodePropertyOption {
        name: name.to_string(),
        value: json!(value),
        description: None,
    }
}

#[async_trait]
impl Node for Signl4Node {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "signl4",
            "SIGNL4",
            "Trigger, acknowledge, and resolve SIGNL4 mobile on-call alerts",
            NodeCategory::Communication,
        )
        .icon("siren")
        .color("#E2001A")
        .credentials(vec![CredentialBinding {
            name: "signl4Api".into(),
            display_name: "SIGNL4 API".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("operation", "Operation", NodePropertyType::Options)
                .options(vec![
                    opt("Trigger Alert", "trigger"),
                    opt("Resolve Alert", "resolve"),
                ])
                .default(json!("trigger"))
                .required(),
            // trigger
            NodeProperty::new("title", "Title", NodePropertyType::String)
                .placeholder("Disk almost full")
                .show_when("operation", &["trigger"])
                .required(),
            NodeProperty::new("message", "Message", NodePropertyType::String)
                .placeholder("web-prod-01: /dev/sda1 at 95%")
                .show_when("operation", &["trigger"])
                .required(),
            NodeProperty::new("externalId", "External ID", NodePropertyType::String)
                .placeholder("disk-full-web-prod-01")
                .description(
                    "Optional. Used to correlate trigger/resolve events for the same alert.",
                )
                .show_when("operation", &["trigger", "resolve"]),
            NodeProperty::new("filtering", "Filtering", NodePropertyType::Boolean)
                .default(false)
                .description(
                    "If true, SIGNL4 applies team filtering/categorisation rules before alerting.",
                )
                .show_when("operation", &["trigger"]),
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
        let team_secret = cred
            .data
            .get("teamSecret")
            .ok_or_else(|| NodeError::MissingParameter("teamSecret".into()))?
            .trim()
            .to_string();
        if team_secret.is_empty() {
            return Err(NodeError::MissingParameter("teamSecret".into()));
        }

        let operation = ctx.param_str(params, "operation")?;
        let webhook_url = format!("{SIGNL4_WEBHOOK_BASE}/{team_secret}");

        match operation.as_str() {
            "trigger" => {
                let title = ctx.param_str(params, "title")?;
                if title.trim().is_empty() {
                    return Err(NodeError::MissingParameter("title".into()));
                }
                let message = ctx.param_str(params, "message")?;
                if message.trim().is_empty() {
                    return Err(NodeError::MissingParameter("message".into()));
                }
                let mut payload = json!({
                    "Title": title,
                    "Message": message,
                    "X-S4-Status": "new",
                });
                if let Some(eid) = ctx
                    .param_str_opt(params, "externalId")
                    .filter(|s| !s.is_empty())
                {
                    payload
                        .as_object_mut()
                        .expect("payload is an object")
                        .insert("X-S4-ExternalID".into(), json!(eid));
                }
                let filtering = ctx.param_bool(params, "filtering", false);
                payload
                    .as_object_mut()
                    .expect("payload is an object")
                    .insert("X-S4-Filtering".into(), json!(filtering));

                let res = ctx.http.post(&webhook_url).json(&payload).send().await?;
                finalize(res).await
            }
            "resolve" => {
                let external_id = ctx.param_str(params, "externalId")?;
                if external_id.trim().is_empty() {
                    return Err(NodeError::MissingParameter("externalId".into()));
                }
                let payload = json!({
                    "X-S4-ExternalID": external_id,
                    "X-S4-Status": "resolved",
                });
                let res = ctx.http.post(&webhook_url).json(&payload).send().await?;
                finalize(res).await
            }
            other => Err(NodeError::InvalidParameter {
                name: "operation".into(),
                reason: format!("unknown operation: {other}"),
            }),
        }
    }
}

async fn finalize(res: reqwest::Response) -> NodeResult<NodeOutput> {
    let status = res.status();
    let bytes = res.bytes().await?;
    let body_value = if bytes.is_empty() {
        Value::Null
    } else {
        serde_json::from_slice::<Value>(&bytes)
            .unwrap_or_else(|_| Value::String(String::from_utf8_lossy(&bytes).into_owned()))
    };

    if !status.is_success() {
        let body_str = match &body_value {
            Value::String(s) => s.clone(),
            Value::Null => String::new(),
            other => other.to_string(),
        };
        return Err(NodeError::UpstreamError {
            status: status.as_u16(),
            body: body_str,
        });
    }
    Ok(NodeOutput::single(vec![body_value]))
}
