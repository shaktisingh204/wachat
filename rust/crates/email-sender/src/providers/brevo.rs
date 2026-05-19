//! Brevo (ex-Sendinblue) `/smtp/email` adapter.

use anyhow::{Context, Result, anyhow};
use async_trait::async_trait;
use serde_json::json;

use crate::providers::{EmailProvider, OutboundMessage, ProviderReceipt};
use crate::settings::BrevoConfig;

const ENDPOINT: &str = "https://api.brevo.com/v3/smtp/email";

pub struct BrevoProvider {
    cfg: BrevoConfig,
    http: reqwest::Client,
}

impl BrevoProvider {
    pub fn new(cfg: BrevoConfig) -> Self {
        Self {
            cfg,
            http: reqwest::Client::new(),
        }
    }
}

#[async_trait]
impl EmailProvider for BrevoProvider {
    async fn send(&self, msg: OutboundMessage) -> Result<ProviderReceipt> {
        let mut to = json!({ "email": msg.to_email });
        if let Some(n) = msg.to_name.as_deref() {
            to["name"] = json!(n);
        }
        let mut body = json!({
            "sender": { "email": msg.from_email, "name": msg.from_name },
            "to": [to],
            "subject": msg.subject,
            "htmlContent": msg.html,
        });
        if let Some(r) = msg.reply_to {
            body["replyTo"] = json!({ "email": r });
        }
        if !msg.headers.is_empty() {
            body["headers"] = serde_json::Value::Object(
                msg.headers
                    .into_iter()
                    .map(|(k, v)| (k, serde_json::Value::String(v)))
                    .collect(),
            );
        }

        let resp = self
            .http
            .post(ENDPOINT)
            .header("api-key", &self.cfg.api_key)
            .header("Accept", "application/json")
            .json(&body)
            .send()
            .await
            .context("brevo.post")?;
        let status = resp.status();
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(anyhow!("brevo {status}: {body}"));
        }
        let json: serde_json::Value = resp.json().await.unwrap_or_default();
        let message_id = json
            .get("messageId")
            .and_then(|v| v.as_str())
            .map(|s| s.to_owned());
        Ok(ProviderReceipt {
            provider: "brevo",
            message_id,
        })
    }
}
