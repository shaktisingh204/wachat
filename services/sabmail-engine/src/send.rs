//! SMTP send via lettre — the own-domain / transactional / campaign delivery
//! path. Loads the account, decrypts its SMTP creds, and sends.

use std::sync::Arc;

use lettre::message::{Mailbox, MultiPart};
use lettre::transport::smtp::authentication::Credentials;
use lettre::{AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor};
use mongodb::bson::{doc, oid::ObjectId, Document};
use serde::Deserialize;
use uuid::Uuid;

use crate::{db, creds, errors::EngineError, errors::EngineResult, state::AppState};

#[derive(Debug, Deserialize)]
pub struct SendRequest {
    #[serde(rename = "workspaceId")]
    pub workspace_id: String,
    #[serde(rename = "accountId")]
    pub account_id: String,
    pub to: Vec<String>,
    #[serde(default)]
    pub cc: Vec<String>,
    #[serde(default)]
    pub bcc: Vec<String>,
    pub subject: String,
    #[serde(default)]
    pub html: Option<String>,
    #[serde(default)]
    pub text: Option<String>,
}

fn parse_mbox(raw: &str) -> Option<Mailbox> {
    let s = raw.trim();
    if s.is_empty() {
        return None;
    }
    s.parse::<Mailbox>().ok()
}

/// Send a message through the account's SMTP server. Returns the Message-ID.
pub async fn send_message(state: &Arc<AppState>, req: SendRequest) -> EngineResult<String> {
    if req.to.is_empty() {
        return Err(EngineError::BadRequest("at least one recipient is required".into()));
    }
    let oid = ObjectId::parse_str(&req.account_id)
        .map_err(|_| EngineError::BadRequest("invalid account id".into()))?;

    let accounts = state.mongo.collection::<Document>(db::COL_ACCOUNTS);
    let account = accounts
        .find_one(doc! { "_id": oid, "workspaceId": &req.workspace_id })
        .await?
        .ok_or(EngineError::NotFound)?;

    let smtp = account
        .get_document("smtp")
        .map_err(|_| EngineError::BadRequest("mailbox has no SMTP configured".into()))?;
    let host = smtp
        .get_str("host")
        .map_err(|_| EngineError::BadRequest("smtp.host missing".into()))?
        .to_string();
    let port = smtp.get_i32("port").unwrap_or(587) as u16;
    let secure = smtp.get_bool("secure").unwrap_or(false);

    let email_addr = account
        .get_str("email")
        .map_err(|_| EngineError::BadRequest("account email missing".into()))?
        .to_string();
    let display = account.get_str("displayName").ok();
    let from_raw = match display {
        Some(name) if !name.is_empty() => format!("{name} <{email_addr}>"),
        _ => email_addr.clone(),
    };

    let cipher = account
        .get_str("credentialsCipher")
        .map_err(|_| EngineError::BadRequest("mailbox has no stored credentials".into()))?;
    let key_hex = state
        .cfg
        .creds_key_hex
        .as_deref()
        .ok_or_else(|| EngineError::BadRequest("SABMAIL_CREDS_KEY is not configured".into()))?;
    let blob = creds::decrypt_creds(key_hex, &req.workspace_id, cipher)
        .map_err(|e| EngineError::BadRequest(format!("credential decrypt failed: {e}")))?;
    let smtp_user = blob
        .get("smtpUser")
        .and_then(|v| v.as_str())
        .or_else(|| blob.get("imapUser").and_then(|v| v.as_str()))
        .unwrap_or("")
        .to_string();
    let smtp_pass = blob
        .get("smtpPass")
        .and_then(|v| v.as_str())
        .or_else(|| blob.get("imapPass").and_then(|v| v.as_str()))
        .unwrap_or("")
        .to_string();

    // Build the message.
    let from_mbox = parse_mbox(&from_raw)
        .ok_or_else(|| EngineError::BadRequest("invalid From address".into()))?;
    let message_id = format!(
        "<{}@{}>",
        Uuid::new_v4(),
        email_addr.split('@').nth(1).unwrap_or("sabmail.local")
    );

    let mut builder = Message::builder()
        .from(from_mbox)
        .subject(req.subject.clone())
        .message_id(Some(message_id.clone()));
    let mut any_to = false;
    for t in &req.to {
        if let Some(m) = parse_mbox(t) {
            builder = builder.to(m);
            any_to = true;
        }
    }
    if !any_to {
        return Err(EngineError::BadRequest("no valid recipient addresses".into()));
    }
    for c in &req.cc {
        if let Some(m) = parse_mbox(c) {
            builder = builder.cc(m);
        }
    }
    for b in &req.bcc {
        if let Some(m) = parse_mbox(b) {
            builder = builder.bcc(m);
        }
    }

    let text = req.text.clone().unwrap_or_default();
    let email = match &req.html {
        Some(html) if !html.is_empty() => builder
            .multipart(MultiPart::alternative_plain_html(text, html.clone()))
            .map_err(|e| EngineError::Send(format!("building message: {e}")))?,
        _ => builder
            .body(if text.is_empty() { " ".to_string() } else { text })
            .map_err(|e| EngineError::Send(format!("building message: {e}")))?,
    };

    // Build the transport (implicit TLS on :465, STARTTLS otherwise).
    let builder = if secure {
        AsyncSmtpTransport::<Tokio1Executor>::relay(&host)
    } else {
        AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(&host)
    }
    .map_err(|e| EngineError::Send(format!("smtp setup: {e}")))?;

    let mailer = builder
        .port(port)
        .credentials(Credentials::new(smtp_user, smtp_pass))
        .build();

    mailer
        .send(email)
        .await
        .map_err(|e| EngineError::Send(e.to_string()))?;

    Ok(message_id)
}
