//! Mock provider for tests and e2e suites.
//!
//! Enabled per-message via the `provider: "mock"` doc field, or globally
//! with `SABSMS_PROVIDER_MOCK=true`. Body markers force failure modes:
//! `[FAIL]` → rejected, `[RETRY]` → retryable network error,
//! `[THROTTLE]` → throttled.

use async_trait::async_trait;
use serde::Deserialize;
use std::collections::HashMap;

use super::{
    estimate_segments, DlrEvent, InboundMessage, ProviderCreds, ProviderError, SendOptions,
    SendRequest, SendResult, SmsProvider,
};
use crate::types::{MessageStatus, ProviderId};

#[derive(Default)]
pub struct MockProvider;

impl MockProvider {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl SmsProvider for MockProvider {
    fn id(&self) -> ProviderId {
        ProviderId::Mock
    }

    async fn send(
        &self,
        req: SendRequest<'_>,
        _opts: &SendOptions,
        _creds: &ProviderCreds,
    ) -> Result<SendResult, ProviderError> {
        if req.body.contains("[FAIL]") {
            return Err(ProviderError::Rejected {
                code: None,
                message: "mock forced failure".into(),
            });
        }
        if req.body.contains("[RETRY]") {
            return Err(ProviderError::Network("mock network error".into()));
        }
        if req.body.contains("[THROTTLE]") {
            return Err(ProviderError::Throttled {
                retry_after_secs: Some(1),
            });
        }
        Ok(SendResult {
            provider_message_id: format!("mock-{}", uuid::Uuid::new_v4()),
            status: MessageStatus::Sent,
            segments: estimate_segments(req.body),
            cost: Some(1),
        })
    }

    fn verify_webhook_signature(
        &self,
        _url: &str,
        _raw_body: &[u8],
        headers: &HashMap<String, String>,
        _creds: &ProviderCreds,
    ) -> bool {
        headers
            .iter()
            .find(|(k, _)| k.eq_ignore_ascii_case("x-mock-signature"))
            .map(|(_, v)| v == "ok")
            .unwrap_or(false)
    }

    fn parse_inbound(&self, raw_body: &[u8]) -> Result<InboundMessage, ProviderError> {
        #[derive(Deserialize)]
        #[serde(rename_all = "camelCase")]
        struct MockInbound {
            message_id: String,
            from: String,
            to: String,
            #[serde(default)]
            body: String,
        }
        let parsed: MockInbound = serde_json::from_slice(raw_body)
            .map_err(|e| ProviderError::Decode(format!("mock inbound json: {e}")))?;
        Ok(InboundMessage {
            provider_message_id: parsed.message_id,
            from: parsed.from,
            to: parsed.to,
            body: parsed.body,
            media_urls: Vec::new(),
        })
    }

    fn parse_dlr(&self, raw_body: &[u8]) -> Result<DlrEvent, ProviderError> {
        #[derive(Deserialize)]
        #[serde(rename_all = "camelCase")]
        struct MockDlr {
            message_id: String,
            status: String,
        }
        let parsed: MockDlr = serde_json::from_slice(raw_body)
            .map_err(|e| ProviderError::Decode(format!("mock dlr json: {e}")))?;
        let status = match parsed.status.as_str() {
            "queued" => MessageStatus::Queued,
            "sent" => MessageStatus::Sent,
            "delivered" => MessageStatus::Delivered,
            "failed" => MessageStatus::Failed,
            "undelivered" => MessageStatus::Undelivered,
            other => {
                return Err(ProviderError::Decode(format!(
                    "mock dlr: unknown status '{other}'"
                )))
            }
        };
        Ok(DlrEvent {
            provider_message_id: parsed.message_id,
            status,
            error_code: None,
            error_message: None,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn creds() -> ProviderCreds {
        ProviderCreds {
            blob: serde_json::json!({}),
        }
    }

    fn req(body: &str) -> SendRequest<'_> {
        SendRequest {
            from: "+15550001111",
            to: "+15552223333",
            body,
            channel: crate::types::Channel::Sms,
            category: crate::types::MessageCategory::Transactional,
        }
    }

    #[tokio::test]
    async fn send_ok_returns_mock_message_id() {
        let p = MockProvider::new();
        let r = p
            .send(req("hello"), &SendOptions::default(), &creds())
            .await
            .unwrap();
        assert!(r.provider_message_id.starts_with("mock-"));
        assert_eq!(r.status, MessageStatus::Sent);
        assert_eq!(r.segments, 1);
        assert_eq!(r.cost, Some(1));
    }

    #[tokio::test]
    async fn send_fail_marker_rejects() {
        let p = MockProvider::new();
        let e = p
            .send(req("please [FAIL] now"), &SendOptions::default(), &creds())
            .await
            .unwrap_err();
        assert!(matches!(e, ProviderError::Rejected { .. }));
        assert!(!e.is_retryable());
    }

    #[tokio::test]
    async fn send_retry_marker_is_retryable_network() {
        let p = MockProvider::new();
        let e = p
            .send(req("x [RETRY] x"), &SendOptions::default(), &creds())
            .await
            .unwrap_err();
        assert!(matches!(e, ProviderError::Network(_)));
        assert!(e.is_retryable());
    }

    #[tokio::test]
    async fn send_throttle_marker_is_retryable_throttled() {
        let p = MockProvider::new();
        let e = p
            .send(req("x [THROTTLE] x"), &SendOptions::default(), &creds())
            .await
            .unwrap_err();
        assert!(matches!(
            e,
            ProviderError::Throttled {
                retry_after_secs: Some(1)
            }
        ));
        assert!(e.is_retryable());
    }

    #[test]
    fn parses_inbound_json() {
        let p = MockProvider::new();
        let body = br#"{"messageId":"mock-in-1","from":"+15551234567","to":"+15557654321","body":"hi"}"#;
        let msg = p.parse_inbound(body).unwrap();
        assert_eq!(msg.provider_message_id, "mock-in-1");
        assert_eq!(msg.from, "+15551234567");
        assert_eq!(msg.to, "+15557654321");
        assert_eq!(msg.body, "hi");
    }

    #[test]
    fn parses_dlr_json() {
        let p = MockProvider::new();
        let body = br#"{"messageId":"mock-1","status":"delivered"}"#;
        let dlr = p.parse_dlr(body).unwrap();
        assert_eq!(dlr.provider_message_id, "mock-1");
        assert_eq!(dlr.status, MessageStatus::Delivered);
    }

    #[test]
    fn signature_header_ok() {
        let p = MockProvider::new();
        let mut headers = HashMap::new();
        headers.insert("X-Mock-Signature".to_string(), "ok".to_string());
        assert!(p.verify_webhook_signature("u", b"", &headers, &creds()));
        headers.insert("X-Mock-Signature".to_string(), "bad".to_string());
        assert!(!p.verify_webhook_signature("u", b"", &headers, &creds()));
    }
}
