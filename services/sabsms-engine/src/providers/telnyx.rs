//! Telnyx Messaging API v2 adapter.
//!
//! - Send: `POST {base}/v2/messages` with `Authorization: Bearer <apiKey>`.
//!   Credential blob: `{ "apiKey": "...", "messagingProfileId"?: "...",
//!   "publicKey"?: "<base64 Ed25519>" }`.
//! - Webhooks: Telnyx posts JSON envelopes
//!   `{"data":{"event_type":"message.finished"|"message.sent"|"message.received",
//!   "payload":{...}}}` and signs `"{timestamp}|{raw_body}"` with Ed25519;
//!   signature in `telnyx-signature-ed25519` (base64) +
//!   `telnyx-timestamp` headers, verified against `blob.publicKey`.
//!   When `publicKey` is absent the adapter cannot verify — the generic
//!   webhook dispatch then falls back to the per-account
//!   `?secret=<webhookSecret>` query-param check (see
//!   `handlers/webhook.rs`).

use async_trait::async_trait;
use base64::Engine;
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use serde_json::{json, Value};
use std::collections::HashMap;

use super::{
    DlrEvent, InboundMessage, ProviderCreds, ProviderError, SendOptions, SendRequest, SendResult,
    SmsProvider,
};
use crate::types::{MessageStatus, ProviderId};

const DEFAULT_BASE_URL: &str = "https://api.telnyx.com";

pub struct TelnyxProvider {
    http: reqwest::Client,
    base_url: String,
}

impl TelnyxProvider {
    pub fn new(http: reqwest::Client) -> Self {
        Self {
            http,
            base_url: DEFAULT_BASE_URL.to_string(),
        }
    }

    /// Test-only constructor pointing the adapter at a wiremock server.
    pub fn with_base_url(http: reqwest::Client, base_url: impl Into<String>) -> Self {
        Self {
            http,
            base_url: base_url.into(),
        }
    }

    fn api_key(creds: &ProviderCreds) -> Result<String, ProviderError> {
        creds
            .blob
            .get("apiKey")
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string())
            .ok_or(ProviderError::InvalidCredentials)
    }

    fn unwrap_event(raw_body: &[u8]) -> Result<(String, Value), ProviderError> {
        let envelope: Value = serde_json::from_slice(raw_body)
            .map_err(|e| ProviderError::Decode(format!("telnyx webhook json: {e}")))?;
        let data = envelope
            .get("data")
            .cloned()
            .ok_or_else(|| ProviderError::BadRequest("telnyx webhook: missing data".into()))?;
        let event_type = data
            .get("event_type")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string();
        let payload = data
            .get("payload")
            .cloned()
            .ok_or_else(|| ProviderError::BadRequest("telnyx webhook: missing payload".into()))?;
        Ok((event_type, payload))
    }
}

#[async_trait]
impl SmsProvider for TelnyxProvider {
    fn id(&self) -> ProviderId {
        ProviderId::Telnyx
    }

    async fn send(
        &self,
        req: SendRequest<'_>,
        opts: &SendOptions,
        creds: &ProviderCreds,
    ) -> Result<SendResult, ProviderError> {
        // V2.11 — no Telnyx RCS path yet; reject so the worker falls
        // back to SMS with the payload's fallback text.
        if opts.rcs.is_some() {
            return Err(ProviderError::Rejected {
                code: None,
                message: "rcs_not_supported".into(),
            });
        }
        let api_key = Self::api_key(creds)?;
        let url = format!("{}/v2/messages", self.base_url);

        let mut body = json!({
            "from": req.from,
            "to": req.to,
            "text": req.body,
        });
        if let Some(profile) = creds.blob.get("messagingProfileId").and_then(|v| v.as_str()) {
            if !profile.is_empty() {
                body["messaging_profile_id"] = json!(profile);
            }
        }
        if !opts.media_urls.is_empty() {
            body["media_urls"] = json!(opts.media_urls);
        }
        if let Some(cb) = &opts.callback_url {
            body["webhook_url"] = json!(cb);
        }

        let resp = self
            .http
            .post(&url)
            .bearer_auth(&api_key)
            .json(&body)
            .send()
            .await
            .map_err(|e| ProviderError::Network(e.to_string()))?;

        let status = resp.status();
        let retry_after = resp
            .headers()
            .get("retry-after")
            .and_then(|v| v.to_str().ok())
            .and_then(|s| s.parse::<u64>().ok());
        let raw = resp
            .text()
            .await
            .map_err(|e| ProviderError::Network(e.to_string()))?;

        if status.as_u16() == 429 {
            return Err(ProviderError::Throttled {
                retry_after_secs: retry_after,
            });
        }
        if status.as_u16() == 401 || status.as_u16() == 403 {
            return Err(ProviderError::InvalidCredentials);
        }
        if !status.is_success() {
            // Error body: {"errors":[{"code":"40001","title":"...","detail":"..."}]}
            let code = serde_json::from_str::<Value>(&raw)
                .ok()
                .and_then(|v| {
                    v.get("errors")
                        .and_then(|e| e.get(0))
                        .and_then(|e| e.get("code"))
                        .and_then(|c| match c {
                            Value::String(s) => Some(s.clone()),
                            Value::Number(n) => Some(n.to_string()),
                            _ => None,
                        })
                });
            return Err(ProviderError::Rejected {
                code,
                message: format!("telnyx {}: {}", status, raw),
            });
        }

        let parsed: Value = serde_json::from_str(&raw)
            .map_err(|e| ProviderError::Decode(format!("telnyx response: {e}")))?;
        let data = parsed
            .get("data")
            .ok_or_else(|| ProviderError::Decode("telnyx response: missing data".into()))?;
        let provider_message_id = data
            .get("id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| ProviderError::Decode("telnyx response: missing data.id".into()))?
            .to_string();

        let segments = data
            .get("parts")
            .and_then(|v| v.as_u64())
            .map(|n| n as u32)
            .unwrap_or_else(|| super::estimate_segments(req.body));
        // cost: {"amount":"0.004","currency":"USD"} → cents.
        let cost = data
            .get("cost")
            .and_then(|c| c.get("amount"))
            .and_then(|a| a.as_str())
            .and_then(|s| s.parse::<f64>().ok())
            .map(|d| (d.abs() * 100.0).round() as i64);

        Ok(SendResult {
            provider_message_id,
            status: MessageStatus::Queued,
            segments,
            cost,
        })
    }

    fn verify_webhook_signature(
        &self,
        _url: &str,
        raw_body: &[u8],
        headers: &HashMap<String, String>,
        creds: &ProviderCreds,
    ) -> bool {
        // Ed25519 over "{timestamp}|{raw_body}" against blob.publicKey
        // (base64). No key configured → verification impossible → false
        // (the dispatch layer falls back to the URL secret).
        let Some(key_b64) = creds
            .blob
            .get("publicKey")
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
        else {
            return false;
        };
        let header = |name: &str| {
            headers
                .iter()
                .find(|(k, _)| k.eq_ignore_ascii_case(name))
                .map(|(_, v)| v.clone())
        };
        let Some(sig_b64) = header("telnyx-signature-ed25519") else {
            return false;
        };
        let Some(timestamp) = header("telnyx-timestamp") else {
            return false;
        };

        let b64 = base64::engine::general_purpose::STANDARD;
        let Ok(key_bytes) = b64.decode(key_b64) else {
            return false;
        };
        let Ok(key_arr) = <[u8; 32]>::try_from(key_bytes.as_slice()) else {
            return false;
        };
        let Ok(verifying_key) = VerifyingKey::from_bytes(&key_arr) else {
            return false;
        };
        let Ok(sig_bytes) = b64.decode(sig_b64) else {
            return false;
        };
        let Ok(signature) = Signature::from_slice(&sig_bytes) else {
            return false;
        };

        let mut message = Vec::with_capacity(timestamp.len() + 1 + raw_body.len());
        message.extend_from_slice(timestamp.as_bytes());
        message.push(b'|');
        message.extend_from_slice(raw_body);
        verifying_key.verify(&message, &signature).is_ok()
    }

    fn parse_inbound(&self, raw_body: &[u8]) -> Result<InboundMessage, ProviderError> {
        let (event_type, payload) = Self::unwrap_event(raw_body)?;
        if event_type != "message.received" {
            return Err(ProviderError::BadRequest(format!(
                "telnyx inbound: unexpected event_type '{event_type}'"
            )));
        }
        let provider_message_id = payload
            .get("id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| ProviderError::BadRequest("telnyx inbound: missing payload.id".into()))?
            .to_string();
        let from = payload
            .get("from")
            .and_then(|f| f.get("phone_number"))
            .and_then(|v| v.as_str())
            .ok_or_else(|| ProviderError::BadRequest("telnyx inbound: missing from".into()))?
            .to_string();
        let to = payload
            .get("to")
            .and_then(|t| t.get(0))
            .and_then(|t| t.get("phone_number"))
            .and_then(|v| v.as_str())
            .ok_or_else(|| ProviderError::BadRequest("telnyx inbound: missing to".into()))?
            .to_string();
        let body = payload
            .get("text")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string();
        let media_urls = payload
            .get("media")
            .and_then(|m| m.as_array())
            .map(|items| {
                items
                    .iter()
                    .filter_map(|i| i.get("url").and_then(|u| u.as_str()))
                    .map(|s| s.to_string())
                    .collect()
            })
            .unwrap_or_default();

        Ok(InboundMessage {
            provider_message_id,
            from,
            to,
            body,
            media_urls,
            postback_data: None,
        })
    }

    fn parse_dlr(&self, raw_body: &[u8]) -> Result<DlrEvent, ProviderError> {
        let (event_type, payload) = Self::unwrap_event(raw_body)?;
        let provider_message_id = payload
            .get("id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| ProviderError::BadRequest("telnyx dlr: missing payload.id".into()))?
            .to_string();

        // Per-recipient status lives in payload.to[0].status; errors in
        // payload.errors[] (each {"code": "...", "title"/"detail": ...}).
        let to_status = payload
            .get("to")
            .and_then(|t| t.get(0))
            .and_then(|t| t.get("status"))
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string();
        let status = match (event_type.as_str(), to_status.as_str()) {
            (_, "delivered") => MessageStatus::Delivered,
            (_, "sending_failed") | (_, "failed") => MessageStatus::Failed,
            (_, "delivery_failed") | (_, "delivery_unconfirmed") => MessageStatus::Undelivered,
            ("message.sent", _) => MessageStatus::Sent,
            ("message.finished", _) => MessageStatus::Sent,
            _ => MessageStatus::Queued,
        };
        let first_error = payload.get("errors").and_then(|e| e.get(0));
        let error_code = first_error
            .and_then(|e| e.get("code"))
            .and_then(|c| match c {
                Value::String(s) => Some(s.clone()),
                Value::Number(n) => Some(n.to_string()),
                _ => None,
            });
        let error_message = first_error.and_then(|e| {
            e.get("detail")
                .or_else(|| e.get("title"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        });

        Ok(DlrEvent {
            provider_message_id,
            status,
            error_code,
            error_message,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::{Signer, SigningKey};
    use wiremock::matchers::{body_string_contains, header, method, path};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    fn creds() -> ProviderCreds {
        ProviderCreds {
            blob: serde_json::json!({
                "apiKey": "KEY_test",
                "messagingProfileId": "mp-1"
            }),
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

    const DLR_FIXTURE: &str = r#"{
      "data": {
        "event_type": "message.finished",
        "id": "evt-1",
        "occurred_at": "2026-06-12T00:00:00.000Z",
        "payload": {
          "id": "msg-uuid-1",
          "direction": "outbound",
          "from": {"phone_number": "+15550001111"},
          "to": [{"phone_number": "+15552223333", "status": "delivered"}],
          "text": "hello",
          "errors": []
        }
      }
    }"#;

    const DLR_FAILED_FIXTURE: &str = r#"{
      "data": {
        "event_type": "message.finished",
        "payload": {
          "id": "msg-uuid-2",
          "to": [{"phone_number": "+15552223333", "status": "sending_failed"}],
          "errors": [{"code": "40001", "title": "Invalid 'to' address"}]
        }
      }
    }"#;

    const INBOUND_FIXTURE: &str = r#"{
      "data": {
        "event_type": "message.received",
        "payload": {
          "id": "msg-uuid-3",
          "direction": "inbound",
          "from": {"phone_number": "+15558887777"},
          "to": [{"phone_number": "+15550001111", "status": "webhook_delivered"}],
          "text": "STOP",
          "media": [{"url": "https://media.telnyx.com/x.jpg"}]
        }
      }
    }"#;

    #[test]
    fn parses_dlr_delivered() {
        let p = TelnyxProvider::new(reqwest::Client::new());
        let dlr = p.parse_dlr(DLR_FIXTURE.as_bytes()).unwrap();
        assert_eq!(dlr.provider_message_id, "msg-uuid-1");
        assert_eq!(dlr.status, MessageStatus::Delivered);
        assert!(dlr.error_code.is_none());
    }

    #[test]
    fn parses_dlr_failed_with_code() {
        let p = TelnyxProvider::new(reqwest::Client::new());
        let dlr = p.parse_dlr(DLR_FAILED_FIXTURE.as_bytes()).unwrap();
        assert_eq!(dlr.provider_message_id, "msg-uuid-2");
        assert_eq!(dlr.status, MessageStatus::Failed);
        assert_eq!(dlr.error_code.as_deref(), Some("40001"));
        assert_eq!(dlr.error_message.as_deref(), Some("Invalid 'to' address"));
    }

    #[test]
    fn parses_inbound_with_media() {
        let p = TelnyxProvider::new(reqwest::Client::new());
        let msg = p.parse_inbound(INBOUND_FIXTURE.as_bytes()).unwrap();
        assert_eq!(msg.provider_message_id, "msg-uuid-3");
        assert_eq!(msg.from, "+15558887777");
        assert_eq!(msg.to, "+15550001111");
        assert_eq!(msg.body, "STOP");
        assert_eq!(msg.media_urls, vec!["https://media.telnyx.com/x.jpg"]);
    }

    #[test]
    fn verifies_ed25519_signature() {
        let signing = SigningKey::from_bytes(&[7u8; 32]);
        let public_b64 = base64::engine::general_purpose::STANDARD
            .encode(signing.verifying_key().to_bytes());
        let creds = ProviderCreds {
            blob: serde_json::json!({ "apiKey": "k", "publicKey": public_b64 }),
        };

        let body = DLR_FIXTURE.as_bytes();
        let timestamp = "1765500000";
        let mut message = Vec::new();
        message.extend_from_slice(timestamp.as_bytes());
        message.push(b'|');
        message.extend_from_slice(body);
        let sig = signing.sign(&message);
        let sig_b64 = base64::engine::general_purpose::STANDARD.encode(sig.to_bytes());

        let mut headers = HashMap::new();
        headers.insert("Telnyx-Signature-Ed25519".to_string(), sig_b64.clone());
        headers.insert("Telnyx-Timestamp".to_string(), timestamp.to_string());

        let p = TelnyxProvider::new(reqwest::Client::new());
        assert!(p.verify_webhook_signature("u", body, &headers, &creds));

        // Tampered body fails.
        assert!(!p.verify_webhook_signature("u", b"{}", &headers, &creds));

        // No publicKey configured → cannot verify.
        let no_key = ProviderCreds {
            blob: serde_json::json!({ "apiKey": "k" }),
        };
        assert!(!p.verify_webhook_signature("u", body, &headers, &no_key));
    }

    #[tokio::test]
    async fn send_happy_path() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/v2/messages"))
            .and(header("authorization", "Bearer KEY_test"))
            .and(body_string_contains("\"messaging_profile_id\":\"mp-1\""))
            .respond_with(ResponseTemplate::new(200).set_body_raw(
                r#"{"data":{"id":"tx-msg-1","parts":1,"cost":{"amount":"0.004","currency":"USD"}}}"#,
                "application/json",
            ))
            .mount(&server)
            .await;

        let p = TelnyxProvider::with_base_url(reqwest::Client::new(), server.uri());
        let r = p
            .send(req("hello"), &SendOptions::default(), &creds())
            .await
            .unwrap();
        assert_eq!(r.provider_message_id, "tx-msg-1");
        assert_eq!(r.status, MessageStatus::Queued);
        assert_eq!(r.segments, 1);
        assert_eq!(r.cost, Some(0)); // 0.004 USD rounds to 0 cents
    }

    #[tokio::test]
    async fn send_error_carries_telnyx_code() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/v2/messages"))
            .respond_with(ResponseTemplate::new(422).set_body_raw(
                r#"{"errors":[{"code":"40001","title":"Invalid 'to' address","detail":"not a phone"}]}"#,
                "application/json",
            ))
            .mount(&server)
            .await;

        let p = TelnyxProvider::with_base_url(reqwest::Client::new(), server.uri());
        let e = p
            .send(req("hello"), &SendOptions::default(), &creds())
            .await
            .unwrap_err();
        assert_eq!(e.provider_code(), Some("40001"));
    }

    #[tokio::test]
    async fn send_401_is_invalid_credentials() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/v2/messages"))
            .respond_with(ResponseTemplate::new(401).set_body_raw(
                r#"{"errors":[{"code":"10009","title":"Authentication failed"}]}"#,
                "application/json",
            ))
            .mount(&server)
            .await;

        let p = TelnyxProvider::with_base_url(reqwest::Client::new(), server.uri());
        let e = p
            .send(req("hello"), &SendOptions::default(), &creds())
            .await
            .unwrap_err();
        assert!(matches!(e, ProviderError::InvalidCredentials));
    }
}
