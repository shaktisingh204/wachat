//! Wire shapes for the `telegram-stickers` HTTP API.
//!
//! Mirrors `src/lib/rust-client/telegram-stickers.ts`. All snake_case
//! field names are remapped to camelCase to match the rest of the
//! SabNode BFF convention.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::bot_api::MaskPosition;

// ---------------------------------------------------------------------------
//  Generic ack envelope
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize)]
pub struct AckResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "setId")]
    pub set_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "fileId")]
    pub file_id: Option<String>,
}

// ---------------------------------------------------------------------------
//  Common types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct MaskPositionDto {
    pub point: String,
    #[serde(rename = "xShift")]
    pub x_shift: f64,
    #[serde(rename = "yShift")]
    pub y_shift: f64,
    pub scale: f64,
}

impl From<MaskPositionDto> for MaskPosition {
    fn from(m: MaskPositionDto) -> Self {
        MaskPosition {
            point: m.point,
            x_shift: m.x_shift,
            y_shift: m.y_shift,
            scale: m.scale,
        }
    }
}

impl From<MaskPosition> for MaskPositionDto {
    fn from(m: MaskPosition) -> Self {
        MaskPositionDto {
            point: m.point,
            x_shift: m.x_shift,
            y_shift: m.y_shift,
            scale: m.scale,
        }
    }
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct StickerRow {
    /// Telegram file_id (the stable handle returned by uploadStickerFile).
    #[serde(rename = "fileId")]
    pub file_id: String,
    /// 1-2 emojis describing the sticker.
    #[serde(default)]
    pub emoji: String,
    #[serde(default)]
    pub keywords: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "maskPosition")]
    pub mask_position: Option<MaskPositionDto>,
    #[serde(rename = "positionInSet")]
    pub position_in_set: i64,
    /// "regular" | "mask" | "custom_emoji"
    #[serde(skip_serializing_if = "Option::is_none", rename = "type")]
    pub r#type: Option<String>,
    /// Source SabFile id that produced this sticker, when known.
    #[serde(skip_serializing_if = "Option::is_none", rename = "sabFileId")]
    pub sab_file_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SetRow {
    pub _id: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "botId")]
    pub bot_id: String,
    pub name: String,
    pub title: String,
    /// "regular" | "mask" | "custom_emoji"
    #[serde(rename = "stickerType")]
    pub sticker_type: String,
    #[serde(skip_serializing_if = "Option::is_none", rename = "thumbnailFileId")]
    pub thumbnail_file_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "thumbnailUrl")]
    pub thumbnail_url: Option<String>,
    #[serde(default)]
    pub stickers: Vec<StickerRow>,
    #[serde(rename = "stickerCount")]
    pub sticker_count: i64,
    #[serde(default)]
    pub archived: bool,
    #[serde(
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime",
        rename = "createdAt"
    )]
    pub created_at: DateTime<Utc>,
    #[serde(
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime",
        rename = "updatedAt"
    )]
    pub updated_at: DateTime<Utc>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none",
        rename = "lastSyncedAt"
    )]
    pub last_synced_at: Option<DateTime<Utc>>,
}

// ---------------------------------------------------------------------------
//  Query / request shapes
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct ProjectBotQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
    #[serde(default, rename = "botId")]
    pub bot_id: Option<String>,
    /// When `true` (default), refresh each set from Telegram before
    /// returning the list.
    #[serde(default)]
    pub refresh: Option<bool>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct ListResp {
    pub sets: Vec<SetRow>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct SetResp {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub set: Option<SetRow>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// One sticker as supplied by the dashboard wizard.
#[derive(Debug, Clone, Deserialize)]
pub struct StickerInputBody {
    /// SabFiles node id.  Stored on the local record for traceability.
    #[serde(default, rename = "sabFileId")]
    pub sab_file_id: Option<String>,
    /// Publicly resolvable URL the Rust side will fetch to grab the
    /// bytes (typically the SabFiles R2 URL or the Next.js
    /// `/api/sabfiles/raw/<id>` proxy).
    #[serde(rename = "sabFileUrl")]
    pub sab_file_url: String,
    /// Optional explicit name (otherwise derived from the URL).
    #[serde(default, rename = "sabFileName")]
    pub sab_file_name: Option<String>,
    /// Emoji or list of emojis (Telegram requires 1–20).
    pub emoji: String,
    #[serde(default)]
    pub keywords: Option<Vec<String>>,
    #[serde(default, rename = "maskPosition")]
    pub mask_position: Option<MaskPositionDto>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "botId")]
    pub bot_id: String,
    /// Telegram numeric user id that will own the pack.
    #[serde(rename = "userId")]
    pub user_id: i64,
    /// Telegram pack short_name (will be suffixed with `_by_<bot>` if missing).
    pub name: String,
    pub title: String,
    /// "regular" | "mask" | "custom_emoji"
    #[serde(default, rename = "stickerType")]
    pub sticker_type: Option<String>,
    /// At least one sticker is required to create a pack.
    pub stickers: Vec<StickerInputBody>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AddStickerBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "botId")]
    pub bot_id: String,
    #[serde(rename = "userId")]
    pub user_id: i64,
    pub sticker: StickerInputBody,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SetTitleBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "botId")]
    pub bot_id: String,
    pub title: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SetThumbnailBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "botId")]
    pub bot_id: String,
    #[serde(rename = "userId")]
    pub user_id: i64,
    /// Omit / null to clear the thumbnail.
    #[serde(default, rename = "sabFileId")]
    pub sab_file_id: Option<String>,
    #[serde(default, rename = "sabFileUrl")]
    pub sab_file_url: Option<String>,
    /// "static" | "animated" | "video".  When omitted we infer from the
    /// mime type of the resolved file.
    #[serde(default)]
    pub format: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct EmojiListBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "botId")]
    pub bot_id: String,
    #[serde(rename = "emojiList")]
    pub emoji_list: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct KeywordsBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "botId")]
    pub bot_id: String,
    pub keywords: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct MaskPositionBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "botId")]
    pub bot_id: String,
    #[serde(default, rename = "maskPosition")]
    pub mask_position: Option<MaskPositionDto>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct PositionBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "botId")]
    pub bot_id: String,
    pub position: i64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ReplaceStickerBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(rename = "botId")]
    pub bot_id: String,
    #[serde(rename = "userId")]
    pub user_id: i64,
    #[serde(default, rename = "sabFileId")]
    pub sab_file_id: Option<String>,
    #[serde(rename = "sabFileUrl")]
    pub sab_file_url: String,
    #[serde(default, rename = "sabFileName")]
    pub sab_file_name: Option<String>,
    pub emoji: String,
    #[serde(default)]
    pub keywords: Option<Vec<String>>,
    #[serde(default, rename = "maskPosition")]
    pub mask_position: Option<MaskPositionDto>,
}
