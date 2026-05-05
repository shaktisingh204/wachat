//! Wire DTOs for the wachat-instagram endpoints.
//!
//! The legacy TS server actions in `instagram.actions.ts` returned tagged
//! union shapes — either `{ ... }` for the success payload, or
//! `{ error }` for failure. We preserve that shape here so the TS rust-
//! client shim can be a 1:1 forward without re-wrapping the response.
//!
//! Each DTO is `Serialize + Deserialize` so the same struct can be returned
//! by the axum handler and deserialized on the TS side via `rustFetch<T>`.

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// `getInstagramAccountForPage(projectId)` — `{ instagramAccount?, error? }`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstagramAccountResp {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub instagram_account: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// `getInstagramMedia(projectId)` / `getHashtagRecentMedia` — `{ media?, error? }`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstagramMediaListResp {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub media: Option<Vec<Value>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// `getInstagramMediaDetails(projectId, mediaId)` — `{ media?, error? }`
/// where `media` is the full Graph node (single object, not an array).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstagramMediaDetailsResp {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub media: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// `getInstagramComments(mediaId, projectId)` — `{ comments?, error? }`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstagramCommentsResp {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub comments: Option<Vec<Value>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// `getInstagramStories(projectId)` — `{ stories?, error? }`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstagramStoriesResp {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stories: Option<Vec<Value>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// `discoverInstagramAccount(username, projectId)` — `{ account?, error? }`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstagramDiscoverResp {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub account: Option<Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// `searchHashtagId(hashtag, projectId)` — `{ hashtagId?, error? }`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstagramHashtagIdResp {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hashtag_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// `createInstagramImagePost(...)` — `{ message?, error? }`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstagramImagePostResp {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Body for `POST /v1/instagram/projects/:id/media` — mirrors the
/// `formData` keys the TS action accepted.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateImagePostBody {
    pub image_url: String,
    #[serde(default)]
    pub caption: Option<String>,
}

/// Query string for `GET /v1/instagram/projects/:id/hashtag-search?q=...`.
#[derive(Debug, Clone, Deserialize)]
pub struct HashtagSearchQuery {
    /// The hashtag (without `#`) to look up.
    pub q: String,
}
