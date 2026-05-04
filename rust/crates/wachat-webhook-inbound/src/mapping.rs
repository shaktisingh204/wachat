//! Pure functions over [`InboundMessage`] — no I/O, no allocation beyond the
//! returned `String`s. These helpers exist so the storage layer in
//! `processor.rs` and any future text-search / search-index consumer share
//! one canonical interpretation of "what does the user actually want this
//! message to read as".
//!
//! Source of truth for the field paths:
//! - `src/lib/webhook-processor.ts:1370-1410` (`lastMessageText` switch).
//! - Meta WhatsApp Cloud API webhook docs (interactive `button_reply.title`,
//!   `list_reply.title`, button `text`).

use serde_json::Value;
use wachat_meta_dto::webhook::InboundMessage;

/// Returns the user-visible text payload for an inbound message, if any.
///
/// Coverage:
/// - `text` → `text.body`
/// - `button` → `button.text` (template quick-reply taps)
/// - `interactive` → `interactive.button_reply.title` or `interactive.list_reply.title`
///
/// Anything else (image without caption, sticker, location, contacts, audio,
/// unknown) returns `None`. Captions on media are *not* surfaced here — the
/// caller can read them via the original payload if needed; lumping a caption
/// into the same return value would conflate "the user typed text" with "the
/// user attached a captioned image" and downstream NLP / auto-reply triggers
/// care about that distinction.
pub fn extract_text(msg: &InboundMessage) -> Option<String> {
    match msg.r#type.as_str() {
        "text" => msg.text.as_ref().map(|t| t.body.clone()),
        "button" => msg
            .button
            .as_ref()
            .and_then(|b| b.get("text"))
            .and_then(Value::as_str)
            .map(str::to_owned),
        "interactive" => msg.interactive.as_ref().and_then(|i| {
            i.get("button_reply")
                .and_then(|r| r.get("title"))
                .and_then(Value::as_str)
                .map(str::to_owned)
                .or_else(|| {
                    i.get("list_reply")
                        .and_then(|r| r.get("title"))
                        .and_then(Value::as_str)
                        .map(str::to_owned)
                })
        }),
        _ => None,
    }
}

/// Returns the Meta media `id` for any media-bearing message, if present.
///
/// Coverage: `image`, `video`, `audio`, `document`. The DTO doesn't model
/// `sticker` as a typed `MediaBody` (it's not in `InboundMessage`), so a
/// sticker comes through as `r#type == "sticker"` with the body in the
/// original payload — callers needing sticker IDs should read the raw
/// `content` field on the persisted document.
pub fn extract_media_id(msg: &InboundMessage) -> Option<String> {
    let body = match msg.r#type.as_str() {
        "image" => msg.image.as_ref(),
        "video" => msg.video.as_ref(),
        "audio" => msg.audio.as_ref(),
        "document" => msg.document.as_ref(),
        _ => None,
    }?;
    body.id.clone()
}

/// Coarse classification used for analytics / log labels.
///
/// Returns the wire `type` for plain message kinds, and a sub-tag for
/// interactive replies so dashboards can split "button reply taps" from
/// "list reply selections" without re-parsing the payload.
///
/// Returns `"unknown"` for anything not in our enum — we still persist the
/// row (the original `content` is preserved verbatim) so a later schema bump
/// can re-classify historical data.
pub fn message_kind(msg: &InboundMessage) -> &'static str {
    match msg.r#type.as_str() {
        "text" => "text",
        "image" => "image",
        "video" => "video",
        "audio" => "audio",
        "document" => "document",
        "sticker" => "sticker",
        "location" => "location",
        "contacts" => "contacts",
        "button" => "button",
        "interactive" => match msg.interactive.as_ref() {
            Some(v) if v.get("button_reply").is_some() => "interactive_button_reply",
            Some(v) if v.get("list_reply").is_some() => "interactive_list_reply",
            _ => "interactive",
        },
        _ => "unknown",
    }
}
