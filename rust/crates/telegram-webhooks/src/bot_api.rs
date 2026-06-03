//! Tiny HTTP client for the per-bot Telegram webhook lifecycle.
//!
//! We deliberately re-implement just `setWebhook` / `getWebhookInfo` /
//! `deleteWebhook` here so this crate stays self-contained — the
//! telegram-bots crate already maintains its own client and we are
//! forbidden from modifying it.

use std::time::Duration;

use serde::{Deserialize, Serialize};
use thiserror::Error;

const BASE_URL: &str = "https://api.telegram.org";

#[derive(Debug, Error)]
pub enum BotApiError {
    #[error("telegram api error: {0}")]
    Api(String),
    #[error(transparent)]
    Transport(#[from] reqwest::Error),
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct WebhookInfo {
    pub url: Option<String>,
    pub pending_update_count: Option<i64>,
    pub last_error_message: Option<String>,
    pub last_error_date: Option<i64>,
    pub max_connections: Option<i64>,
    pub ip_address: Option<String>,
    pub allowed_updates: Option<Vec<String>>,
    pub has_custom_certificate: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SetWebhookParams<'a> {
    pub url: &'a str,
    pub secret_token: &'a str,
    pub allowed_updates: &'a [String],
    pub max_connections: i64,
    pub drop_pending_updates: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ip_address: Option<&'a str>,
}

#[derive(Deserialize)]
struct Envelope<T> {
    ok: bool,
    result: Option<T>,
    description: Option<String>,
}

#[derive(Clone)]
pub struct BotApiClient {
    http: reqwest::Client,
}

impl BotApiClient {
    pub fn new() -> Self {
        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(15))
            .build()
            .expect("reqwest::Client::builder()");
        Self { http }
    }

    pub async fn set_webhook(
        &self,
        token: &str,
        params: &SetWebhookParams<'_>,
    ) -> Result<bool, BotApiError> {
        let url = format!("{BASE_URL}/bot{token}/setWebhook");
        let env: Envelope<bool> = self
            .http
            .post(url)
            .json(params)
            .send()
            .await?
            .json()
            .await?;
        unwrap_envelope(env)
    }

    pub async fn delete_webhook(
        &self,
        token: &str,
        drop_pending_updates: bool,
    ) -> Result<bool, BotApiError> {
        let url = format!("{BASE_URL}/bot{token}/deleteWebhook");
        let body = serde_json::json!({ "drop_pending_updates": drop_pending_updates });
        let env: Envelope<bool> = self.http.post(url).json(&body).send().await?.json().await?;
        unwrap_envelope(env)
    }

    pub async fn get_webhook_info(&self, token: &str) -> Result<WebhookInfo, BotApiError> {
        let url = format!("{BASE_URL}/bot{token}/getWebhookInfo");
        let env: Envelope<WebhookInfo> = self.http.get(url).send().await?.json().await?;
        unwrap_envelope(env)
    }
}

impl Default for BotApiClient {
    fn default() -> Self {
        Self::new()
    }
}

fn unwrap_envelope<T>(env: Envelope<T>) -> Result<T, BotApiError> {
    if env.ok {
        env.result
            .ok_or_else(|| BotApiError::Api("missing result".to_owned()))
    } else {
        Err(BotApiError::Api(
            env.description
                .unwrap_or_else(|| "unknown error".to_owned()),
        ))
    }
}
