//! Wire DTOs for the `wachat-facebook-content` router.
//!
//! Most read endpoints proxy Meta's response verbatim, so we use
//! `serde_json::Value` for those payloads instead of modelling each Meta
//! field. Write endpoints have explicit request DTOs to keep the API
//! contract stable.
//!
//! Naming follows the camelCase convention used by every other Rust BFF
//! crate so the TS shim doesn't need to translate.

use serde::{Deserialize, Serialize};
use serde_json::Value;

// ---------------------------------------------------------------------------
// Generic envelopes
// ---------------------------------------------------------------------------

/// `{ success: bool, error?: string }` — used by mutation endpoints that
/// don't return a meaningful body. The TS server actions return the same
/// shape.
#[derive(Debug, Clone, Default, Serialize)]
pub struct AckResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl AckResult {
    pub fn ok() -> Self {
        Self {
            success: true,
            error: None,
        }
    }
}

/// `{ message?: string, error?: string }` — used by create/publish flows
/// that mirror Next.js form actions.
#[derive(Debug, Clone, Default, Serialize)]
pub struct MessageResult {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ---------------------------------------------------------------------------
// Posts (feed)
// ---------------------------------------------------------------------------

/// Response envelope for `GET /projects/{id}/posts`. Mirrors the legacy
/// `getFacebookPosts` shape (raw Meta nodes under `posts`, plus a
/// `totalCount` derived from the returned page — Meta does not expose a
/// total).
#[derive(Debug, Clone, Default, Serialize)]
pub struct PostListResponse {
    pub posts: Vec<Value>,
    pub total_count: usize,
}

/// Optional paging metadata returned by `GET /published-posts`.
#[derive(Debug, Clone, Default, Serialize)]
pub struct PublishedPostListResponse {
    pub posts: Vec<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub paging: Option<Value>,
}

/// Cursor query for `GET /published-posts`.
#[derive(Debug, Clone, Default, Deserialize)]
pub struct PublishedPostsQuery {
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub after: Option<String>,
}

/// Schedule clamp metadata that the TS legacy action enforced
/// (`>= now + 10 minutes`). We accept a pre-formed unix timestamp from
/// the shim — the shim does the date-time parsing in the user's locale.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePostBody {
    /// `text` | `image` | `video`. Drives endpoint selection.
    pub post_type: String,
    /// Caption / description / message text (optional for image/video).
    #[serde(default)]
    pub message: Option<String>,
    /// Public media URL. Either this or `mediaId` must be set for
    /// non-text posts. The TS shim uploads file bytes to Meta first and
    /// passes back the resulting URL or id.
    #[serde(default)]
    pub media_url: Option<String>,
    /// Pre-uploaded Meta media id (the alternative to `mediaUrl`).
    #[serde(default)]
    pub media_id: Option<String>,
    /// Comma-separated user-tag ids for image posts.
    #[serde(default)]
    pub tags: Option<String>,
    /// When set, post is created unpublished with the given unix
    /// timestamp (seconds) as `scheduled_publish_time`. The TS shim
    /// validates the `>= now + 10 min` rule and computes this.
    #[serde(default)]
    pub scheduled_publish_time: Option<i64>,
}

/// One row of a bulk-create batch.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BulkPostInput {
    pub message: String,
    #[serde(default)]
    pub image_url: Option<String>,
    /// ISO-8601 string. The TS legacy action parses it as `Date` and
    /// only schedules if it's in the future.
    #[serde(default)]
    pub scheduled_time: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct BulkCreateBody {
    pub posts: Vec<BulkPostInput>,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BulkCreateResult {
    pub success_count: u32,
    pub fail_count: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct UpdatePostBody {
    pub message: String,
}

/// Body for `POST /posts/{id}/crosspost` — list of target page ids.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CrosspostBody {
    pub target_page_ids: Vec<String>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct CrosspostPagesResponse {
    pub pages: Vec<Value>,
}

// ---------------------------------------------------------------------------
// Photos & albums
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Deserialize)]
pub struct CreateAlbumBody {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct CreateAlbumResult {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub album_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ---------------------------------------------------------------------------
// Videos
// ---------------------------------------------------------------------------

/// Body for `POST /videos/{id}/thumbnail`. The shim uploads bytes to Meta
/// first and gives us back either a public URL or a Meta-hosted thumbnail
/// node id.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddThumbnailBody {
    /// Public image URL (the TS shim uploads file bytes to its own CDN
    /// and passes the resulting URL).
    #[serde(default)]
    pub source_url: Option<String>,
    /// Pre-uploaded Meta thumbnail id (alternative to `sourceUrl`).
    #[serde(default)]
    pub thumbnail_id: Option<String>,
}

// ---------------------------------------------------------------------------
// Reels & stories
// ---------------------------------------------------------------------------

/// Body for `POST /reels`. Reel binaries go through Meta's `rupload`
/// endpoint which the TS shim handles; this endpoint just kicks off the
/// finish-and-publish phase given a pre-uploaded `videoId`.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PublishReelBody {
    /// Meta-side video id returned by the shim's upload-phase call. When
    /// absent, the endpoint starts a new upload session and returns the
    /// `videoId` so the shim can stream bytes itself.
    #[serde(default)]
    pub video_id: Option<String>,
    /// Phase: `start` | `finish`. Defaults to `finish` since the TS
    /// shim does the binary upload.
    #[serde(default)]
    pub phase: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublishReelResult {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub video_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PhotoStoryBody {
    /// Public image URL — Meta supports `url=` directly here, so we don't
    /// need a multipart upload.
    pub photo_url: String,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoStoryBody {
    /// Public video URL — uploaded server-side via the `rupload` endpoint
    /// using `file_url=`.
    pub video_url: String,
}

// ---------------------------------------------------------------------------
// Generic list response
// ---------------------------------------------------------------------------

/// Generic `{ data: [...] }` passthrough response. Used by the read-only
/// endpoints that proxy Meta's `data: [...]` array to the client.
#[derive(Debug, Clone, Default, Serialize)]
pub struct DataListResponse {
    pub data: Vec<Value>,
}
