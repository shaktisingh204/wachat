//! Local Bot API helper for the `telegram-chats` crate.
//!
//! The shared `telegram_bots::bot_api::BotApiClient` does not expose all
//! the methods the chat UI needs (sendPhoto/Video/Document/Audio/Voice,
//! editMessageCaption, copyMessage, pinChatMessage, getChat,
//! getChatMember, etc.). Rather than touch the upstream crate this
//! module reaches the Telegram REST API directly via `reqwest`.
//!
//! All methods return either `serde_json::Value` (when the result is
//! variable shape) or a typed envelope. Errors are reduced to `String`
//! so handlers can pass them straight into [`crate::dto::AckResult`].

use reqwest::{Client, multipart};
use serde::Deserialize;
use serde_json::{Value, json};

const BASE_URL: &str = "https://api.telegram.org";

#[derive(Deserialize)]
struct Envelope<T> {
    ok: bool,
    result: Option<T>,
    description: Option<String>,
}

fn unwrap_env<T>(env: Envelope<T>) -> Result<T, String> {
    if env.ok {
        env.result.ok_or_else(|| "missing result".to_owned())
    } else {
        Err(env
            .description
            .unwrap_or_else(|| "unknown error".to_owned()))
    }
}

#[derive(Clone)]
pub struct BotClient {
    http: Client,
}

impl BotClient {
    pub fn new() -> Self {
        Self {
            http: Client::builder()
                .timeout(std::time::Duration::from_secs(60))
                .build()
                .expect("reqwest client"),
        }
    }

    async fn post_json(&self, token: &str, method: &str, body: &Value) -> Result<Value, String> {
        let url = format!("{BASE_URL}/bot{token}/{method}");
        let res = self
            .http
            .post(&url)
            .json(body)
            .send()
            .await
            .map_err(|e| format!("network: {e}"))?;
        let env: Envelope<Value> = res.json().await.map_err(|e| format!("parse: {e}"))?;
        unwrap_env(env)
    }

    async fn post_multipart(
        &self,
        token: &str,
        method: &str,
        form: multipart::Form,
    ) -> Result<Value, String> {
        let url = format!("{BASE_URL}/bot{token}/{method}");
        let res = self
            .http
            .post(&url)
            .multipart(form)
            .send()
            .await
            .map_err(|e| format!("network: {e}"))?;
        let env: Envelope<Value> = res.json().await.map_err(|e| format!("parse: {e}"))?;
        unwrap_env(env)
    }

    /// Download bytes from a SabFile URL (or any URL). Returns (bytes, content-type, derived-name).
    pub async fn fetch_url(&self, url: &str) -> Result<(Vec<u8>, String, String), String> {
        let res = self
            .http
            .get(url)
            .send()
            .await
            .map_err(|e| format!("download: {e}"))?;
        let mime = res
            .headers()
            .get(reqwest::header::CONTENT_TYPE)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("application/octet-stream")
            .to_owned();
        // Derive a reasonable filename from the URL path.
        let name = url
            .rsplit('/')
            .find(|s| !s.is_empty())
            .unwrap_or("file")
            .split('?')
            .next()
            .unwrap_or("file")
            .to_owned();
        let bytes = res
            .bytes()
            .await
            .map_err(|e| format!("download body: {e}"))?
            .to_vec();
        Ok((bytes, mime, name))
    }

    // ---- text -------------------------------------------------------

    pub async fn send_message(
        &self,
        token: &str,
        chat_id: &str,
        text: &str,
        parse_mode: Option<&str>,
        reply_to_message_id: Option<i64>,
        disable_web_page_preview: Option<bool>,
        disable_notification: Option<bool>,
    ) -> Result<Value, String> {
        let mut body = json!({ "chat_id": chat_id, "text": text });
        if let Some(p) = parse_mode {
            body["parse_mode"] = Value::String(p.to_owned());
        }
        if let Some(r) = reply_to_message_id {
            body["reply_to_message_id"] = Value::from(r);
        }
        if let Some(d) = disable_web_page_preview {
            body["disable_web_page_preview"] = Value::Bool(d);
        }
        if let Some(d) = disable_notification {
            body["disable_notification"] = Value::Bool(d);
        }
        self.post_json(token, "sendMessage", &body).await
    }

    /// Send a media message by uploading bytes via multipart.
    ///
    /// `kind` ∈ photo | video | document | audio | voice.
    pub async fn send_media(
        &self,
        token: &str,
        kind: &str,
        chat_id: &str,
        file_name: &str,
        mime: &str,
        bytes: Vec<u8>,
        caption: Option<&str>,
        parse_mode: Option<&str>,
        reply_to_message_id: Option<i64>,
        disable_notification: Option<bool>,
    ) -> Result<Value, String> {
        let method = match kind {
            "photo" => "sendPhoto",
            "video" => "sendVideo",
            "document" => "sendDocument",
            "audio" => "sendAudio",
            "voice" => "sendVoice",
            other => return Err(format!("unsupported media kind: {other}")),
        };
        let field = kind; // photo, video, document, audio, voice
        let part = multipart::Part::bytes(bytes)
            .file_name(file_name.to_owned())
            .mime_str(mime)
            .map_err(|e| format!("mime: {e}"))?;

        let mut form = multipart::Form::new()
            .text("chat_id", chat_id.to_owned())
            .part(field.to_owned(), part);
        if let Some(c) = caption {
            form = form.text("caption", c.to_owned());
        }
        if let Some(p) = parse_mode {
            form = form.text("parse_mode", p.to_owned());
        }
        if let Some(r) = reply_to_message_id {
            form = form.text("reply_to_message_id", r.to_string());
        }
        if let Some(d) = disable_notification {
            form = form.text("disable_notification", d.to_string());
        }
        self.post_multipart(token, method, form).await
    }

    pub async fn edit_message_text(
        &self,
        token: &str,
        chat_id: &str,
        message_id: i64,
        text: &str,
        parse_mode: Option<&str>,
    ) -> Result<Value, String> {
        let mut body = json!({
            "chat_id": chat_id,
            "message_id": message_id,
            "text": text,
        });
        if let Some(p) = parse_mode {
            body["parse_mode"] = Value::String(p.to_owned());
        }
        self.post_json(token, "editMessageText", &body).await
    }

    pub async fn edit_message_caption(
        &self,
        token: &str,
        chat_id: &str,
        message_id: i64,
        caption: &str,
        parse_mode: Option<&str>,
    ) -> Result<Value, String> {
        let mut body = json!({
            "chat_id": chat_id,
            "message_id": message_id,
            "caption": caption,
        });
        if let Some(p) = parse_mode {
            body["parse_mode"] = Value::String(p.to_owned());
        }
        self.post_json(token, "editMessageCaption", &body).await
    }

    pub async fn delete_message(
        &self,
        token: &str,
        chat_id: &str,
        message_id: i64,
    ) -> Result<bool, String> {
        let body = json!({ "chat_id": chat_id, "message_id": message_id });
        let url = format!("{BASE_URL}/bot{token}/deleteMessage");
        let res = self
            .http
            .post(&url)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("network: {e}"))?;
        let env: Envelope<bool> = res.json().await.map_err(|e| format!("parse: {e}"))?;
        unwrap_env(env)
    }

    pub async fn forward_message(
        &self,
        token: &str,
        from_chat_id: &str,
        to_chat_id: &str,
        message_id: i64,
        disable_notification: Option<bool>,
    ) -> Result<Value, String> {
        let mut body = json!({
            "chat_id": to_chat_id,
            "from_chat_id": from_chat_id,
            "message_id": message_id,
        });
        if let Some(d) = disable_notification {
            body["disable_notification"] = Value::Bool(d);
        }
        self.post_json(token, "forwardMessage", &body).await
    }

    pub async fn copy_message(
        &self,
        token: &str,
        from_chat_id: &str,
        to_chat_id: &str,
        message_id: i64,
        caption: Option<&str>,
        parse_mode: Option<&str>,
    ) -> Result<Value, String> {
        let mut body = json!({
            "chat_id": to_chat_id,
            "from_chat_id": from_chat_id,
            "message_id": message_id,
        });
        if let Some(c) = caption {
            body["caption"] = Value::String(c.to_owned());
        }
        if let Some(p) = parse_mode {
            body["parse_mode"] = Value::String(p.to_owned());
        }
        self.post_json(token, "copyMessage", &body).await
    }

    pub async fn send_chat_action(
        &self,
        token: &str,
        chat_id: &str,
        action: &str,
    ) -> Result<bool, String> {
        let body = json!({ "chat_id": chat_id, "action": action });
        let url = format!("{BASE_URL}/bot{token}/sendChatAction");
        let res = self
            .http
            .post(&url)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("network: {e}"))?;
        let env: Envelope<bool> = res.json().await.map_err(|e| format!("parse: {e}"))?;
        unwrap_env(env)
    }

    pub async fn get_chat(&self, token: &str, chat_id: &str) -> Result<Value, String> {
        let body = json!({ "chat_id": chat_id });
        self.post_json(token, "getChat", &body).await
    }

    pub async fn get_chat_member(
        &self,
        token: &str,
        chat_id: &str,
        user_id: i64,
    ) -> Result<Value, String> {
        let body = json!({ "chat_id": chat_id, "user_id": user_id });
        self.post_json(token, "getChatMember", &body).await
    }

    pub async fn get_chat_member_count(&self, token: &str, chat_id: &str) -> Result<i64, String> {
        let body = json!({ "chat_id": chat_id });
        let url = format!("{BASE_URL}/bot{token}/getChatMemberCount");
        let res = self
            .http
            .post(&url)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("network: {e}"))?;
        let env: Envelope<i64> = res.json().await.map_err(|e| format!("parse: {e}"))?;
        unwrap_env(env)
    }

    pub async fn pin_chat_message(
        &self,
        token: &str,
        chat_id: &str,
        message_id: i64,
        disable_notification: Option<bool>,
    ) -> Result<bool, String> {
        let mut body = json!({ "chat_id": chat_id, "message_id": message_id });
        if let Some(d) = disable_notification {
            body["disable_notification"] = Value::Bool(d);
        }
        let url = format!("{BASE_URL}/bot{token}/pinChatMessage");
        let res = self
            .http
            .post(&url)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("network: {e}"))?;
        let env: Envelope<bool> = res.json().await.map_err(|e| format!("parse: {e}"))?;
        unwrap_env(env)
    }

    pub async fn unpin_chat_message(
        &self,
        token: &str,
        chat_id: &str,
        message_id: Option<i64>,
    ) -> Result<bool, String> {
        let mut body = json!({ "chat_id": chat_id });
        if let Some(m) = message_id {
            body["message_id"] = Value::from(m);
        }
        let url = format!("{BASE_URL}/bot{token}/unpinChatMessage");
        let res = self
            .http
            .post(&url)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("network: {e}"))?;
        let env: Envelope<bool> = res.json().await.map_err(|e| format!("parse: {e}"))?;
        unwrap_env(env)
    }
}

impl Default for BotClient {
    fn default() -> Self {
        Self::new()
    }
}
