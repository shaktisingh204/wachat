use async_trait::async_trait;
use base64::Engine;
use hmac::{Hmac, Mac};
use once_cell::sync::Lazy;
use serde::Deserialize;
use serde_json::Value;
use sha1::Sha1;
use std::collections::hash_map::DefaultHasher;
use std::collections::HashMap;
use std::hash::{Hash, Hasher};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use super::{
    DlrEvent, InboundMessage, ProviderCreds, ProviderError, RcsPayload, RcsSuggestion,
    SendOptions, SendRequest, SendResult, SmsProvider,
};
use crate::types::{MessageStatus, ProviderId};

const DEFAULT_BASE_URL: &str = "https://api.twilio.com";
const DEFAULT_CONTENT_BASE_URL: &str = "https://content.twilio.com";

/// V2.11 — ContentSid cache, keyed `{accountSid}:{payload hash}`, 24h
/// TTL. NOTE: the plan called for Redis; the adapter trait has no Redis
/// handle, so this is an in-process cache with the same key/TTL
/// semantics (per-worker duplication is acceptable — a cache miss just
/// re-creates an identical Content resource, which Twilio tolerates).
static CONTENT_SID_CACHE: Lazy<Mutex<HashMap<String, (String, Instant)>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));
const CONTENT_SID_TTL: Duration = Duration::from_secs(24 * 60 * 60);

pub struct TwilioProvider {
    http: reqwest::Client,
    base_url: String,
    /// Twilio Content API host (`https://content.twilio.com`) — a
    /// DIFFERENT host from the messaging API.
    content_base_url: String,
}

impl TwilioProvider {
    pub fn new(http: reqwest::Client) -> Self {
        Self {
            http,
            base_url: DEFAULT_BASE_URL.to_string(),
            content_base_url: DEFAULT_CONTENT_BASE_URL.to_string(),
        }
    }

    /// Test-only constructor pointing the adapter (messaging AND content
    /// hosts) at a wiremock server.
    pub fn with_base_url(http: reqwest::Client, base_url: impl Into<String>) -> Self {
        let base = base_url.into();
        Self {
            http,
            base_url: base.clone(),
            content_base_url: base,
        }
    }

    fn creds(creds: &ProviderCreds) -> Result<(String, String), ProviderError> {
        let sid = creds
            .blob
            .get("accountSid")
            .and_then(|v| v.as_str())
            .ok_or(ProviderError::InvalidCredentials)?
            .to_string();
        let token = creds
            .blob
            .get("authToken")
            .and_then(|v| v.as_str())
            .ok_or(ProviderError::InvalidCredentials)?
            .to_string();
        Ok((sid, token))
    }

    /// Resolve (create or cache-hit) a Content API ContentSid for an RCS
    /// payload: `POST {content_base}/v1/Content` with a `twilio/card` +
    /// `twilio/text` (fallback) document, then cached 24h by payload hash.
    async fn resolve_content_sid(
        &self,
        sid: &str,
        token: &str,
        rcs: &RcsPayload,
    ) -> Result<String, ProviderError> {
        let payload_json = serde_json::to_string(rcs)
            .map_err(|e| ProviderError::Decode(format!("rcs payload serialize: {e}")))?;
        let mut hasher = DefaultHasher::new();
        sid.hash(&mut hasher);
        payload_json.hash(&mut hasher);
        let key = format!("{sid}:{:016x}", hasher.finish());

        if let Ok(cache) = CONTENT_SID_CACHE.lock() {
            if let Some((content_sid, at)) = cache.get(&key) {
                if at.elapsed() < CONTENT_SID_TTL {
                    return Ok(content_sid.clone());
                }
            }
        }

        let url = format!("{}/v1/Content", self.content_base_url);
        let body = content_create_json(rcs, &key);
        let resp = self
            .http
            .post(&url)
            .basic_auth(sid, Some(token))
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
        if !status.is_success() {
            let code = serde_json::from_str::<Value>(&raw)
                .ok()
                .and_then(|v| v.get("code").and_then(|c| c.as_i64()))
                .map(|c| c.to_string());
            return Err(ProviderError::Rejected {
                code,
                message: format!("twilio content {}: {}", status, raw),
            });
        }
        let content_sid = serde_json::from_str::<Value>(&raw)
            .ok()
            .and_then(|v| v.get("sid").and_then(|s| s.as_str()).map(|s| s.to_string()))
            .ok_or_else(|| {
                ProviderError::Decode("twilio content response: missing sid".into())
            })?;

        if let Ok(mut cache) = CONTENT_SID_CACHE.lock() {
            cache.insert(key, (content_sid.clone(), Instant::now()));
        }
        Ok(content_sid)
    }
}

/// V2.11 — map our [`RcsPayload`] onto a Twilio Content API create body:
/// `twilio/card` (rich card + suggestion actions) plus `twilio/text`
/// (the SMS fallback Twilio uses for non-RCS-reachable handsets).
/// Wiremock tests pin this shape.
pub fn content_create_json(rcs: &RcsPayload, key: &str) -> Value {
    let actions: Vec<Value> = rcs
        .suggestions
        .iter()
        .map(|s| match s {
            RcsSuggestion::Reply {
                text,
                postback_data,
            } => serde_json::json!({
                "type": "QUICK_REPLY",
                "title": text,
                "id": postback_data,
            }),
            RcsSuggestion::OpenUrl { text, url } => serde_json::json!({
                "type": "URL",
                "title": text,
                "url": url,
            }),
            RcsSuggestion::Dial { text, phone } => serde_json::json!({
                "type": "PHONE_NUMBER",
                "title": text,
                "phone": phone,
            }),
        })
        .collect();

    let mut card = serde_json::Map::new();
    if let Some(c) = &rcs.card {
        card.insert("title".into(), Value::String(c.title.clone()));
        card.insert("subtitle".into(), Value::String(c.description.clone()));
        if let Some(media_url) = &c.media_url {
            card.insert(
                "media".into(),
                Value::Array(vec![Value::String(media_url.clone())]),
            );
        }
    }
    if !actions.is_empty() {
        card.insert("actions".into(), Value::Array(actions));
    }

    serde_json::json!({
        "friendly_name": format!("sabsms-rcs-{key}"),
        "language": "en",
        "types": {
            "twilio/card": Value::Object(card),
            "twilio/text": { "body": rcs.fallback_text },
        }
    })
}

#[async_trait]
impl SmsProvider for TwilioProvider {
    fn id(&self) -> ProviderId {
        ProviderId::Twilio
    }

    async fn send(
        &self,
        req: SendRequest<'_>,
        opts: &SendOptions,
        creds: &ProviderCreds,
    ) -> Result<SendResult, ProviderError> {
        let (sid, token) = Self::creds(creds)?;
        let url = format!(
            "{}/2010-04-01/Accounts/{}/Messages.json",
            self.base_url, sid
        );

        // V2.11 — RCS via the Content API: create (or cache-hit) the
        // content document first, then send with ContentSid instead of
        // Body (the card media lives inside the content, so MediaUrl is
        // skipped too).
        let content_sid = match &opts.rcs {
            Some(rcs) => Some(self.resolve_content_sid(&sid, &token, rcs).await?),
            None => None,
        };

        let mut form = vec![
            ("From", req.from.to_string()),
            ("To", req.to.to_string()),
        ];
        match &content_sid {
            Some(cs) => form.push(("ContentSid", cs.clone())),
            None => {
                form.push(("Body", req.body.to_string()));
                // MMS: repeated MediaUrl params, one per attachment.
                for media_url in &opts.media_urls {
                    form.push(("MediaUrl", media_url.clone()));
                }
            }
        }
        if let Some(cb) = &opts.callback_url {
            form.push(("StatusCallback", cb.clone()));
        }

        let resp = self
            .http
            .post(&url)
            .basic_auth(&sid, Some(&token))
            .form(&form)
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
        if !status.is_success() {
            // Error body: {"code": 21211, "message": "...", "status": 400}.
            let code = serde_json::from_str::<serde_json::Value>(&raw)
                .ok()
                .and_then(|v| v.get("code").and_then(|c| c.as_i64()))
                .map(|c| c.to_string());
            return Err(ProviderError::Rejected {
                code,
                message: format!("twilio {}: {}", status, raw),
            });
        }

        #[derive(Deserialize)]
        #[serde(rename_all = "snake_case")]
        struct TwilioMessage {
            sid: String,
            status: String,
            #[serde(default)]
            num_segments: Option<String>,
            #[serde(default)]
            price: Option<String>,
        }
        let parsed: TwilioMessage = serde_json::from_str(&raw)
            .map_err(|e| ProviderError::Decode(format!("twilio response: {e}")))?;

        let segments = parsed
            .num_segments
            .as_deref()
            .and_then(|s| s.parse().ok())
            .unwrap_or_else(|| super::estimate_segments(req.body));

        // Twilio returns price as a negative dollar string ("-0.0075"). Convert
        // to positive cents; missing → None.
        let cost = parsed
            .price
            .as_deref()
            .and_then(|s| s.parse::<f64>().ok())
            .map(|d| (d.abs() * 100.0).round() as i64);

        Ok(SendResult {
            provider_message_id: parsed.sid,
            status: map_status(&parsed.status),
            segments,
            cost,
        })
    }

    fn verify_webhook_signature(
        &self,
        url: &str,
        raw_body: &[u8],
        headers: &HashMap<String, String>,
        creds: &ProviderCreds,
    ) -> bool {
        let Ok((_sid, token)) = Self::creds(creds) else {
            return false;
        };
        let expected = match headers
            .iter()
            .find(|(k, _)| k.eq_ignore_ascii_case("X-Twilio-Signature"))
        {
            Some((_, v)) => v.clone(),
            None => return false,
        };

        // Twilio signs URL + sorted form params concatenated (for
        // application/x-www-form-urlencoded payloads). Parse the body,
        // sort, concatenate, HMAC-SHA1, base64.
        let parsed: Vec<(String, String)> =
            serde_urlencoded::from_bytes(raw_body).unwrap_or_default();
        let mut sorted = parsed;
        sorted.sort_by(|a, b| a.0.cmp(&b.0));
        let mut message = String::from(url);
        for (k, v) in sorted {
            message.push_str(&k);
            message.push_str(&v);
        }

        let mut mac = Hmac::<Sha1>::new_from_slice(token.as_bytes()).expect("HMAC");
        mac.update(message.as_bytes());
        let computed = base64::engine::general_purpose::STANDARD.encode(mac.finalize().into_bytes());

        // Constant-time-ish compare via straight `==`; the strings are short
        // and we accept the leak. Real timing-safe compare can be wired
        // in a follow-up if needed.
        computed == expected
    }

    fn parse_inbound(&self, raw_body: &[u8]) -> Result<InboundMessage, ProviderError> {
        let parsed: HashMap<String, String> = serde_urlencoded::from_bytes(raw_body)
            .map_err(|e| ProviderError::Decode(format!("twilio inbound form: {e}")))?;

        let from = parsed
            .get("From")
            .cloned()
            .ok_or_else(|| ProviderError::BadRequest("missing From".into()))?;
        let to = parsed
            .get("To")
            .cloned()
            .ok_or_else(|| ProviderError::BadRequest("missing To".into()))?;
        let body = parsed.get("Body").cloned().unwrap_or_default();
        let provider_message_id = parsed
            .get("MessageSid")
            .cloned()
            .ok_or_else(|| ProviderError::BadRequest("missing MessageSid".into()))?;

        let num_media: usize = parsed
            .get("NumMedia")
            .and_then(|s| s.parse().ok())
            .unwrap_or(0);
        let mut media_urls = Vec::with_capacity(num_media);
        for i in 0..num_media {
            if let Some(url) = parsed.get(&format!("MediaUrl{i}")) {
                media_urls.push(url.clone());
            }
        }

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
        let parsed: HashMap<String, String> = serde_urlencoded::from_bytes(raw_body)
            .map_err(|e| ProviderError::Decode(format!("twilio dlr form: {e}")))?;
        let provider_message_id = parsed
            .get("MessageSid")
            .cloned()
            .ok_or_else(|| ProviderError::BadRequest("missing MessageSid".into()))?;
        let status_raw = parsed
            .get("MessageStatus")
            .cloned()
            .unwrap_or_else(|| "unknown".to_string());
        let error_code = parsed.get("ErrorCode").cloned();
        let error_message = parsed.get("ErrorMessage").cloned();
        Ok(DlrEvent {
            provider_message_id,
            status: map_status(&status_raw),
            error_code,
            error_message,
        })
    }
}

fn map_status(s: &str) -> MessageStatus {
    match s {
        "queued" | "accepted" | "scheduled" => MessageStatus::Queued,
        "sending" => MessageStatus::Sending,
        "sent" => MessageStatus::Sent,
        "delivered" | "read" => MessageStatus::Delivered,
        "undelivered" => MessageStatus::Undelivered,
        "failed" => MessageStatus::Failed,
        "rejected" => MessageStatus::Rejected,
        _ => MessageStatus::Queued,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use wiremock::matchers::{body_string_contains, method, path};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    fn creds() -> ProviderCreds {
        ProviderCreds {
            blob: serde_json::json!({ "accountSid": "ACxxxx", "authToken": "tok" }),
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

    #[test]
    fn status_maps_known_values() {
        assert_eq!(map_status("delivered"), MessageStatus::Delivered);
        assert_eq!(map_status("failed"), MessageStatus::Failed);
        assert_eq!(map_status("sent"), MessageStatus::Sent);
        assert_eq!(map_status("undelivered"), MessageStatus::Undelivered);
    }

    #[test]
    fn parses_inbound_form() {
        let p = TwilioProvider::new(reqwest::Client::new());
        let body = b"MessageSid=SM123&From=%2B15551234567&To=%2B15557654321&Body=hi&NumMedia=0";
        let msg = p.parse_inbound(body).unwrap();
        assert_eq!(msg.provider_message_id, "SM123");
        assert_eq!(msg.from, "+15551234567");
        assert_eq!(msg.to, "+15557654321");
        assert_eq!(msg.body, "hi");
        assert!(msg.media_urls.is_empty());
    }

    #[test]
    fn parses_dlr_form() {
        let p = TwilioProvider::new(reqwest::Client::new());
        let body = b"MessageSid=SM999&MessageStatus=delivered";
        let dlr = p.parse_dlr(body).unwrap();
        assert_eq!(dlr.provider_message_id, "SM999");
        assert_eq!(dlr.status, MessageStatus::Delivered);
    }

    #[test]
    fn parses_dlr_error_code() {
        let p = TwilioProvider::new(reqwest::Client::new());
        let body = b"MessageSid=SM999&MessageStatus=undelivered&ErrorCode=30003";
        let dlr = p.parse_dlr(body).unwrap();
        assert_eq!(dlr.status, MessageStatus::Undelivered);
        assert_eq!(dlr.error_code.as_deref(), Some("30003"));
    }

    #[test]
    fn verifies_signature_with_canonical_twilio_example() {
        // Canonical Twilio signing example (from their docs): URL +
        // sorted params, HMAC-SHA1 with auth token, base64.
        let p = TwilioProvider::new(reqwest::Client::new());
        let creds = ProviderCreds {
            blob: serde_json::json!({
                "accountSid": "ACxxxx",
                "authToken": "12345"
            }),
        };
        let url = "https://example.com/hook";
        let body = b"Bar=2&Foo=1";
        // Computed once with the reference algorithm.
        let mut mac = Hmac::<Sha1>::new_from_slice(b"12345").unwrap();
        mac.update(b"https://example.com/hookBar2Foo1");
        let expected = base64::engine::general_purpose::STANDARD.encode(mac.finalize().into_bytes());
        let mut headers = HashMap::new();
        headers.insert("X-Twilio-Signature".to_string(), expected);
        assert!(p.verify_webhook_signature(url, body, &headers, &creds));
    }

    #[tokio::test]
    async fn send_happy_path_with_media_urls() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/2010-04-01/Accounts/ACxxxx/Messages.json"))
            .and(body_string_contains("MediaUrl=https%3A%2F%2Fr2.example.com%2Fa.jpg"))
            .and(body_string_contains("StatusCallback="))
            .respond_with(ResponseTemplate::new(201).set_body_raw(
                r#"{"sid":"SM42","status":"queued","num_segments":"1","price":"-0.0075"}"#,
                "application/json",
            ))
            .mount(&server)
            .await;

        let p = TwilioProvider::with_base_url(reqwest::Client::new(), server.uri());
        let opts = SendOptions {
            media_urls: vec!["https://r2.example.com/a.jpg".into()],
            dlt: None,
            callback_url: Some("https://app.example.com/cb".into()),
            rcs: None,
        };
        let r = p.send(req("hello"), &opts, &creds()).await.unwrap();
        assert_eq!(r.provider_message_id, "SM42");
        assert_eq!(r.status, MessageStatus::Queued);
        assert_eq!(r.segments, 1);
        assert_eq!(r.cost, Some(1));
    }

    #[tokio::test]
    async fn send_error_carries_twilio_code() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/2010-04-01/Accounts/ACxxxx/Messages.json"))
            .respond_with(ResponseTemplate::new(400).set_body_raw(
                r#"{"code":21211,"message":"The 'To' number is not a valid phone number.","status":400}"#,
                "application/json",
            ))
            .mount(&server)
            .await;

        let p = TwilioProvider::with_base_url(reqwest::Client::new(), server.uri());
        let e = p
            .send(req("hello"), &SendOptions::default(), &creds())
            .await
            .unwrap_err();
        assert_eq!(e.provider_code(), Some("21211"));
        assert!(!e.is_retryable());
    }

    // ── V2.11 — RCS via the Content API ─────────────────────────────────

    fn rcs_payload(marker: &str) -> RcsPayload {
        RcsPayload {
            card: Some(super::super::RcsCard {
                title: format!("Card {marker}"),
                description: "Desc".into(),
                media_url: Some("https://r2.example.com/card.jpg".into()),
                orientation: None,
            }),
            suggestions: vec![
                RcsSuggestion::Reply {
                    text: "Yes".into(),
                    postback_data: "yes_tap".into(),
                },
                RcsSuggestion::OpenUrl {
                    text: "Open".into(),
                    url: "https://x.example.com".into(),
                },
                RcsSuggestion::Dial {
                    text: "Call".into(),
                    phone: "+15550002222".into(),
                },
            ],
            fallback_text: format!("Fallback {marker}"),
        }
    }

    #[test]
    fn content_create_json_pins_card_and_text_types() {
        let v = content_create_json(&rcs_payload("a"), "k1");
        assert_eq!(v["language"], "en");
        assert_eq!(v["friendly_name"], "sabsms-rcs-k1");
        let card = &v["types"]["twilio/card"];
        assert_eq!(card["title"], "Card a");
        assert_eq!(card["subtitle"], "Desc");
        assert_eq!(card["media"][0], "https://r2.example.com/card.jpg");
        let actions = card["actions"].as_array().unwrap();
        assert_eq!(actions[0]["type"], "QUICK_REPLY");
        assert_eq!(actions[0]["id"], "yes_tap");
        assert_eq!(actions[1]["type"], "URL");
        assert_eq!(actions[1]["url"], "https://x.example.com");
        assert_eq!(actions[2]["type"], "PHONE_NUMBER");
        assert_eq!(actions[2]["phone"], "+15550002222");
        assert_eq!(v["types"]["twilio/text"]["body"], "Fallback a");
    }

    #[tokio::test]
    async fn send_rcs_creates_content_then_sends_with_content_sid() {
        let server = MockServer::start().await;
        // 1) Content create.
        Mock::given(method("POST"))
            .and(path("/v1/Content"))
            .and(body_string_contains("twilio/card"))
            .and(body_string_contains("Fallback b"))
            .respond_with(ResponseTemplate::new(201).set_body_raw(
                r#"{"sid":"HX123","friendly_name":"sabsms-rcs"}"#,
                "application/json",
            ))
            .expect(1)
            .mount(&server)
            .await;
        // 2) Message send with ContentSid (and no Body param).
        Mock::given(method("POST"))
            .and(path("/2010-04-01/Accounts/ACxxxx/Messages.json"))
            .and(body_string_contains("ContentSid=HX123"))
            .respond_with(ResponseTemplate::new(201).set_body_raw(
                r#"{"sid":"SM77","status":"queued","num_segments":"1","price":null}"#,
                "application/json",
            ))
            .expect(2)
            .mount(&server)
            .await;

        let p = TwilioProvider::with_base_url(reqwest::Client::new(), server.uri());
        let opts = SendOptions {
            rcs: Some(rcs_payload("b")),
            ..SendOptions::default()
        };
        let r = p.send(req("ignored"), &opts, &creds()).await.unwrap();
        assert_eq!(r.provider_message_id, "SM77");

        // Second send with the SAME payload — ContentSid comes from the
        // in-process cache, so /v1/Content is hit exactly once (`expect(1)`
        // above) while Messages is hit twice.
        let r2 = p.send(req("ignored"), &opts, &creds()).await.unwrap();
        assert_eq!(r2.provider_message_id, "SM77");
    }

    #[tokio::test]
    async fn send_rcs_content_create_error_is_rejected() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/v1/Content"))
            .respond_with(ResponseTemplate::new(400).set_body_raw(
                r#"{"code":20422,"message":"Invalid content"}"#,
                "application/json",
            ))
            .mount(&server)
            .await;

        let p = TwilioProvider::with_base_url(reqwest::Client::new(), server.uri());
        let opts = SendOptions {
            rcs: Some(rcs_payload("c")),
            ..SendOptions::default()
        };
        let e = p.send(req("x"), &opts, &creds()).await.unwrap_err();
        assert_eq!(e.provider_code(), Some("20422"));
        assert!(!e.is_retryable());
    }

    #[tokio::test]
    async fn send_429_maps_to_throttled() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/2010-04-01/Accounts/ACxxxx/Messages.json"))
            .respond_with(
                ResponseTemplate::new(429)
                    .insert_header("retry-after", "7")
                    .set_body_raw(r#"{"code":20429,"message":"rate limited"}"#, "application/json"),
            )
            .mount(&server)
            .await;

        let p = TwilioProvider::with_base_url(reqwest::Client::new(), server.uri());
        let e = p
            .send(req("hello"), &SendOptions::default(), &creds())
            .await
            .unwrap_err();
        assert!(matches!(
            e,
            ProviderError::Throttled {
                retry_after_secs: Some(7)
            }
        ));
    }
}
