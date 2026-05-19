//! Sendgrid v3 `/mail/send` adapter.

use anyhow::{Context, Result, anyhow};
use async_trait::async_trait;
use serde_json::json;

use crate::providers::{EmailProvider, OutboundMessage, ProviderReceipt};
use crate::settings::SendgridConfig;

const ENDPOINT: &str = "https://api.sendgrid.com/v3/mail/send";

pub struct SendgridProvider {
    cfg: SendgridConfig,
    http: reqwest::Client,
}

impl SendgridProvider {
    pub fn new(cfg: SendgridConfig) -> Self {
        Self {
            cfg,
            http: reqwest::Client::new(),
        }
    }
}

#[async_trait]
impl EmailProvider for SendgridProvider {
    async fn send(&self, msg: OutboundMessage) -> Result<ProviderReceipt> {
        let mut to = json!({ "email": msg.to_email });
        if let Some(name) = msg.to_name.as_deref() {
            to["name"] = json!(name);
        }
        let body = json!({
            "personalizations": [{ "to": [to], "subject": msg.subject }],
            "from": {
                "email": msg.from_email,
                "name": msg.from_name,
            },
            "reply_to": msg.reply_to.map(|r| json!({ "email": r })),
            "content": [{ "type": "text/html", "value": msg.html }],
            "headers": msg.headers
                .into_iter()
                .collect::<std::collections::BTreeMap<_, _>>(),
        });

        let resp = self
            .http
            .post(ENDPOINT)
            .bearer_auth(&self.cfg.api_key)
            .json(&body)
            .send()
            .await
            .context("sendgrid.post")?;

        let status = resp.status();
        // Sendgrid surfaces the message id in `X-Message-Id` on 202.
        let message_id = resp
            .headers()
            .get("x-message-id")
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_owned());
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(anyhow!("sendgrid {status}: {body}"));
        }
        Ok(ProviderReceipt {
            provider: "sendgrid",
            message_id,
        })
    }
}
