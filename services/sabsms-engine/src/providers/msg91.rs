//! MSG91 v5 SMS API adapter (India-first route).
//!
//! - Send: `POST {base}/api/v5/sms/` with the `authkey` header.
//!   Credential blob: `{ "authKey": "...", "senderId"?: "SABNDE",
//!   "dltEntityId"?: "..." }`.
//!   Request payload (JSON):
//!   ```json
//!   {
//!     "sender": "SABNDE",
//!     "route": "4",
//!     "country": "91",
//!     "sms": [{ "message": "...", "to": ["919999999999"] }],
//!     "DLT_TE_ID": "<dlt templateId>",   // when DLT params present
//!     "PE_ID": "<dlt entityId>"
//!   }
//!   ```
//!   Success response: `{"type":"success","message":"<requestId>"}`;
//!   errors: `{"type":"error","message":"..."}` (textual — mapped to
//!   normalized codes by substring in `errors_map`).
//! - DLR webhook: MSG91 posts form or JSON containing `requestId` +
//!   numeric `status` (1=delivered, 2=failed, 5/8=pending/sent, 9=DND,
//!   16=rejected). Both encodings are accepted, plus the nested
//!   `data=[{requestId, report:[{status,...}]}]` shape.
//! - Inbound webhook: form/JSON with `sender`/`from`, `message`/`text`,
//!   `shortcode`/`to`.
//! - Signatures: MSG91 has no real webhook signature scheme — webhook
//!   authenticity is the per-account `?secret=` URL parameter enforced
//!   by the generic dispatch in `handlers/webhook.rs`;
//!   `verify_webhook_signature` always returns `false` here.

use async_trait::async_trait;
use serde_json::{json, Value};
use std::collections::HashMap;

use super::{
    DlrEvent, InboundMessage, ProviderCreds, ProviderError, SendOptions, SendRequest, SendResult,
    SmsProvider,
};
use crate::types::{MessageStatus, ProviderId};

const DEFAULT_BASE_URL: &str = "https://control.msg91.com";

pub struct Msg91Provider {
    http: reqwest::Client,
    base_url: String,
}

impl Msg91Provider {
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

    fn auth_key(creds: &ProviderCreds) -> Result<String, ProviderError> {
        creds
            .blob
            .get("authKey")
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string())
            .ok_or(ProviderError::InvalidCredentials)
    }

    /// Parse a webhook body that may be JSON or form-encoded into a flat
    /// string map. The nested `data=[{...}]` DLR shape is flattened from
    /// the first report entry.
    fn flat_params(raw_body: &[u8]) -> HashMap<String, String> {
        if let Ok(v) = serde_json::from_slice::<Value>(raw_body) {
            return Self::flatten_json(&v);
        }
        serde_urlencoded::from_bytes::<HashMap<String, String>>(raw_body).unwrap_or_default()
    }

    fn flatten_json(v: &Value) -> HashMap<String, String> {
        let mut out = HashMap::new();
        let absorb = |obj: &Value, out: &mut HashMap<String, String>| {
            if let Some(map) = obj.as_object() {
                for (k, val) in map {
                    let s = match val {
                        Value::String(s) => s.clone(),
                        Value::Number(n) => n.to_string(),
                        Value::Bool(b) => b.to_string(),
                        _ => continue,
                    };
                    out.entry(k.clone()).or_insert(s);
                }
            }
        };
        absorb(v, &mut out);
        // data=[{ requestId, report:[{status, desc, number}] }]
        if let Some(first) = v.get("data").and_then(|d| d.get(0)) {
            absorb(first, &mut out);
            if let Some(report) = first.get("report").and_then(|r| r.get(0)) {
                absorb(report, &mut out);
            }
        }
        out
    }

    fn pick(params: &HashMap<String, String>, keys: &[&str]) -> Option<String> {
        for key in keys {
            if let Some((_, v)) = params
                .iter()
                .find(|(k, _)| k.eq_ignore_ascii_case(key) && !k.is_empty())
            {
                if !v.is_empty() {
                    return Some(v.clone());
                }
            }
        }
        None
    }
}

#[async_trait]
impl SmsProvider for Msg91Provider {
    fn id(&self) -> ProviderId {
        ProviderId::Msg91
    }

    async fn send(
        &self,
        req: SendRequest<'_>,
        opts: &SendOptions,
        creds: &ProviderCreds,
    ) -> Result<SendResult, ProviderError> {
        let auth_key = Self::auth_key(creds)?;
        let url = format!("{}/api/v5/sms/", self.base_url);

        // Sender precedence: per-message DLT header → request `from` →
        // account-level senderId from the blob.
        let blob_sender = creds
            .blob
            .get("senderId")
            .and_then(|v| v.as_str())
            .unwrap_or_default();
        let dlt_header = opts
            .dlt
            .as_ref()
            .and_then(|d| d.header.as_deref())
            .unwrap_or_default();
        let sender = if !dlt_header.is_empty() {
            dlt_header
        } else if !req.from.is_empty() {
            req.from
        } else {
            blob_sender
        };
        if sender.is_empty() {
            return Err(ProviderError::BadRequest(
                "msg91: no sender id configured".into(),
            ));
        }

        // MSG91 wants bare digits with the country prefix (no '+').
        let to_digits: String = req.to.chars().filter(|c| c.is_ascii_digit()).collect();

        let mut body = json!({
            "sender": sender,
            "route": "4",
            "country": "0",
            "sms": [{ "message": req.body, "to": [to_digits] }],
        });
        // DLT params: per-message values win over the account default.
        let entity_id = opts
            .dlt
            .as_ref()
            .and_then(|d| d.entity_id.clone())
            .or_else(|| {
                creds
                    .blob
                    .get("dltEntityId")
                    .and_then(|v| v.as_str())
                    .filter(|s| !s.is_empty())
                    .map(|s| s.to_string())
            });
        if let Some(pe) = entity_id {
            body["PE_ID"] = json!(pe);
        }
        if let Some(te) = opts.dlt.as_ref().and_then(|d| d.template_id.as_deref()) {
            body["DLT_TE_ID"] = json!(te);
        }

        let resp = self
            .http
            .post(&url)
            .header("authkey", &auth_key)
            .json(&body)
            .send()
            .await
            .map_err(|e| ProviderError::Network(e.to_string()))?;

        let status = resp.status();
        let raw = resp
            .text()
            .await
            .map_err(|e| ProviderError::Network(e.to_string()))?;

        if status.as_u16() == 429 {
            return Err(ProviderError::Throttled {
                retry_after_secs: None,
            });
        }
        if status.as_u16() == 401 || status.as_u16() == 403 {
            return Err(ProviderError::InvalidCredentials);
        }

        let parsed: Value = serde_json::from_str(&raw)
            .map_err(|e| ProviderError::Decode(format!("msg91 response: {e}")))?;
        let kind = parsed.get("type").and_then(|v| v.as_str()).unwrap_or("");
        let message = parsed
            .get("message")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string();

        if !status.is_success() || kind != "success" {
            // MSG91 errors are textual; carry the message as the raw code
            // so errors_map can substring-match (DND / sender / template).
            return Err(ProviderError::Rejected {
                code: Some(message.clone()).filter(|m| !m.is_empty()),
                message: format!("msg91 {}: {}", status, raw),
            });
        }

        Ok(SendResult {
            // Success payload carries the request id in `message`.
            provider_message_id: message,
            status: MessageStatus::Sent,
            segments: super::estimate_segments(req.body),
            cost: None,
        })
    }

    fn verify_webhook_signature(
        &self,
        _url: &str,
        _raw_body: &[u8],
        _headers: &HashMap<String, String>,
        _creds: &ProviderCreds,
    ) -> bool {
        // No signature scheme — the generic dispatch requires the
        // per-account `?secret=` URL parameter instead.
        false
    }

    fn parse_inbound(&self, raw_body: &[u8]) -> Result<InboundMessage, ProviderError> {
        let params = Self::flat_params(raw_body);
        let from = Self::pick(&params, &["sender", "from", "mobile", "msisdn"])
            .ok_or_else(|| ProviderError::BadRequest("msg91 inbound: missing sender".into()))?;
        let to = Self::pick(&params, &["shortcode", "to", "receiver", "longcode"])
            .ok_or_else(|| ProviderError::BadRequest("msg91 inbound: missing shortcode".into()))?;
        let body = Self::pick(&params, &["message", "content", "text", "sms"]).unwrap_or_default();
        let provider_message_id = Self::pick(&params, &["requestId", "messageId", "id"])
            .unwrap_or_else(|| format!("msg91-in-{}", uuid::Uuid::new_v4()));
        Ok(InboundMessage {
            provider_message_id,
            from,
            to,
            body,
            media_urls: Vec::new(),
        })
    }

    fn parse_dlr(&self, raw_body: &[u8]) -> Result<DlrEvent, ProviderError> {
        let params = Self::flat_params(raw_body);
        let provider_message_id = Self::pick(&params, &["requestId", "request_id", "id"])
            .ok_or_else(|| ProviderError::BadRequest("msg91 dlr: missing requestId".into()))?;
        let status_code = Self::pick(&params, &["status", "status_code"])
            .ok_or_else(|| ProviderError::BadRequest("msg91 dlr: missing status".into()))?;
        let desc = Self::pick(&params, &["desc", "description"]);

        // MSG91 DLR status codes: 1=delivered, 2=failed, 5=pending,
        // 8=sent, 9=DND, 16=rejected by carrier, 17=blocked.
        let (status, error_code) = match status_code.as_str() {
            "1" => (MessageStatus::Delivered, None),
            "2" => (MessageStatus::Failed, Some(status_code.clone())),
            "5" => (MessageStatus::Sending, None),
            "8" => (MessageStatus::Sent, None),
            "9" | "16" | "17" => (MessageStatus::Undelivered, Some(status_code.clone())),
            _ => (MessageStatus::Queued, Some(status_code.clone())),
        };

        Ok(DlrEvent {
            provider_message_id,
            status,
            error_code,
            error_message: desc,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::providers::DltParams;
    use wiremock::matchers::{body_string_contains, header, method, path};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    fn creds() -> ProviderCreds {
        ProviderCreds {
            blob: serde_json::json!({
                "authKey": "AK_test",
                "senderId": "SABNDE",
                "dltEntityId": "PE_DEFAULT"
            }),
        }
    }

    fn req(body: &str) -> SendRequest<'_> {
        SendRequest {
            from: "",
            to: "+919876543210",
            body,
            channel: crate::types::Channel::Sms,
            category: crate::types::MessageCategory::Transactional,
        }
    }

    #[tokio::test]
    async fn send_happy_path_with_dlt() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/api/v5/sms/"))
            .and(header("authkey", "AK_test"))
            .and(body_string_contains("\"DLT_TE_ID\":\"TE123\""))
            .and(body_string_contains("\"PE_ID\":\"PE999\""))
            .and(body_string_contains("\"to\":[\"919876543210\"]"))
            .respond_with(ResponseTemplate::new(200).set_body_raw(
                r#"{"type":"success","message":"376185bd1244"}"#,
                "application/json",
            ))
            .mount(&server)
            .await;

        let p = Msg91Provider::with_base_url(reqwest::Client::new(), server.uri());
        let opts = SendOptions {
            media_urls: vec![],
            dlt: Some(DltParams {
                entity_id: Some("PE999".into()),
                template_id: Some("TE123".into()),
                header: Some("SABNDE".into()),
            }),
            callback_url: None,
        };
        let r = p.send(req("otp 1234"), &opts, &creds()).await.unwrap();
        assert_eq!(r.provider_message_id, "376185bd1244");
        assert_eq!(r.status, MessageStatus::Sent);
    }

    #[tokio::test]
    async fn send_error_carries_message_for_substring_mapping() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/api/v5/sms/"))
            .respond_with(ResponseTemplate::new(200).set_body_raw(
                r#"{"type":"error","message":"Invalid sender id"}"#,
                "application/json",
            ))
            .mount(&server)
            .await;

        let p = Msg91Provider::with_base_url(reqwest::Client::new(), server.uri());
        let e = p
            .send(req("hi"), &SendOptions::default(), &creds())
            .await
            .unwrap_err();
        assert_eq!(e.provider_code(), Some("Invalid sender id"));
    }

    #[test]
    fn parses_json_dlr() {
        let p = Msg91Provider::new(reqwest::Client::new());
        let body = br#"{"requestId":"376185bd1244","status":"1","desc":"DELIVERED"}"#;
        let dlr = p.parse_dlr(body).unwrap();
        assert_eq!(dlr.provider_message_id, "376185bd1244");
        assert_eq!(dlr.status, MessageStatus::Delivered);
    }

    #[test]
    fn parses_form_dlr_failed() {
        let p = Msg91Provider::new(reqwest::Client::new());
        let body = b"requestId=376185bd1244&status=16&desc=REJECTED";
        let dlr = p.parse_dlr(body).unwrap();
        assert_eq!(dlr.status, MessageStatus::Undelivered);
        assert_eq!(dlr.error_code.as_deref(), Some("16"));
        assert_eq!(dlr.error_message.as_deref(), Some("REJECTED"));
    }

    #[test]
    fn parses_nested_report_dlr() {
        let p = Msg91Provider::new(reqwest::Client::new());
        let body = br#"{"data":[{"senderId":"SABNDE","requestId":"reqnested1","report":[{"date":"2026-06-12","number":"919876543210","status":"9","desc":"DND"}]}]}"#;
        let dlr = p.parse_dlr(body).unwrap();
        assert_eq!(dlr.provider_message_id, "reqnested1");
        assert_eq!(dlr.status, MessageStatus::Undelivered);
        assert_eq!(dlr.error_code.as_deref(), Some("9"));
    }

    #[test]
    fn parses_inbound_form() {
        let p = Msg91Provider::new(reqwest::Client::new());
        let body = b"sender=919876543210&shortcode=SABNDE&message=hello+there&requestId=in-1";
        let msg = p.parse_inbound(body).unwrap();
        assert_eq!(msg.from, "919876543210");
        assert_eq!(msg.to, "SABNDE");
        assert_eq!(msg.body, "hello there");
        assert_eq!(msg.provider_message_id, "in-1");
    }

    #[test]
    fn signature_verification_always_false() {
        let p = Msg91Provider::new(reqwest::Client::new());
        assert!(!p.verify_webhook_signature("u", b"x", &HashMap::new(), &creds()));
    }
}
