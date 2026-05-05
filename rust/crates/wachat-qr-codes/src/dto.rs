//! DTOs for the WhatsApp QR-code (`message_qrdls`) endpoints.
//!
//! Field names mirror the Meta wire shape (see
//! <https://developers.facebook.com/docs/whatsapp/business-management-api/qr-codes>),
//! using `serde(rename_all = "snake_case")` where the wire keys differ
//! from the idiomatic Rust casing.

use serde::{Deserialize, Serialize};

/// Image format for `generate_qr_image` on create. Meta accepts the
/// literal strings `"PNG"` or `"SVG"`. The TS handler at L978 hard-codes
/// `"SVG"`; we expose both so callers can pick.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum ImageFormat {
    Png,
    Svg,
}

impl ImageFormat {
    /// Wire string Meta expects in the request body.
    pub fn as_meta_str(self) -> &'static str {
        match self {
            ImageFormat::Png => "PNG",
            ImageFormat::Svg => "SVG",
        }
    }
}

/// A QR-code resource as returned by Meta on list / create / update.
///
/// Wire shape (Meta v23.0 `message_qrdls` node):
/// ```json
/// {
///   "code": "ABC123",
///   "prefilled_message": "Hello!",
///   "deep_link_url": "https://wa.me/message/ABC123",
///   "qr_image_url": "https://scontent.fbcdn.net/..."
/// }
/// ```
///
/// `qr_image_url` is `Option` because it is only populated for the
/// initial create response when `generate_qr_image` was supplied —
/// subsequent list / update responses omit it.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct QrCode {
    pub code: String,
    pub prefilled_message: String,
    pub deep_link_url: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub qr_image_url: Option<String>,
}

/// Request body for [`super::QrCodes::create`].
///
/// Mirrors the TS literal at L978:
/// `{ prefilled_message: prefilledMessage.trim(), generate_qr_image: 'SVG' }`.
#[derive(Debug, Clone)]
pub struct CreateQrReq {
    pub prefilled_message: String,
    pub generate_qr_image: ImageFormat,
}

/// Request body for [`super::QrCodes::update`].
///
/// Mirrors the TS literal at L1000:
/// `{ prefilled_message: prefilledMessage.trim() }`. Only the prefilled
/// message can be edited — the QR `code`, `deep_link_url`, and image
/// are immutable per Meta.
#[derive(Debug, Clone)]
pub struct UpdateQrReq {
    pub prefilled_message: String,
}

/// Internal: list-endpoint response envelope.
#[derive(Debug, Deserialize)]
pub(crate) struct QrListResponse {
    #[serde(default)]
    pub data: Vec<QrCode>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn image_format_as_meta_str() {
        assert_eq!(ImageFormat::Png.as_meta_str(), "PNG");
        assert_eq!(ImageFormat::Svg.as_meta_str(), "SVG");
    }

    #[test]
    fn image_format_serializes_uppercase() {
        let v = serde_json::to_value(ImageFormat::Svg).unwrap();
        assert_eq!(v, serde_json::json!("SVG"));
    }

    #[test]
    fn qr_code_round_trip_with_image_url() {
        let raw = serde_json::json!({
            "code": "ABC123",
            "prefilled_message": "Hello!",
            "deep_link_url": "https://wa.me/message/ABC123",
            "qr_image_url": "https://scontent.fbcdn.net/img.svg"
        });
        let qr: QrCode = serde_json::from_value(raw.clone()).unwrap();
        assert_eq!(qr.code, "ABC123");
        assert_eq!(
            qr.qr_image_url.as_deref(),
            Some("https://scontent.fbcdn.net/img.svg")
        );
        let back = serde_json::to_value(&qr).unwrap();
        assert_eq!(back, raw);
    }

    #[test]
    fn qr_code_omits_image_url_when_none() {
        let qr = QrCode {
            code: "X".into(),
            prefilled_message: "hi".into(),
            deep_link_url: "https://wa.me/message/X".into(),
            qr_image_url: None,
        };
        let v = serde_json::to_value(&qr).unwrap();
        assert!(v.get("qr_image_url").is_none(), "got: {v}");
    }

    #[test]
    fn qr_code_accepts_missing_image_url_on_decode() {
        let raw = serde_json::json!({
            "code": "X",
            "prefilled_message": "hi",
            "deep_link_url": "https://wa.me/message/X"
        });
        let qr: QrCode = serde_json::from_value(raw).unwrap();
        assert!(qr.qr_image_url.is_none());
    }

    #[test]
    fn list_envelope_defaults_data_to_empty() {
        let raw = serde_json::json!({});
        let env: QrListResponse = serde_json::from_value(raw).unwrap();
        assert!(env.data.is_empty());
    }
}
