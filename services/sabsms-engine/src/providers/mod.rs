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

fn is_gsm7_char(c: char) -> bool {
    // Core GSM-7 alphabet + the extension table. Anything else triggers
    // a UCS-2 fallback. Close-enough for billing — exact GSM packing
    // edge cases are deferred.
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
}
