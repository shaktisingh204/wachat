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

// ---------------------------------------------------------------------------
//  Send / edit / delete / forward / typing
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Default)]
pub struct SendMessageParams<'a> {
    pub chat_id: &'a str,
    pub text: &'a str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parse_mode: Option<&'a str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reply_to_message_id: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub business_connection_id: Option<&'a str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub disable_web_page_preview: Option<bool>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SentMessage {
    pub message_id: i64,
    #[serde(default)]
    pub chat: serde_json::Value,
    #[serde(default)]
    pub date: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct SendChatActionParams<'a> {
    pub chat_id: &'a str,
    pub action: &'a str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub business_connection_id: Option<&'a str>,
}

#[derive(Debug, Clone, Serialize)]
pub struct EditMessageTextParams<'a> {
    pub chat_id: &'a str,
    pub message_id: i64,
    pub text: &'a str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parse_mode: Option<&'a str>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ForwardMessageParams<'a> {
    pub chat_id: &'a str,
    pub from_chat_id: &'a str,
    pub message_id: i64,
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

    pub async fn send_message(
        &self,
        token: &str,
        params: &SendMessageParams<'_>,
    ) -> Result<SentMessage, BotApiError> {
        let url = format!("{BASE_URL}/bot{token}/sendMessage");
        let env: Envelope<SentMessage> = self
            .http
            .post(url)
            .json(params)
            .send()
            .await?
            .json()
            .await?;
        unwrap_envelope(env)
    }

    pub async fn send_chat_action(
        &self,
        token: &str,
        params: &SendChatActionParams<'_>,
    ) -> Result<bool, BotApiError> {
        let url = format!("{BASE_URL}/bot{token}/sendChatAction");
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

    pub async fn edit_message_text(
        &self,
        token: &str,
        params: &EditMessageTextParams<'_>,
    ) -> Result<serde_json::Value, BotApiError> {
        let url = format!("{BASE_URL}/bot{token}/editMessageText");
        let env: Envelope<serde_json::Value> = self
            .http
            .post(url)
            .json(params)
            .send()
            .await?
            .json()
            .await?;
        unwrap_envelope(env)
    }

    pub async fn delete_message(
        &self,
        token: &str,
        chat_id: &str,
        message_id: i64,
    ) -> Result<bool, BotApiError> {
        let url = format!("{BASE_URL}/bot{token}/deleteMessage");
        let body = serde_json::json!({ "chat_id": chat_id, "message_id": message_id });
        let env: Envelope<bool> = self
            .http
            .post(url)
            .json(&body)
            .send()
            .await?
            .json()
            .await?;
        unwrap_envelope(env)
    }

    pub async fn forward_message(
        &self,
        token: &str,
        params: &ForwardMessageParams<'_>,
    ) -> Result<SentMessage, BotApiError> {
        let url = format!("{BASE_URL}/bot{token}/forwardMessage");
        let env: Envelope<SentMessage> = self
            .http
            .post(url)
            .json(params)
            .send()
            .await?
            .json()
            .await?;
        unwrap_envelope(env)
    }

    // -- bot commands -----------------------------------------------------

    pub async fn set_my_commands(
        &self,
        token: &str,
        commands: &[BotCommand],
    ) -> Result<bool, BotApiError> {
        let url = format!("{BASE_URL}/bot{token}/setMyCommands");
        let body = serde_json::json!({ "commands": commands });
        let env: Envelope<bool> = self
            .http
            .post(url)
            .json(&body)
            .send()
            .await?
            .json()
            .await?;
        unwrap_envelope(env)
    }

    pub async fn get_my_commands(
        &self,
        token: &str,
    ) -> Result<Vec<BotCommand>, BotApiError> {
        let url = format!("{BASE_URL}/bot{token}/getMyCommands");
        let env: Envelope<Vec<BotCommand>> = self.http.get(url).send().await?.json().await?;
        unwrap_envelope(env)
    }

    // -- profile fields ---------------------------------------------------

    pub async fn set_my_name(&self, token: &str, name: &str) -> Result<bool, BotApiError> {
        let url = format!("{BASE_URL}/bot{token}/setMyName");
        let body = serde_json::json!({ "name": name });
        let env: Envelope<bool> = self
            .http
            .post(url)
            .json(&body)
            .send()
            .await?
            .json()
            .await?;
        unwrap_envelope(env)
    }

    pub async fn set_my_description(
        &self,
        token: &str,
        description: &str,
    ) -> Result<bool, BotApiError> {
        let url = format!("{BASE_URL}/bot{token}/setMyDescription");
        let body = serde_json::json!({ "description": description });
        let env: Envelope<bool> = self
            .http
            .post(url)
            .json(&body)
            .send()
            .await?
            .json()
            .await?;
        unwrap_envelope(env)
    }

    pub async fn set_my_short_description(
        &self,
        token: &str,
        short_description: &str,
    ) -> Result<bool, BotApiError> {
        let url = format!("{BASE_URL}/bot{token}/setMyShortDescription");
        let body = serde_json::json!({ "short_description": short_description });
        let env: Envelope<bool> = self
            .http
            .post(url)
            .json(&body)
            .send()
            .await?
            .json()
            .await?;
        unwrap_envelope(env)
    }

    // -- chat menu button -------------------------------------------------

    pub async fn set_chat_menu_button(
        &self,
        token: &str,
        menu_button: &serde_json::Value,
    ) -> Result<bool, BotApiError> {
        let url = format!("{BASE_URL}/bot{token}/setChatMenuButton");
        let body = serde_json::json!({ "menu_button": menu_button });
        let env: Envelope<bool> = self
            .http
            .post(url)
            .json(&body)
            .send()
            .await?
            .json()
            .await?;
        unwrap_envelope(env)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BotCommand {
    pub command: String,
    pub description: String,
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
