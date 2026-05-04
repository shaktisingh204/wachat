//! # wachat-media
//!
//! Meta WhatsApp Cloud API **media** transport: upload + download for
//! images, video, audio, documents, and stickers.
//!
//! Two distinct Meta endpoints are surfaced here — they look similar but
//! are *not* interchangeable, and the upstream TypeScript code uses both:
//!
//! * **Single-shot upload** — `POST /{phone-number-id}/media`
//!   (multipart). Returns `{ id }` which you then pass to the
//!   `messages` API as e.g. `image: { id }`. Used when sending media
//!   in conversation. See `MediaUploader::upload_for_messages`.
//!
//! * **Resumable upload** — `POST /{app-id}/uploads` to open a session,
//!   then `POST /{upload-session-id}` with raw bytes. Returns `{ h }`
//!   (a "handle"), which is what Meta's *template* creation endpoint
//!   expects in `header_handle[0]`. See
//!   `MediaUploader::upload_for_template_header`.
//!
//! Note: the resumable upload session call uses `Authorization: OAuth
//! {token}` (matching Meta's docs and the existing TS implementation),
//! not `Bearer`.
//!
//! ## Token policy
//!
//! Token-agnostic. The caller passes the access token to every method.
//! Storage / refresh is owned by `wachat-meta-auth`.
//!
//! ## Privacy
//!
//! We never log raw bytes or signed download URLs — Meta's signed URLs
//! contain short-lived credentials.

pub mod downloader;
pub mod error;
pub mod limits;
mod meta_error_parse;
pub mod types;
pub mod uploader;

pub use downloader::MediaDownloader;
pub use error::MediaError;
pub use limits::{
    MAX_AUDIO_BYTES, MAX_DOCUMENT_BYTES, MAX_IMAGE_BYTES, MAX_STICKER_BYTES, MAX_VIDEO_BYTES,
    check_limits,
};
pub use types::{MediaId, MediaUrlInfo, TemplateMediaHandle};
pub use uploader::MediaUploader;
