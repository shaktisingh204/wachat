//! Per-type size limits for WhatsApp Cloud media.
//!
//! Numbers come from Meta's published limits (as of v20+). They're
//! **upper bounds** — Meta may reject smaller files for other reasons
//! (codec, duration, etc.), but we enforce these here to fail fast
//! before sending bytes over the wire.
//!
//! See: <https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media>

use crate::error::MediaError;

/// 5 MB.
pub const MAX_IMAGE_BYTES: u64 = 5 * 1024 * 1024;
/// 16 MB.
pub const MAX_VIDEO_BYTES: u64 = 16 * 1024 * 1024;
/// 16 MB.
pub const MAX_AUDIO_BYTES: u64 = 16 * 1024 * 1024;
/// 100 MB.
pub const MAX_DOCUMENT_BYTES: u64 = 100 * 1024 * 1024;
/// 100 KB. Stickers are tiny on purpose — Meta wants webp-only here.
pub const MAX_STICKER_BYTES: u64 = 100 * 1024;

/// Validate that a `(mime, size)` pair is acceptable to Meta.
///
/// Returns `Ok(())` for any supported `mime/*` family within its size
/// limit, `Unsupported` if the top-level type isn't recognised, and
/// `TooLarge` if the byte count exceeds the per-type cap.
pub fn check_limits(mime: &str, size: u64) -> Result<(), MediaError> {
    // image/webp can be a sticker (100 KB cap) OR a regular image
    // (5 MB cap). We accept up to the looser image cap here — callers
    // that specifically want sticker semantics can re-check against
    // `MAX_STICKER_BYTES` themselves.
    if mime.eq_ignore_ascii_case("image/webp") {
        return if size <= MAX_IMAGE_BYTES {
            Ok(())
        } else {
            Err(MediaError::TooLarge(size))
        };
    }

    let (top, _sub) = mime
        .split_once('/')
        .ok_or_else(|| MediaError::Unsupported(format!("malformed mime: {mime}")))?;

    let limit = match top.to_ascii_lowercase().as_str() {
        "image" => MAX_IMAGE_BYTES,
        "video" => MAX_VIDEO_BYTES,
        "audio" => MAX_AUDIO_BYTES,
        "application" | "text" => MAX_DOCUMENT_BYTES,
        other => return Err(MediaError::Unsupported(other.to_owned())),
    };

    if size > limit {
        Err(MediaError::TooLarge(size))
    } else {
        Ok(())
    }
}
