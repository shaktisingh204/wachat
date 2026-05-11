//! Send Email node — delivers email via SMTP using the `lettre` crate.
//!
//! Credential schema (`smtp`):
//!   - `host`     — SMTP server hostname
//!   - `port`     — SMTP server port (e.g. 587, 465, 25)
//!   - `username` — SMTP auth username
//!   - `password` — SMTP auth password
//!   - `secure`   — one of "tls" | "starttls" | "none"

use async_trait::async_trait;
use serde_json::{Value, json};

use lettre::{
    AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor,
    message::{Mailbox, MultiPart, SinglePart, header::ContentType},
    transport::smtp::authentication::Credentials,
};

use crate::{
    context::{ExecutionContext, NodeInput, NodeOutput},
    descriptor::{
        CredentialBinding, NodeCategory, NodeDescriptor, NodeProperty, NodePropertyType,
    },
    error::{NodeError, NodeResult},
    node::Node,
};

pub struct EmailSendNode;

#[async_trait]
impl Node for EmailSendNode {
    fn descriptor(&self) -> NodeDescriptor {
        NodeDescriptor::new(
            "emailSend",
            "Send Email",
            "Send email via SMTP",
            NodeCategory::Communication,
        )
        .icon("mail")
        .color("#3b82f6")
        .credentials(vec![CredentialBinding {
            name: "smtp".into(),
            display_name: "SMTP".into(),
            required: true,
        }])
        .properties(vec![
            NodeProperty::new("credentialId", "Credential", NodePropertyType::Credential)
                .required(),
            NodeProperty::new("fromEmail", "From Email", NodePropertyType::String)
                .placeholder("noreply@example.com")
                .required(),
            NodeProperty::new("fromName", "From Name", NodePropertyType::String)
                .placeholder("Acme Inc."),
            NodeProperty::new("toEmail", "To Email", NodePropertyType::String)
                .placeholder("user@example.com, other@example.com")
                .description("Recipient(s). Comma-separated for multiple addresses.")
                .required(),
            NodeProperty::new("cc", "Cc", NodePropertyType::String)
                .description("Comma-separated Cc addresses."),
            NodeProperty::new("bcc", "Bcc", NodePropertyType::String)
                .description("Comma-separated Bcc addresses."),
            NodeProperty::new("replyTo", "Reply-To", NodePropertyType::String),
            NodeProperty::new("subject", "Subject", NodePropertyType::String).required(),
            NodeProperty::new("text", "Text Body", NodePropertyType::String)
                .description("Plain-text body. Optional if HTML is provided."),
            NodeProperty::new("html", "HTML Body", NodePropertyType::String)
                .description("HTML body. Optional if text is provided."),
        ])
    }

    async fn execute(
        &self,
        ctx: &mut ExecutionContext,
        _input: NodeInput,
        params: &Value,
    ) -> NodeResult<NodeOutput> {
        // ---- Credential ----
        let cred_id = ctx.param_str(params, "credentialId")?;
        let cred = ctx.credential(&cred_id)?;

        let host = cred
            .data
            .get("host")
            .filter(|v| !v.is_empty())
            .ok_or_else(|| NodeError::MissingParameter("host".into()))?
            .clone();
        let port_str = cred
            .data
            .get("port")
            .filter(|v| !v.is_empty())
            .ok_or_else(|| NodeError::MissingParameter("port".into()))?
            .clone();
        let port: u16 = port_str.parse().map_err(|_| NodeError::InvalidParameter {
            name: "port".into(),
            reason: format!("invalid port: {port_str}"),
        })?;
        let username = cred.data.get("username").cloned().unwrap_or_default();
        let password = cred.data.get("password").cloned().unwrap_or_default();
        let secure = cred
            .data
            .get("secure")
            .cloned()
            .unwrap_or_else(|| "starttls".to_string())
            .to_lowercase();

        // ---- Params (with {{var}} substitution) ----
        let from_email = ctx.substitute(&ctx.param_str(params, "fromEmail")?);
        let from_name = ctx
            .param_str_opt(params, "fromName")
            .map(|s| ctx.substitute(&s))
            .filter(|s| !s.is_empty());
        let to_email_raw = ctx.substitute(&ctx.param_str(params, "toEmail")?);
        let cc_raw = ctx
            .param_str_opt(params, "cc")
            .map(|s| ctx.substitute(&s))
            .unwrap_or_default();
        let bcc_raw = ctx
            .param_str_opt(params, "bcc")
            .map(|s| ctx.substitute(&s))
            .unwrap_or_default();
        let reply_to_raw = ctx
            .param_str_opt(params, "replyTo")
            .map(|s| ctx.substitute(&s))
            .unwrap_or_default();
        let subject = ctx.substitute(&ctx.param_str(params, "subject")?);
        let text_body = ctx
            .param_str_opt(params, "text")
            .map(|s| ctx.substitute(&s))
            .filter(|s| !s.is_empty());
        let html_body = ctx
            .param_str_opt(params, "html")
            .map(|s| ctx.substitute(&s))
            .filter(|s| !s.is_empty());

        if text_body.is_none() && html_body.is_none() {
            return Err(NodeError::MissingParameter(
                "either 'text' or 'html' body is required".into(),
            ));
        }

        // ---- Build message ----
        let from_mbox = build_mailbox(&from_email, from_name.as_deref(), "fromEmail")?;
        let to_list = parse_address_list(&to_email_raw, "toEmail")?;
        if to_list.is_empty() {
            return Err(NodeError::MissingParameter("toEmail".into()));
        }
        let cc_list = parse_address_list(&cc_raw, "cc")?;
        let bcc_list = parse_address_list(&bcc_raw, "bcc")?;
        let reply_to = if reply_to_raw.trim().is_empty() {
            None
        } else {
            Some(build_mailbox(reply_to_raw.trim(), None, "replyTo")?)
        };

        let mut builder = Message::builder().from(from_mbox).subject(&subject);
        for to in &to_list {
            builder = builder.to(to.clone());
        }
        for cc in &cc_list {
            builder = builder.cc(cc.clone());
        }
        for bcc in &bcc_list {
            builder = builder.bcc(bcc.clone());
        }
        if let Some(rt) = reply_to {
            builder = builder.reply_to(rt);
        }

        let message = match (text_body.as_deref(), html_body.as_deref()) {
            (Some(text), Some(html)) => builder
                .multipart(MultiPart::alternative_plain_html(
                    text.to_string(),
                    html.to_string(),
                ))
                .map_err(|e| NodeError::Other(format!("SMTP: {e}")))?,
            (None, Some(html)) => builder
                .singlepart(
                    SinglePart::builder()
                        .header(ContentType::TEXT_HTML)
                        .body(html.to_string()),
                )
                .map_err(|e| NodeError::Other(format!("SMTP: {e}")))?,
            (Some(text), None) => builder
                .singlepart(
                    SinglePart::builder()
                        .header(ContentType::TEXT_PLAIN)
                        .body(text.to_string()),
                )
                .map_err(|e| NodeError::Other(format!("SMTP: {e}")))?,
            (None, None) => unreachable!(),
        };

        // ---- Build transport ----
        let transport_builder = match secure.as_str() {
            "tls" => AsyncSmtpTransport::<Tokio1Executor>::relay(&host)
                .map_err(|e| NodeError::Other(format!("SMTP: {e}")))?,
            "starttls" => AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(&host)
                .map_err(|e| NodeError::Other(format!("SMTP: {e}")))?,
            "none" => AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous(&host),
            other => {
                return Err(NodeError::InvalidParameter {
                    name: "secure".into(),
                    reason: format!("unknown secure mode: {other} (expected tls|starttls|none)"),
                });
            }
        };

        let mut transport_builder = transport_builder.port(port);
        if !username.is_empty() || !password.is_empty() {
            transport_builder =
                transport_builder.credentials(Credentials::new(username, password));
        }
        let transport: AsyncSmtpTransport<Tokio1Executor> = transport_builder.build();

        // ---- Send ----
        let response = transport
            .send(message)
            .await
            .map_err(|e| NodeError::Other(format!("SMTP: {e}")))?;

        let accepted: Vec<String> = to_list
            .iter()
            .chain(cc_list.iter())
            .chain(bcc_list.iter())
            .map(|m| m.email.to_string())
            .collect();

        let code = response.code();
        let message_lines: Vec<String> =
            response.message().map(|s| s.to_string()).collect();
        let message_id = message_lines
            .iter()
            .find(|line| line.to_ascii_lowercase().contains("queued"))
            .cloned()
            .or_else(|| message_lines.first().cloned())
            .unwrap_or_default();

        Ok(NodeOutput::single(vec![json!({
            "messageId": message_id,
            "accepted": accepted,
            "response": {
                "code": code.to_string(),
                "messages": message_lines,
            },
        })]))
    }
}

fn parse_address_list(raw: &str, field: &str) -> NodeResult<Vec<Mailbox>> {
    let mut out = Vec::new();
    for piece in raw.split(',') {
        let trimmed = piece.trim();
        if trimmed.is_empty() {
            continue;
        }
        out.push(build_mailbox(trimmed, None, field)?);
    }
    Ok(out)
}

fn build_mailbox(addr: &str, display_name: Option<&str>, field: &str) -> NodeResult<Mailbox> {
    // Support "Name <addr@host>" form as well as bare "addr@host".
    let (name, email) = if let (Some(lt), Some(gt)) = (addr.find('<'), addr.rfind('>')) {
        if lt < gt {
            let name_part = addr[..lt].trim().trim_matches('"').to_string();
            let email_part = addr[lt + 1..gt].trim().to_string();
            let name = if name_part.is_empty() {
                None
            } else {
                Some(name_part)
            };
            (name, email_part)
        } else {
            (None, addr.trim().to_string())
        }
    } else {
        (None, addr.trim().to_string())
    };

    let display = display_name
        .map(|s| s.to_string())
        .filter(|s| !s.is_empty())
        .or(name);

    let parsed = email
        .parse()
        .map_err(|e| NodeError::InvalidParameter {
            name: field.to_string(),
            reason: format!("invalid email '{email}': {e}"),
        })?;
    Ok(Mailbox::new(display, parsed))
}
