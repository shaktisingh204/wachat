//! Strongly-typed wrappers for Meta media identifiers.
//!
//! These newtypes prevent accidental cross-wiring of the three different
//! "id-like" strings Meta returns:
//! * `MediaId` — from single-shot upload, used in `messages.image.id`.
//! * `TemplateMediaHandle` — opaque `h` from resumable upload, used in
//!   `components[].example.header_handle[0]`.
//! * The signed URL string returned by `GET /{media_id}` is *not*
//!   wrapped — it's a raw URL with embedded credentials and we want it
//!   to stay easy to drop into a `download(...)` call.

use serde::{Deserialize, Serialize};

/// Single-shot upload result. Pass to the `messages` API as e.g.
/// `image.id` or `document.id`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(transparent)]
pub struct MediaId(pub String);

/// Resumable upload result (`h` field). Pass to template creation as
/// `header_handle[0]`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(transparent)]
pub struct TemplateMediaHandle(pub String);

/// Response of `GET /{media_id}` — describes a stored media object and
/// gives you the **signed** download URL.
///
/// The `url` is short-lived and must be fetched with the same access
/// token that requested it (in an `Authorization: Bearer ...` header).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MediaUrlInfo {
    pub url: String,
    pub mime_type: String,
    pub sha256: String,
    pub file_size: u64,
}
