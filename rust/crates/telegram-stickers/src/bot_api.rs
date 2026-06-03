//! Minimal Telegram Bot API client scoped to the sticker methods this
//! crate needs.  Lives here so the stickers crate stays self-contained
//! and the wider workspace state plumbing doesn't need to change.
//!
//! Each method maps 1:1 to a Telegram Bot API endpoint:
//!
//! * `uploadStickerFile`
//! * `createNewStickerSet`
//! * `addStickerToSet`
//! * `deleteStickerFromSet`
//! * `setStickerSetTitle`
//! * `setStickerSetThumbnail`
//! * `setStickerEmojiList`
//! * `setStickerKeywords`
//! * `setStickerMaskPosition`
//! * `setStickerPositionInSet`
//! * `replaceStickerInSet`
//! * `getStickerSet`
//!
//! All responses use Telegram's `{ ok, result, description }` envelope,
//! which we unwrap into a typed [`BotApiError`].

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

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct MaskPosition {
    pub point: String,
    pub x_shift: f64,
    pub y_shift: f64,
    pub scale: f64,
}

/// A Telegram `Sticker` object as returned by `getStickerSet`.
#[derive(Debug, Clone, Default, Deserialize)]
pub struct StickerInfo {
    pub file_id: String,
    pub file_unique_id: Option<String>,
    #[serde(default)]
    pub r#type: String,
    pub width: Option<i64>,
    pub height: Option<i64>,
    pub is_animated: Option<bool>,
    pub is_video: Option<bool>,
    pub emoji: Option<String>,
    pub set_name: Option<String>,
    pub mask_position: Option<MaskPosition>,
    pub custom_emoji_id: Option<String>,
    pub thumbnail: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct StickerSetInfo {
    pub name: String,
    pub title: String,
    /// "regular" | "mask" | "custom_emoji"
    pub sticker_type: String,
    #[serde(default)]
    pub stickers: Vec<StickerInfo>,
    pub thumbnail: Option<serde_json::Value>,
}

#[derive(Deserialize)]
struct Envelope<T> {
    ok: bool,
    result: Option<T>,
    description: Option<String>,
}

/// Result of `uploadStickerFile` — Telegram returns a `File` object;
/// the only field we care about is `file_id` (the handle we hand back
/// to `createNewStickerSet` / `addStickerToSet`).
#[derive(Debug, Clone, Deserialize)]
pub struct UploadedFile {
    pub file_id: String,
    #[serde(default)]
    pub file_unique_id: String,
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
            .timeout(Duration::from_secs(45))
            .build()
            .expect("reqwest::Client::builder()");
        Self { http }
    }

    fn url(&self, token: &str, method: &str) -> String {
        format!("{BASE_URL}/bot{token}/{method}")
    }

    /// `uploadStickerFile` — uploads raw bytes to Telegram and returns
    /// the resulting `file_id`.  `sticker_format` is `"static"`,
    /// `"animated"`, or `"video"`.
    pub async fn upload_sticker_file(
        &self,
        token: &str,
        user_id: i64,
        sticker_format: &str,
        file_name: &str,
        mime: &str,
        bytes: Vec<u8>,
    ) -> Result<UploadedFile, BotApiError> {
        let part = reqwest::multipart::Part::bytes(bytes)
            .file_name(file_name.to_owned())
            .mime_str(mime)
            .map_err(|e| BotApiError::Api(format!("bad mime: {e}")))?;
        let form = reqwest::multipart::Form::new()
            .text("user_id", user_id.to_string())
            .text("sticker_format", sticker_format.to_owned())
            .part("sticker", part);
        let url = self.url(token, "uploadStickerFile");
        let env: Envelope<UploadedFile> = self
            .http
            .post(url)
            .multipart(form)
            .send()
            .await?
            .json()
            .await?;
        unwrap_envelope(env)
    }

    pub async fn create_new_sticker_set(
        &self,
        token: &str,
        body: &serde_json::Value,
    ) -> Result<bool, BotApiError> {
        self.post_json(token, "createNewStickerSet", body).await
    }

    pub async fn add_sticker_to_set(
        &self,
        token: &str,
        body: &serde_json::Value,
    ) -> Result<bool, BotApiError> {
        self.post_json(token, "addStickerToSet", body).await
    }

    pub async fn delete_sticker_from_set(
        &self,
        token: &str,
        sticker_file_id: &str,
    ) -> Result<bool, BotApiError> {
        let body = serde_json::json!({ "sticker": sticker_file_id });
        self.post_json(token, "deleteStickerFromSet", &body).await
    }

    pub async fn set_sticker_set_title(
        &self,
        token: &str,
        name: &str,
        title: &str,
    ) -> Result<bool, BotApiError> {
        let body = serde_json::json!({ "name": name, "title": title });
        self.post_json(token, "setStickerSetTitle", &body).await
    }

    pub async fn set_sticker_set_thumbnail(
        &self,
        token: &str,
        body: &serde_json::Value,
    ) -> Result<bool, BotApiError> {
        self.post_json(token, "setStickerSetThumbnail", body).await
    }

    pub async fn set_sticker_emoji_list(
        &self,
        token: &str,
        sticker_file_id: &str,
        emoji_list: &[String],
    ) -> Result<bool, BotApiError> {
        let body = serde_json::json!({ "sticker": sticker_file_id, "emoji_list": emoji_list });
        self.post_json(token, "setStickerEmojiList", &body).await
    }

    pub async fn set_sticker_keywords(
        &self,
        token: &str,
        sticker_file_id: &str,
        keywords: &[String],
    ) -> Result<bool, BotApiError> {
        let body = serde_json::json!({ "sticker": sticker_file_id, "keywords": keywords });
        self.post_json(token, "setStickerKeywords", &body).await
    }

    pub async fn set_sticker_mask_position(
        &self,
        token: &str,
        sticker_file_id: &str,
        mask_position: Option<&MaskPosition>,
    ) -> Result<bool, BotApiError> {
        let mut body = serde_json::json!({ "sticker": sticker_file_id });
        if let Some(mp) = mask_position {
            body["mask_position"] = serde_json::to_value(mp).unwrap_or(serde_json::Value::Null);
        }
        self.post_json(token, "setStickerMaskPosition", &body).await
    }

    pub async fn set_sticker_position_in_set(
        &self,
        token: &str,
        sticker_file_id: &str,
        position: i64,
    ) -> Result<bool, BotApiError> {
        let body = serde_json::json!({ "sticker": sticker_file_id, "position": position });
        self.post_json(token, "setStickerPositionInSet", &body)
            .await
    }

    pub async fn replace_sticker_in_set(
        &self,
        token: &str,
        body: &serde_json::Value,
    ) -> Result<bool, BotApiError> {
        self.post_json(token, "replaceStickerInSet", body).await
    }

    pub async fn get_sticker_set(
        &self,
        token: &str,
        name: &str,
    ) -> Result<StickerSetInfo, BotApiError> {
        let url = self.url(token, "getStickerSet");
        let body = serde_json::json!({ "name": name });
        let env: Envelope<StickerSetInfo> =
            self.http.post(url).json(&body).send().await?.json().await?;
        unwrap_envelope(env)
    }

    async fn post_json(
        &self,
        token: &str,
        method: &str,
        body: &serde_json::Value,
    ) -> Result<bool, BotApiError> {
        let url = self.url(token, method);
        let env: Envelope<bool> = self.http.post(url).json(body).send().await?.json().await?;
        unwrap_envelope(env)
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

/// Download a file from a public URL (typically a SabFiles R2 URL or
/// the SabFiles raw proxy on the Next.js side). Returns the bytes plus
/// the resolved `Content-Type` / file name when available.  Used to
/// pull a SabFile body server-side and hand it straight to
/// `uploadStickerFile`.
pub async fn fetch_url_bytes(
    client: &reqwest::Client,
    url: &str,
) -> Result<(Vec<u8>, String, String), String> {
    let res = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("fetch failed: {e}"))?;
    if !res.status().is_success() {
        return Err(format!("fetch failed: HTTP {}", res.status()));
    }
    let mime = res
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("application/octet-stream")
        .to_owned();
    // Derive a file name from the URL path (best-effort).
    let name = url
        .split('?')
        .next()
        .and_then(|p| p.rsplit('/').next())
        .unwrap_or("file.bin")
        .to_owned();
    let bytes = res
        .bytes()
        .await
        .map_err(|e| format!("read body failed: {e}"))?
        .to_vec();
    Ok((bytes, mime, name))
}

/// Map a MIME type to one of Telegram's `sticker_format` values.
pub fn sticker_format_for_mime(mime: &str) -> &'static str {
    let m = mime.to_ascii_lowercase();
    if m.contains("tgs") || m.contains("application/x-tgsticker") {
        "animated"
    } else if m.starts_with("video/") || m.contains("webm") {
        "video"
    } else {
        "static"
    }
}
