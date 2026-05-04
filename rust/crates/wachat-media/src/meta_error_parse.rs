//! Shared helper: parse Meta's standard error envelope.
//!
//! Meta returns errors in a consistent shape across endpoints:
//! ```json
//! { "error": { "message": "...", "code": 100, "type": "...", "fbtrace_id": "..." } }
//! ```
//! We only pluck the human-facing `message` and the numeric `code`
//! here; richer parsing lives in `wachat-meta-client::MetaApiError` for
//! callers that need it. This crate kept its own copy to avoid a
//! cross-Phase-1 dependency.

use serde::Deserialize;

use crate::error::MediaError;

#[derive(Deserialize)]
struct Inner {
    message: String,
    #[serde(default)]
    code: Option<i64>,
}

#[derive(Deserialize)]
struct Envelope {
    error: Inner,
}

/// Build a `MediaError::MetaApi` from an HTTP status + raw body.
/// Falls back to a `String::from_utf8_lossy` of the body if the
/// envelope can't be parsed (Meta occasionally returns plain text on
/// edge errors like 502).
pub(crate) fn parse_meta_error(status: u16, body: &[u8]) -> MediaError {
    match serde_json::from_slice::<Envelope>(body) {
        Ok(env) => MediaError::MetaApi {
            status,
            message: env.error.message,
            code: env.error.code,
        },
        Err(_) => MediaError::MetaApi {
            status,
            message: String::from_utf8_lossy(body).into_owned(),
            code: None,
        },
    }
}
