//! Media upload / fetch responses for `POST /{phone-number-id}/media` and
//! `GET /{media-id}`.
//!
//! Source of truth: `src/app/actions/whatsapp.actions.ts` (`uploadResponse.data.id`)
//! and `src/app/actions/template.actions.ts` (resumable upload session).
//!
//! Note: the **request** here is a `multipart/form-data` body
//! (`file` + `messaging_product=whatsapp`) — there's no JSON DTO to model.

use serde::{Deserialize, Serialize};

/// Response to `POST /{phone-number-id}/media` — only `id` is read by SabNode.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaUploadResp {
    pub id: String,
}

/// Response to `GET /{media-id}` — used to resolve a downloadable URL.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaUrlResp {
    pub url: String,
    pub mime_type: String,
    pub sha256: String,
    pub file_size: u64,
    pub id: String,
    pub messaging_product: String,
}
