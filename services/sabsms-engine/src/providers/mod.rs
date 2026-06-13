use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::types::{Channel, MessageCategory, MessageStatus, ProviderId};

pub mod gupshup;
pub mod mock;
pub mod msg91;
pub mod registry;
pub mod telnyx;
pub mod twilio;

/// Decrypted provider credentials. The encrypted blob lives in
/// `sabsms_provider_accounts.credentialsCipher`; the engine decrypts on
/// first use and passes the materialised view to the adapter.
#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct ProviderCreds {
    /// Provider-specific JSON. Twilio: `{accountSid, authToken}`.
    pub blob: serde_json::Value,
}

#[derive(Clone, Debug, Serialize)]
pub struct SendRequest<'a> {
    pub from: &'a str,
    pub to: &'a str,
    pub body: &'a str,
    pub channel: Channel,
    pub category: MessageCategory,
}

/// India DLT parameters attached to a send (MSG91 / Gupshup routes).
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DltParams {
    /// Principal-entity id (PE_ID).
    pub entity_id: Option<String>,
    /// Content-template id (TE_ID).
    pub template_id: Option<String>,
    /// Registered DLT header (sender id).
    pub header: Option<String>,
}

/// V2.11 — RCS rich card. CamelCase on the wire; mirrors
/// `SabsmsRcsCard` in `src/lib/sabsms/types.ts`.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RcsCard {
    pub title: String,
    pub description: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub media_url: Option<String>,
    /// "vertical" (default) | "horizontal".
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub orientation: Option<String>,
}

/// V2.11 — RCS suggestion chip. Tagged `kind` on the wire:
/// `{"kind":"reply","text":"...","postbackData":"..."}` /
/// `{"kind":"openUrl",...}` / `{"kind":"dial",...}`.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum RcsSuggestion {
    Reply { text: String, postback_data: String },
    OpenUrl { text: String, url: String },
    Dial { text: String, phone: String },
}

/// V2.11 — full RCS payload attached to a send. `fallback_text` is the
/// plain-SMS body used when the recipient is not RCS-capable (or the
/// adapter rejects the RCS attempt).
#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RcsPayload {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub card: Option<RcsCard>,
    #[serde(default)]
    pub suggestions: Vec<RcsSuggestion>,
    pub fallback_text: String,
}

/// Per-send options threaded through every adapter. Built by the worker
/// from message-doc fields; adapters use what applies and ignore the rest.
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendOptions {
    /// Resolved public media URLs (MMS). Twilio maps these to `MediaUrl`
    /// form params; Telnyx to `media_urls`; MSG91/Gupshup ignore them.
    pub media_urls: Vec<String>,
    pub dlt: Option<DltParams>,
    /// Per-message status-callback URL (when the provider supports one).
    pub callback_url: Option<String>,
    /// V2.11 — when set, the adapter should send an RCS rich message
    /// (Gupshup RBM / Twilio Content API). Adapters without an RCS path
    /// return `ProviderError::Rejected("rcs_not_supported")` so the
    /// worker can fall back to SMS.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rcs: Option<RcsPayload>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SendResult {
    pub provider_message_id: String,
    pub status: MessageStatus,
    pub segments: u32,
    /// Wholesale cost in cents, if the provider returns one synchronously.
    pub cost: Option<i64>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct InboundMessage {
    pub provider_message_id: String,
    pub from: String,
    pub to: String,
    pub body: String,
    pub media_urls: Vec<String>,
    /// V2.11 — RCS suggestion postback data, when the inbound message is
    /// a suggested-reply tap (Gupshup RBM delivers it alongside the text).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub postback_data: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DlrEvent {
    pub provider_message_id: String,
    pub status: MessageStatus,
    pub error_code: Option<String>,
    pub error_message: Option<String>,
}

#[async_trait]
pub trait SmsProvider: Send + Sync {
    fn id(&self) -> ProviderId;

    async fn send(
        &self,
        req: SendRequest<'_>,
        opts: &SendOptions,
        creds: &ProviderCreds,
    ) -> Result<SendResult, ProviderError>;

    /// Verify a carrier webhook callback. `raw_body` is the unparsed
    /// bytes — providers sign the raw payload.
    fn verify_webhook_signature(
        &self,
        url: &str,
        raw_body: &[u8],
        headers: &HashMap<String, String>,
        creds: &ProviderCreds,
    ) -> bool;

    /// Parse an inbound message body (already verified).
    fn parse_inbound(&self, raw_body: &[u8]) -> Result<InboundMessage, ProviderError>;

    /// Parse a DLR / status callback (already verified).
    fn parse_dlr(&self, raw_body: &[u8]) -> Result<DlrEvent, ProviderError>;
}

#[derive(Debug, thiserror::Error)]
pub enum ProviderError {
    #[error("invalid credentials")]
    InvalidCredentials,
    #[error("bad request: {0}")]
    BadRequest(String),
    #[error("provider rejected ({}): {message}", code.as_deref().unwrap_or("-"))]
    Rejected {
        /// Raw provider error code (e.g. Twilio "21211") when one was
        /// returned — feeds `errors_map::normalize_error`.
        code: Option<String>,
        message: String,
    },
    #[error("network: {0}")]
    Network(String),
    #[error("throttled by provider")]
    Throttled { retry_after_secs: Option<u64> },
    #[error("decode: {0}")]
    Decode(String),
}

impl ProviderError {
    /// Transient failures the worker should retry with backoff.
    pub fn is_retryable(&self) -> bool {
        matches!(
            self,
            ProviderError::Network(_) | ProviderError::Throttled { .. }
        )
    }

    /// Raw provider error code, when the failure carried one.
    pub fn provider_code(&self) -> Option<&str> {
        match self {
            ProviderError::Rejected { code, .. } => code.as_deref(),
            _ => None,
        }
    }
}

/// GSM-7 / UCS-2 segment counter. Returns the number of SMS segments
/// the carrier will bill for. The split sizes are universal — 160/153
/// for GSM-7, 70/67 for UCS-2.
///
/// NOTE: this is the SHARED simplified counter — it counts Unicode code
/// points and treats GSM extension-table chars as 1 (real GSM packing
/// bills them as 2 septets, and UCS-2 is sized in UTF-16 units). The TS
/// counterpart (`src/lib/sabsms/segments.ts`) implements the SAME
/// simplification, and `tests/fixtures/segment-vectors.json` is the
/// anti-drift contract both must satisfy — change either side only via
/// a coordinated fixture update.
pub fn estimate_segments(body: &str) -> u32 {
    let is_gsm = body.chars().all(is_gsm7_char);
    let len = body.chars().count();
    if is_gsm {
        if len <= 160 {
            1
        } else {
            ((len as f64) / 153.0).ceil() as u32
        }
    } else if len <= 70 {
        1
    } else {
        ((len as f64) / 67.0).ceil() as u32
    }
}

/// The encoding the carrier will use for `body`: `"gsm7"` when every
/// char is representable in GSM 03.38 (per the shared simplified table
/// in [`is_gsm7_char`]), else `"ucs2"`.
pub fn encoding_of(body: &str) -> &'static str {
    if body.chars().all(is_gsm7_char) {
        "gsm7"
    } else {
        "ucs2"
    }
}

fn is_gsm7_char(c: char) -> bool {
    // Core GSM-7 alphabet + the extension table. Anything else triggers
    // a UCS-2 fallback. Close-enough for billing — exact GSM packing
    // edge cases are deferred. Kept byte-for-byte in sync with the TS
    // table (anti-drift fixture: tests/fixtures/segment-vectors.json).
    matches!(
        c,
        '@' | '£' | '$' | '¥' | 'è' | 'é' | 'ù' | 'ì' | 'ò' | 'Ç'
            | '\n' | 'Ø' | 'ø' | '\r' | 'Å' | 'å' | '_' | 'Æ' | 'æ' | 'ß' | 'É'
            | ' ' | '!' | '"' | '#' | '%' | '&' | '\''
            | '(' | ')' | '*' | '+' | ',' | '-' | '.' | '/'
            | '0'..='9' | ':' | ';' | '<' | '=' | '>' | '?'
            | 'A'..='Z' | 'a'..='z'
            | 'Ä' | 'Ö' | 'Ñ' | 'Ü' | '§'
            | '¡' | 'ä' | 'ö' | 'ñ' | 'ü' | 'à'
            | '|' | '^' | '{' | '}' | '\\' | '[' | '~' | ']' | '€'
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn send_options_serialize_camel_case() {
        let opts = SendOptions {
            media_urls: vec!["https://r2.example.com/a.jpg".into()],
            dlt: Some(DltParams {
                entity_id: Some("PE1".into()),
                template_id: Some("TE1".into()),
                header: Some("SABNDE".into()),
            }),
            callback_url: Some("https://cb.example.com".into()),
            rcs: None,
        };
        let v = serde_json::to_value(&opts).unwrap();
        assert_eq!(v["mediaUrls"][0], "https://r2.example.com/a.jpg");
        assert_eq!(v["dlt"]["entityId"], "PE1");
        assert_eq!(v["dlt"]["templateId"], "TE1");
        assert_eq!(v["dlt"]["header"], "SABNDE");
        assert_eq!(v["callbackUrl"], "https://cb.example.com");
        // `rcs: None` stays off the wire entirely.
        assert!(v.get("rcs").is_none());
    }

    /// V2.11 wire-shape pin — the TS side (`src/lib/sabsms/types.ts` +
    /// zod schemas) round-trips this EXACT camelCase shape; change only
    /// together with the TS fixture in
    /// `src/lib/sabsms/__tests__/rcs.test.ts`.
    #[test]
    fn rcs_payload_serializes_camel_case_with_kind_tags() {
        let payload = RcsPayload {
            card: Some(RcsCard {
                title: "Summer sale".into(),
                description: "Up to 50% off".into(),
                media_url: Some("https://r2.example.com/card.jpg".into()),
                orientation: Some("vertical".into()),
            }),
            suggestions: vec![
                RcsSuggestion::Reply {
                    text: "Show me".into(),
                    postback_data: "show_offers".into(),
                },
                RcsSuggestion::OpenUrl {
                    text: "Shop now".into(),
                    url: "https://shop.example.com".into(),
                },
                RcsSuggestion::Dial {
                    text: "Call us".into(),
                    phone: "+15550001111".into(),
                },
            ],
            fallback_text: "Summer sale: up to 50% off. https://shop.example.com".into(),
        };
        let v = serde_json::to_value(&payload).unwrap();
        assert_eq!(v["card"]["title"], "Summer sale");
        assert_eq!(v["card"]["description"], "Up to 50% off");
        assert_eq!(v["card"]["mediaUrl"], "https://r2.example.com/card.jpg");
        assert_eq!(v["card"]["orientation"], "vertical");
        assert_eq!(v["suggestions"][0]["kind"], "reply");
        assert_eq!(v["suggestions"][0]["text"], "Show me");
        assert_eq!(v["suggestions"][0]["postbackData"], "show_offers");
        assert_eq!(v["suggestions"][1]["kind"], "openUrl");
        assert_eq!(v["suggestions"][1]["url"], "https://shop.example.com");
        assert_eq!(v["suggestions"][2]["kind"], "dial");
        assert_eq!(v["suggestions"][2]["phone"], "+15550001111");
        assert_eq!(
            v["fallbackText"],
            "Summer sale: up to 50% off. https://shop.example.com"
        );

        // Round-trip back.
        let back: RcsPayload = serde_json::from_value(v).unwrap();
        assert_eq!(back, payload);
    }

    #[test]
    fn rcs_payload_minimal_deserializes_with_defaults() {
        // Card-less, suggestion-less payload — only fallbackText required.
        let p: RcsPayload =
            serde_json::from_str(r#"{"fallbackText":"plain"}"#).unwrap();
        assert!(p.card.is_none());
        assert!(p.suggestions.is_empty());
        assert_eq!(p.fallback_text, "plain");
    }

    #[test]
    fn rejected_error_exposes_provider_code() {
        let e = ProviderError::Rejected {
            code: Some("21211".into()),
            message: "invalid To".into(),
        };
        assert_eq!(e.provider_code(), Some("21211"));
        assert!(!e.is_retryable());
        assert!(ProviderError::Network("x".into()).provider_code().is_none());
    }

    #[test]
    fn gsm_short_one_segment() {
        assert_eq!(estimate_segments("hello world"), 1);
    }

    #[test]
    fn gsm_160_one_segment() {
        let body = "a".repeat(160);
        assert_eq!(estimate_segments(&body), 1);
    }

    #[test]
    fn gsm_161_two_segments() {
        let body = "a".repeat(161);
        assert_eq!(estimate_segments(&body), 2);
    }

    #[test]
    fn unicode_short_one_segment() {
        assert_eq!(estimate_segments("नमस्ते"), 1);
    }

    #[test]
    fn unicode_long_multiple_segments() {
        let body = "नमस्ते ".repeat(40);
        assert!(estimate_segments(&body) > 1);
    }

    #[test]
    fn extension_chars_count_like_base_chars_per_shared_contract() {
        // Shared simplified counter: 160 '€' code points → 1 segment,
        // 161 → 2 (matches segment-vectors.json; real GSM packing would
        // bill ext chars at 2 septets — coordinated fix later).
        assert_eq!(estimate_segments(&"€".repeat(160)), 1);
        assert_eq!(estimate_segments(&"€".repeat(161)), 2);
    }

    #[test]
    fn emoji_counts_as_one_code_point_per_shared_contract() {
        // Code-point counting: 70 emoji → 1 segment, 71 → 2.
        assert_eq!(estimate_segments(&"🙂".repeat(70)), 1);
        assert_eq!(estimate_segments(&"🙂".repeat(71)), 2);
    }

    #[test]
    fn encoding_of_classifies_gsm7_vs_ucs2() {
        assert_eq!(encoding_of("hello world"), "gsm7");
        assert_eq!(encoding_of("price: €5 {today}"), "gsm7");
        assert_eq!(encoding_of("नमस्ते"), "ucs2");
        assert_eq!(encoding_of("hi 🙂"), "ucs2");
        // Smart quote forces UCS-2.
        assert_eq!(encoding_of("it\u{2019}s"), "ucs2");
        // '¿' is outside the shared table (TS parity) → UCS-2.
        assert_eq!(encoding_of("¿Hola?"), "ucs2");
        // Empty body defaults to GSM-7.
        assert_eq!(encoding_of(""), "gsm7");
    }
}
