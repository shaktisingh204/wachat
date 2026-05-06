//! Minimal HTTP client for the Telegram Bot API.
//!
//! Talks to `https://api.telegram.org/bot{token}/...`. The bot token
//! itself is the credential — there is no OAuth, no shared secret. We
//! only implement the four methods the bots crate needs:
//!
//! | Method            | Telegram endpoint   |
//! |-------------------|---------------------|
//! | `get_me`          | `getMe`             |
//! | `set_webhook`     | `setWebhook`        |
//! | `delete_webhook`  | `deleteWebhook`     |
//! | `get_webhook_info`| `getWebhookInfo`    |
//!
//! All responses follow the `{ ok: true, result: T }` /
//! `{ ok: false, description: "…" }` envelope. The client unwraps the
//! envelope and surfaces a [`BotApiError`] either way.

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

#[derive(Debug, Clone, Deserialize)]
pub struct BotMe {
    pub id: i64,
    pub is_bot: bool,
    pub username: Option<String>,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub can_join_groups: Option<bool>,
    pub can_read_all_group_messages: Option<bool>,
    pub supports_inline_queries: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct WebhookInfo {
    pub url: Option<String>,
    pub pending_update_count: Option<i64>,
    pub last_error_message: Option<String>,
    pub last_error_date: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SetWebhookParams<'a> {
    pub url: &'a str,
    pub secret_token: &'a str,
    pub allowed_updates: &'a [&'a str],
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

    pub async fn get_me(&self, token: &str) -> Result<BotMe, BotApiError> {
        let url = format!("{BASE_URL}/bot{token}/getMe");
        let env: Envelope<BotMe> = self.http.get(url).send().await?.json().await?;
        unwrap_envelope(env)
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

    pub async fn delete_webhook(&self, token: &str) -> Result<bool, BotApiError> {
        let url = format!("{BASE_URL}/bot{token}/deleteWebhook");
        let env: Envelope<bool> = self.http.post(url).send().await?.json().await?;
        // Telegram returns ok=true if the webhook was already absent.
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
            env.description.unwrap_or_else(|| "unknown error".to_owned()),
        ))
    }
}
