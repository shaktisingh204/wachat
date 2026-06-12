use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::types::{Channel, MessageCategory, MessageStatus, ProviderId};

pub mod mock;
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
    #[error("provider rejected: {0}")]
    Rejected(String),
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
}

/// Build the adapter for a provider id. Returns `None` for providers
/// that don't have an engine implementation yet.
pub fn adapter_for(provider: ProviderId, http: reqwest::Client) -> Option<Box<dyn SmsProvider>> {
    match provider {
        ProviderId::Twilio => Some(Box::new(twilio::TwilioProvider::new(http))),
        ProviderId::Mock => Some(Box::new(mock::MockProvider::new())),
        _ => None,
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
