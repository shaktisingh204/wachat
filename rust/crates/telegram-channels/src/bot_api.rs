//! Minimal Telegram Bot API client for channel administration.
//!
//! Mirrors the convention used by the `telegram-bots` crate's client but
//! ships only the methods needed by this crate. We avoid taking a
//! workspace dependency on `telegram-bots` to keep crate graph crisp
//! and to allow this surface area to evolve independently.

use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use thiserror::Error;

const BASE_URL: &str = "https://api.telegram.org";

#[derive(Debug, Error)]
pub enum BotApiError {
    #[error("telegram api error: {0}")]
    Api(String),
    #[error(transparent)]
    Transport(#[from] reqwest::Error),
}

#[derive(Deserialize)]
struct Envelope<T> {
    ok: bool,
    result: Option<T>,
    description: Option<String>,
}

fn unwrap<T>(env: Envelope<T>) -> Result<T, BotApiError> {
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

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Chat {
    pub id: i64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub username: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    /// `"channel"` / `"supergroup"` / `"group"` / `"private"`.
    #[serde(rename = "type", default, skip_serializing_if = "Option::is_none")]
    pub kind: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub invite_link: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_verified: Option<bool>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ChatMember {
    pub status: String,
    pub user: Value,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub can_be_edited: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub can_manage_chat: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub can_post_messages: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub can_edit_messages: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub can_delete_messages: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub can_invite_users: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub can_restrict_members: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub can_promote_members: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub can_change_info: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub can_pin_messages: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub can_manage_video_chats: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_anonymous: Option<bool>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct SentMessage {
    pub message_id: i64,
    #[serde(default)]
    pub date: i64,
    #[serde(default)]
    pub chat: Value,
}

#[derive(Clone)]
pub struct BotApiClient {
    http: reqwest::Client,
}

impl Default for BotApiClient {
    fn default() -> Self {
        Self::new()
    }
}

impl BotApiClient {
    pub fn new() -> Self {
        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(20))
            .build()
            .expect("reqwest::Client::builder()");
        Self { http }
    }

    async fn post_envelope<T: for<'de> Deserialize<'de>>(
        &self,
        token: &str,
        method: &str,
        body: &Value,
    ) -> Result<T, BotApiError> {
        let url = format!("{BASE_URL}/bot{token}/{method}");
        let env: Envelope<T> = self.http.post(url).json(body).send().await?.json().await?;
        unwrap(env)
    }

    pub async fn get_chat(&self, token: &str, chat_id: &str) -> Result<Chat, BotApiError> {
        self.post_envelope(token, "getChat", &json!({ "chat_id": chat_id }))
            .await
    }

    pub async fn get_chat_member_count(
        &self,
        token: &str,
        chat_id: &str,
    ) -> Result<i64, BotApiError> {
        self.post_envelope(token, "getChatMemberCount", &json!({ "chat_id": chat_id }))
            .await
    }

    pub async fn get_chat_member(
        &self,
        token: &str,
        chat_id: &str,
        user_id: i64,
    ) -> Result<ChatMember, BotApiError> {
        self.post_envelope(
            token,
            "getChatMember",
            &json!({ "chat_id": chat_id, "user_id": user_id }),
        )
        .await
    }

    pub async fn get_chat_administrators(
        &self,
        token: &str,
        chat_id: &str,
    ) -> Result<Vec<ChatMember>, BotApiError> {
        self.post_envelope(
            token,
            "getChatAdministrators",
            &json!({ "chat_id": chat_id }),
        )
        .await
    }

    pub async fn promote_chat_member(
        &self,
        token: &str,
        body: &Value,
    ) -> Result<bool, BotApiError> {
        self.post_envelope(token, "promoteChatMember", body).await
    }

    pub async fn send_message(
        &self,
        token: &str,
        body: &Value,
    ) -> Result<SentMessage, BotApiError> {
        self.post_envelope(token, "sendMessage", body).await
    }

    pub async fn send_photo(&self, token: &str, body: &Value) -> Result<SentMessage, BotApiError> {
        self.post_envelope(token, "sendPhoto", body).await
    }

    pub async fn send_video(&self, token: &str, body: &Value) -> Result<SentMessage, BotApiError> {
        self.post_envelope(token, "sendVideo", body).await
    }

    pub async fn send_document(
        &self,
        token: &str,
        body: &Value,
    ) -> Result<SentMessage, BotApiError> {
        self.post_envelope(token, "sendDocument", body).await
    }

    pub async fn send_audio(&self, token: &str, body: &Value) -> Result<SentMessage, BotApiError> {
        self.post_envelope(token, "sendAudio", body).await
    }

    pub async fn send_media_group(
        &self,
        token: &str,
        body: &Value,
    ) -> Result<Vec<SentMessage>, BotApiError> {
        self.post_envelope(token, "sendMediaGroup", body).await
    }

    pub async fn edit_message_text(&self, token: &str, body: &Value) -> Result<Value, BotApiError> {
        self.post_envelope(token, "editMessageText", body).await
    }

    pub async fn edit_message_caption(
        &self,
        token: &str,
        body: &Value,
    ) -> Result<Value, BotApiError> {
        self.post_envelope(token, "editMessageCaption", body).await
    }

    pub async fn delete_message(
        &self,
        token: &str,
        chat_id: &str,
        message_id: i64,
    ) -> Result<bool, BotApiError> {
        self.post_envelope(
            token,
            "deleteMessage",
            &json!({ "chat_id": chat_id, "message_id": message_id }),
        )
        .await
    }

    pub async fn pin_chat_message(
        &self,
        token: &str,
        chat_id: &str,
        message_id: i64,
        disable_notification: bool,
    ) -> Result<bool, BotApiError> {
        self.post_envelope(
            token,
            "pinChatMessage",
            &json!({
                "chat_id": chat_id,
                "message_id": message_id,
                "disable_notification": disable_notification,
            }),
        )
        .await
    }

    pub async fn unpin_chat_message(
        &self,
        token: &str,
        chat_id: &str,
        message_id: i64,
    ) -> Result<bool, BotApiError> {
        self.post_envelope(
            token,
            "unpinChatMessage",
            &json!({ "chat_id": chat_id, "message_id": message_id }),
        )
        .await
    }
}
