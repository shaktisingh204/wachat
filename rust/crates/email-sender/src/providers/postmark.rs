//! Postmark `/email` adapter.

use anyhow::{Context, Result, anyhow};
use async_trait::async_trait;
use serde_json::json;

use crate::providers::{EmailProvider, OutboundMessage, ProviderReceipt};
use crate::settings::PostmarkConfig;

const ENDPOINT: &str = "https://api.postmarkapp.com/email";

pub struct PostmarkProvider {
    cfg: PostmarkConfig,
    http: reqwest::Client,
}

impl PostmarkProvider {
    pub fn new(cfg: PostmarkConfig) -> Self {
        Self {
            cfg,
            http: reqwest::Client::new(),
        }
    }
}

#[async_trait]
impl EmailProvider for PostmarkProvider {
    async fn send(&self, msg: OutboundMessage) -> Result<ProviderReceipt> {
        let from = if msg.from_name.is_empty() {
            msg.from_email.clone()
        } else {
            format!("{} <{}>", msg.from_name, msg.from_email)
        };
        let to = match msg.to_name.as_deref() {
            Some(n) if !n.is_empty() => format!("{n} <{}>", msg.to_email),
            _ => msg.to_email.clone(),
        };
        let headers: Vec<serde_json::Value> = msg
            .headers
            .into_iter()
            .map(|(k, v)| json!({ "Name": k, "Value": v }))
            .collect();
        let body = json!({
            "From": from,
            "To": to,
            "Subject": msg.subject,
            "HtmlBody": msg.html,
            "ReplyTo": msg.reply_to,
            "Headers": headers,
            "MessageStream": "outbound",
        });
        let resp = self
            .http
            .post(ENDPOINT)
            .header("X-Postmark-Server-Token", &self.cfg.server_token)
            .header("Accept", "application/json")
            .json(&body)
            .send()
            .await
            .context("postmark.post")?;
        let status = resp.status();
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(anyhow!("postmark {status}: {body}"));
        }
        let json: serde_json::Value = resp.json().await.unwrap_or_default();
        let message_id = json
            .get("MessageID")
            .and_then(|v| v.as_str())
            .map(|s| s.to_owned());
        Ok(ProviderReceipt {
            provider: "postmark",
            message_id,
        })
    }
}
