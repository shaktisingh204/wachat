//! Mailgun v3 `/messages` adapter.

use anyhow::{Context, Result, anyhow};
use async_trait::async_trait;

use crate::providers::{EmailProvider, OutboundMessage, ProviderReceipt};
use crate::settings::MailgunConfig;

pub struct MailgunProvider {
    cfg: MailgunConfig,
    http: reqwest::Client,
}

impl MailgunProvider {
    pub fn new(cfg: MailgunConfig) -> Self {
        Self {
            cfg,
            http: reqwest::Client::new(),
        }
    }

    fn endpoint(&self) -> String {
        let base = match self.cfg.region.as_deref() {
            Some("eu") | Some("EU") => "https://api.eu.mailgun.net",
            _ => "https://api.mailgun.net",
        };
        format!("{base}/v3/{}/messages", self.cfg.domain)
    }
}

#[async_trait]
impl EmailProvider for MailgunProvider {
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

        let mut form: Vec<(String, String)> = vec![
            ("from".to_owned(), from),
            ("to".to_owned(), to),
            ("subject".to_owned(), msg.subject),
            ("html".to_owned(), msg.html),
        ];
        if let Some(r) = msg.reply_to {
            form.push(("h:Reply-To".to_owned(), r));
        }
        for (k, v) in msg.headers {
            form.push((format!("h:{k}"), v));
        }

        let resp = self
            .http
            .post(self.endpoint())
            .basic_auth("api", Some(&self.cfg.api_key))
            .form(&form)
            .send()
            .await
            .context("mailgun.post")?;

        let status = resp.status();
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(anyhow!("mailgun {status}: {body}"));
        }
        let json: serde_json::Value = resp.json().await.unwrap_or_default();
        let message_id = json
            .get("id")
            .and_then(|v| v.as_str())
            .map(|s| s.to_owned());
        Ok(ProviderReceipt {
            provider: "mailgun",
            message_id,
        })
    }
}
