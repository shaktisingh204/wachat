//! Gupshup Enterprise SMS API adapter (India routes).
//!
//! - Send: `POST {base}/GatewayAPI/rest` (form-encoded):
//!   `method=SendMessage&send_to=<digits>&msg=<body>&msg_type=TEXT&
//!    userid=<userid>&password=<password>&auth_scheme=plain&v=1.1&
//!    format=json[&mask=<senderId>][&principalEntityId=<PE>]
//!    [&dltTemplateId=<TE>]`
//!   Credential blob: `{ "userid": "...", "password": "..." }`.
//!   Success response:
//!   `{"response":{"id":"39400...","phone":"91...","details":"","status":"success"}}`;
//!   error: `{"response":{"status":"error","id":"102","details":"..."}}`.
//! - DLR callback: Gupshup calls back (GET or POST) with form/query
//!   params `externalId`, `status` (DELIVRD/SUCCESS/FAIL/UNDELIV...),
//!   `cause` (e.g. ABSENT_SUBSCRIBER, DND_FAIL), `phoneNo`, `deliveredTS`.
//!   GET callbacks are handled by the generic dispatch passing the query
//!   string as the body.
//! - Inbound callback: form/query params `from`/`msisdn`, `text`/`msg`,
//!   `to`/`shortcode`, optional `messageId`/`externalId`.
//! - Signatures: none — webhook authenticity is the per-account
//!   `?secret=` URL parameter enforced by the generic dispatch;
//!   `verify_webhook_signature` always returns `false`.

use async_trait::async_trait;
use serde_json::Value;
use std::collections::HashMap;

use super::{
    DlrEvent, InboundMessage, ProviderCreds, ProviderError, SendOptions, SendRequest, SendResult,
    SmsProvider,
};
use crate::types::{MessageStatus, ProviderId};

const DEFAULT_BASE_URL: &str = "https://enterprise.smsgupshup.com";

pub struct GupshupProvider {
    http: reqwest::Client,
    base_url: String,
}

impl GupshupProvider {
    pub fn new(http: reqwest::Client) -> Self {
        // Env-overridable base (`SABSMS_GUPSHUP_BASE_URL`) — the RBM
        // endpoint in particular varies per Gupshup enterprise tenant.
        let base_url = std::env::var("SABSMS_GUPSHUP_BASE_URL")
            .ok()
            .filter(|s| !s.trim().is_empty())
            .map(|s| s.trim_end_matches('/').to_string())
            .unwrap_or_else(|| DEFAULT_BASE_URL.to_string());
        Self { http, base_url }
    }

    /// Test-only constructor pointing the adapter at a wiremock server.
    pub fn with_base_url(http: reqwest::Client, base_url: impl Into<String>) -> Self {
        Self {
            http,
            base_url: base_url.into(),
        }
    }

    fn creds(creds: &ProviderCreds) -> Result<(String, String), ProviderError> {
        let userid = creds
            .blob
            .get("userid")
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
            .ok_or(ProviderError::InvalidCredentials)?
            .to_string();
        let password = creds
            .blob
            .get("password")
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
            .ok_or(ProviderError::InvalidCredentials)?
            .to_string();
        Ok((userid, password))
    }

    fn flat_params(raw_body: &[u8]) -> HashMap<String, String> {
        if let Ok(v) = serde_json::from_slice::<Value>(raw_body) {
            if let Some(map) = v.as_object() {
                return map
                    .iter()
                    .filter_map(|(k, val)| {
                        let s = match val {
                            Value::String(s) => s.clone(),
                            Value::Number(n) => n.to_string(),
                            _ => return None,
                        };
                        Some((k.clone(), s))
                    })
                    .collect();
            }
        }
        serde_urlencoded::from_bytes::<HashMap<String, String>>(raw_body).unwrap_or_default()
    }

    fn pick(params: &HashMap<String, String>, keys: &[&str]) -> Option<String> {
        for key in keys {
            if let Some((_, v)) = params.iter().find(|(k, _)| k.eq_ignore_ascii_case(key)) {
                if !v.is_empty() {
                    return Some(v.clone());
                }
            }
        }
        None
    }
}

/// V2.11 — map our [`RcsPayload`] onto Gupshup's enterprise RBM
/// `rich_card` JSON (Google RBM `standaloneCard` shape, which the
/// Gupshup RBM gateway forwards verbatim).
///
/// **SINGLE ADJUSTMENT POINT**: the exact enterprise RBM parameter
/// naming differs per Gupshup tenant/account manager docs. Our wiremock
/// tests pin THIS shape (`msg_type=RICH_CARD` + a `rich_card` form param
/// carrying this JSON); if a live tenant needs different field names,
/// change only this function (and `SABSMS_GUPSHUP_BASE_URL` for the
/// endpoint) — nothing else in the engine knows the RBM wire format.
pub fn rbm_rich_card_json(rcs: &crate::providers::RcsPayload) -> Value {
    use crate::providers::RcsSuggestion;

    let suggestions: Vec<Value> = rcs
        .suggestions
        .iter()
        .map(|s| match s {
            RcsSuggestion::Reply {
                text,
                postback_data,
            } => serde_json::json!({
                "reply": { "text": text, "postbackData": postback_data }
            }),
            RcsSuggestion::OpenUrl { text, url } => serde_json::json!({
                "action": {
                    "text": text,
                    "postbackData": format!("open_url:{url}"),
                    "openUrlAction": { "url": url }
                }
            }),
            RcsSuggestion::Dial { text, phone } => serde_json::json!({
                "action": {
                    "text": text,
                    "postbackData": format!("dial:{phone}"),
                    "dialAction": { "phoneNumber": phone }
                }
            }),
        })
        .collect();

    let mut card_content = serde_json::Map::new();
    if let Some(card) = &rcs.card {
        card_content.insert("title".into(), Value::String(card.title.clone()));
        card_content.insert(
            "description".into(),
            Value::String(card.description.clone()),
        );
        if let Some(media_url) = &card.media_url {
            card_content.insert(
                "media".into(),
                serde_json::json!({
                    "height": "MEDIUM",
                    "contentInfo": { "fileUrl": media_url, "forceRefresh": false }
                }),
            );
        }
    }
    if !suggestions.is_empty() {
        card_content.insert("suggestions".into(), Value::Array(suggestions));
    }

    let orientation = rcs
        .card
        .as_ref()
        .and_then(|c| c.orientation.as_deref())
        .map(|o| o.to_ascii_uppercase())
        .unwrap_or_else(|| "VERTICAL".to_string());

    serde_json::json!({
        "standaloneCard": {
            "cardOrientation": orientation,
            "cardContent": Value::Object(card_content),
        }
    })
}

impl GupshupProvider {
    /// V2.11 — batch RCS capability lookup against the Gupshup RBM
    /// gateway.
    ///
    /// **SINGLE ADJUSTMENT POINT** (same caveat as [`rbm_rich_card_json`]):
    /// the enterprise capability call is tenant-documented, not public.
    /// Our pinned shape: `method=RCS_CAPABILITY&phone_numbers=<csv>` on
    /// the same `/GatewayAPI/rest` endpoint, responding
    /// `{"response":{"status":"success","capabilities":{"9198...":true}}}`.
    /// Adjust here (+ `SABSMS_GUPSHUP_BASE_URL`) if a live tenant
    /// differs — wiremock tests pin this shape.
    pub async fn rcs_capability(
        &self,
        phones: &[String],
        creds: &ProviderCreds,
    ) -> Result<HashMap<String, bool>, ProviderError> {
        let (userid, password) = Self::creds(creds)?;
        let url = format!("{}/GatewayAPI/rest", self.base_url);

        // Gupshup wants bare digits with the country prefix (no '+').
        let digits: Vec<String> = phones
            .iter()
            .map(|p| p.chars().filter(|c| c.is_ascii_digit()).collect())
            .collect();

        let form: Vec<(&str, String)> = vec![
            ("method", "RCS_CAPABILITY".into()),
            ("phone_numbers", digits.join(",")),
            ("userid", userid),
            ("password", password),
            ("auth_scheme", "plain".into()),
            ("v", "1.1".into()),
            ("format", "json".into()),
        ];

        let resp = self
            .http
            .post(&url)
            .form(&form)
            .send()
            .await
            .map_err(|e| ProviderError::Network(e.to_string()))?;
        let status = resp.status();
        let raw = resp
            .text()
            .await
            .map_err(|e| ProviderError::Network(e.to_string()))?;
        if !status.is_success() {
            return Err(ProviderError::Rejected {
                code: None,
                message: format!("gupshup capability {}: {}", status, raw),
            });
        }

        let parsed: Value = serde_json::from_str(&raw)
            .map_err(|e| ProviderError::Decode(format!("gupshup capability response: {e}")))?;
        let response = parsed
            .get("response")
            .ok_or_else(|| ProviderError::Decode("gupshup capability: missing envelope".into()))?;
        if response.get("status").and_then(|v| v.as_str()) != Some("success") {
            return Err(ProviderError::Rejected {
                code: None,
                message: "gupshup capability: non-success status".into(),
            });
        }
        let caps = response
            .get("capabilities")
            .and_then(|v| v.as_object())
            .ok_or_else(|| {
                ProviderError::Decode("gupshup capability: missing capabilities map".into())
            })?;

        // Map back digits → the caller's original phone strings.
        let mut out = HashMap::with_capacity(phones.len());
        for (phone, digit) in phones.iter().zip(digits.iter()) {
            let capable = caps.get(digit).and_then(|v| v.as_bool()).unwrap_or(false);
            out.insert(phone.clone(), capable);
        }
        Ok(out)
    }
}

#[async_trait]
impl SmsProvider for GupshupProvider {
    fn id(&self) -> ProviderId {
        ProviderId::Gupshup
    }

    async fn send(
        &self,
        req: SendRequest<'_>,
        opts: &SendOptions,
        creds: &ProviderCreds,
    ) -> Result<SendResult, ProviderError> {
        let (userid, password) = Self::creds(creds)?;
        let url = format!("{}/GatewayAPI/rest", self.base_url);

        // Gupshup wants bare digits with the country prefix (no '+').
        let to_digits: String = req.to.chars().filter(|c| c.is_ascii_digit()).collect();

        // V2.11 — RBM rich card: msg_type RICH_CARD + the card JSON in
        // `rich_card`; `msg` carries the plain-text fallback Gupshup
        // delivers to non-RCS handsets. See `rbm_rich_card_json` (the
        // single adjustment point for the RBM wire shape).
        let (msg_type, msg_body) = match &opts.rcs {
            Some(rcs) => (
                "RICH_CARD",
                if rcs.fallback_text.is_empty() {
                    req.body.to_string()
                } else {
                    rcs.fallback_text.clone()
                },
            ),
            None => ("TEXT", req.body.to_string()),
        };

        let mut form: Vec<(&str, String)> = vec![
            ("method", "SendMessage".into()),
            ("send_to", to_digits),
            ("msg", msg_body),
            ("msg_type", msg_type.into()),
            ("userid", userid),
            ("password", password),
            ("auth_scheme", "plain".into()),
            ("v", "1.1".into()),
            ("format", "json".into()),
        ];
        if let Some(rcs) = &opts.rcs {
            form.push(("rich_card", rbm_rich_card_json(rcs).to_string()));
        }
        // Sender mask: per-message DLT header → request `from`.
        let mask = opts
            .dlt
            .as_ref()
            .and_then(|d| d.header.as_deref())
            .filter(|s| !s.is_empty())
            .or_else(|| Some(req.from).filter(|s| !s.is_empty()));
        if let Some(mask) = mask {
            form.push(("mask", mask.to_string()));
        }
        if let Some(dlt) = &opts.dlt {
            if let Some(pe) = dlt.entity_id.as_deref().filter(|s| !s.is_empty()) {
                form.push(("principalEntityId", pe.to_string()));
            }
            if let Some(te) = dlt.template_id.as_deref().filter(|s| !s.is_empty()) {
                form.push(("dltTemplateId", te.to_string()));
            }
        }

        let resp = self
            .http
            .post(&url)
            .form(&form)
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
            return Err(ProviderError::Rejected {
                code: None,
                message: format!("gupshup {}: {}", status, raw),
            });
        }

        let parsed: Value = serde_json::from_str(&raw)
            .map_err(|e| ProviderError::Decode(format!("gupshup response: {e}")))?;
        let response = parsed
            .get("response")
            .ok_or_else(|| ProviderError::Decode("gupshup response: missing envelope".into()))?;
        let resp_status = response
            .get("status")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let id = response
            .get("id")
            .and_then(|v| match v {
                Value::String(s) => Some(s.clone()),
                Value::Number(n) => Some(n.to_string()),
                _ => None,
            })
            .unwrap_or_default();
        let details = response
            .get("details")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string();

        if resp_status != "success" {
            // Auth failures come back as error ids 101/102.
            if id == "101" || id == "102" {
                return Err(ProviderError::InvalidCredentials);
            }
            return Err(ProviderError::Rejected {
                code: Some(id).filter(|s| !s.is_empty()),
                message: format!("gupshup error: {details}"),
            });
        }
        if id.is_empty() {
            return Err(ProviderError::Decode(
                "gupshup response: success without message id".into(),
            ));
        }

        Ok(SendResult {
            provider_message_id: id,
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
        let from = Self::pick(&params, &["from", "msisdn", "mobile", "sender"])
            .ok_or_else(|| ProviderError::BadRequest("gupshup inbound: missing from".into()))?;
        let to = Self::pick(&params, &["to", "shortcode", "gupshupId", "receiver"])
            .ok_or_else(|| ProviderError::BadRequest("gupshup inbound: missing to".into()))?;
        let body = Self::pick(&params, &["text", "msg", "message", "content"]).unwrap_or_default();
        let provider_message_id = Self::pick(&params, &["messageId", "externalId", "id"])
            .unwrap_or_else(|| format!("gupshup-in-{}", uuid::Uuid::new_v4()));
        // V2.11 — RBM suggestion-postback taps arrive as inbound messages
        // with the suggestion's postback data attached.
        let postback_data = Self::pick(
            &params,
            &["postbackData", "postback_data", "suggestionPostback"],
        );
        Ok(InboundMessage {
            provider_message_id,
            from,
            to,
            body,
            media_urls: Vec::new(),
            postback_data,
        })
    }

    fn parse_dlr(&self, raw_body: &[u8]) -> Result<DlrEvent, ProviderError> {
        let params = Self::flat_params(raw_body);
        let provider_message_id = Self::pick(&params, &["externalId", "external_id", "id"])
            .ok_or_else(|| ProviderError::BadRequest("gupshup dlr: missing externalId".into()))?;
        let status_raw = Self::pick(&params, &["status", "eventType"])
            .unwrap_or_default()
            .to_uppercase();
        let cause = Self::pick(&params, &["cause", "errCode", "reason"]);

        let status = match status_raw.as_str() {
            "SUCCESS" | "DELIVRD" | "DELIVERED" => MessageStatus::Delivered,
            "FAIL" | "FAILED" | "FAILURE" => MessageStatus::Failed,
            "UNDELIV" | "UNDELIVERED" | "EXPIRED" => MessageStatus::Undelivered,
            "SENT" | "SUBMITTED" => MessageStatus::Sent,
            _ => MessageStatus::Queued,
        };
        let failed = matches!(
            status,
            MessageStatus::Failed | MessageStatus::Undelivered
        );
        // The `cause` (e.g. ABSENT_SUBSCRIBER, DND_FAIL, UNKNOWN_SUBSCRIBER)
        // is the raw error code on failures; on success it's just
        // bookkeeping ("SUCCESS") and is dropped.
        let error_code = if failed { cause.clone() } else { None };
        let error_message = if failed { cause } else { None };

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
    use crate::providers::DltParams;
    use wiremock::matchers::{body_string_contains, method, path};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    fn creds() -> ProviderCreds {
        ProviderCreds {
            blob: serde_json::json!({ "userid": "2000001", "password": "pw" }),
        }
    }

    fn req(body: &str) -> SendRequest<'_> {
        SendRequest {
            from: "SABNDE",
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
            .and(path("/GatewayAPI/rest"))
            .and(body_string_contains("method=SendMessage"))
            .and(body_string_contains("send_to=919876543210"))
            .and(body_string_contains("userid=2000001"))
            .and(body_string_contains("auth_scheme=plain"))
            .and(body_string_contains("principalEntityId=PE1"))
            .and(body_string_contains("dltTemplateId=TE1"))
            .and(body_string_contains("mask=SABNDE"))
            .respond_with(ResponseTemplate::new(200).set_body_raw(
                r#"{"response":{"id":"3940265861","phone":"919876543210","details":"","status":"success"}}"#,
                "application/json",
            ))
            .mount(&server)
            .await;

        let p = GupshupProvider::with_base_url(reqwest::Client::new(), server.uri());
        let opts = SendOptions {
            media_urls: vec![],
            dlt: Some(DltParams {
                entity_id: Some("PE1".into()),
                template_id: Some("TE1".into()),
                header: Some("SABNDE".into()),
            }),
            callback_url: None,
            rcs: None,
        };
        let r = p.send(req("hello"), &opts, &creds()).await.unwrap();
        assert_eq!(r.provider_message_id, "3940265861");
        assert_eq!(r.status, MessageStatus::Sent);
    }

    #[tokio::test]
    async fn send_auth_error_maps_to_invalid_credentials() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/GatewayAPI/rest"))
            .respond_with(ResponseTemplate::new(200).set_body_raw(
                r#"{"response":{"id":"102","details":"Authentication failed due to invalid userId or password","status":"error"}}"#,
                "application/json",
            ))
            .mount(&server)
            .await;

        let p = GupshupProvider::with_base_url(reqwest::Client::new(), server.uri());
        let e = p
            .send(req("hello"), &SendOptions::default(), &creds())
            .await
            .unwrap_err();
        assert!(matches!(e, ProviderError::InvalidCredentials));
    }

    #[tokio::test]
    async fn send_error_carries_gupshup_code() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/GatewayAPI/rest"))
            .respond_with(ResponseTemplate::new(200).set_body_raw(
                r#"{"response":{"id":"105","details":"Invalid phone number","status":"error"}}"#,
                "application/json",
            ))
            .mount(&server)
            .await;

        let p = GupshupProvider::with_base_url(reqwest::Client::new(), server.uri());
        let e = p
            .send(req("hello"), &SendOptions::default(), &creds())
            .await
            .unwrap_err();
        assert_eq!(e.provider_code(), Some("105"));
    }

    #[test]
    fn parses_dlr_delivered_form() {
        let p = GupshupProvider::new(reqwest::Client::new());
        let body =
            b"externalId=3940265861&deliveredTS=1765500000000&status=SUCCESS&phoneNo=919876543210&cause=SUCCESS";
        let dlr = p.parse_dlr(body).unwrap();
        assert_eq!(dlr.provider_message_id, "3940265861");
        assert_eq!(dlr.status, MessageStatus::Delivered);
        assert!(dlr.error_code.is_none());
    }

    #[test]
    fn parses_dlr_dnd_failure() {
        let p = GupshupProvider::new(reqwest::Client::new());
        let body = b"externalId=3940265862&status=FAIL&cause=DND_FAIL&phoneNo=919876543210";
        let dlr = p.parse_dlr(body).unwrap();
        assert_eq!(dlr.status, MessageStatus::Failed);
        assert_eq!(dlr.error_code.as_deref(), Some("DND_FAIL"));
    }

    #[test]
    fn parses_inbound_query_style() {
        let p = GupshupProvider::new(reqwest::Client::new());
        let body = b"from=919876543210&text=STOP&to=SABNDE&messageId=gs-in-1";
        let msg = p.parse_inbound(body).unwrap();
        assert_eq!(msg.from, "919876543210");
        assert_eq!(msg.to, "SABNDE");
        assert_eq!(msg.body, "STOP");
        assert_eq!(msg.provider_message_id, "gs-in-1");
    }

    #[test]
    fn signature_verification_always_false() {
        let p = GupshupProvider::new(reqwest::Client::new());
        assert!(!p.verify_webhook_signature("u", b"x", &HashMap::new(), &creds()));
    }

    // ── V2.11 — RCS / RBM ────────────────────────────────────────────────

    fn rcs_payload() -> crate::providers::RcsPayload {
        crate::providers::RcsPayload {
            card: Some(crate::providers::RcsCard {
                title: "Diwali sale".into(),
                description: "Flat 40% off".into(),
                media_url: Some("https://r2.example.com/card.jpg".into()),
                orientation: None,
            }),
            suggestions: vec![
                crate::providers::RcsSuggestion::Reply {
                    text: "Show offers".into(),
                    postback_data: "show_offers".into(),
                },
                crate::providers::RcsSuggestion::OpenUrl {
                    text: "Shop".into(),
                    url: "https://shop.example.com".into(),
                },
            ],
            fallback_text: "Diwali sale: flat 40% off https://shop.example.com".into(),
        }
    }

    #[test]
    fn rbm_card_json_maps_our_payload_to_standalone_card() {
        let v = rbm_rich_card_json(&rcs_payload());
        let card = &v["standaloneCard"];
        assert_eq!(card["cardOrientation"], "VERTICAL");
        assert_eq!(card["cardContent"]["title"], "Diwali sale");
        assert_eq!(card["cardContent"]["description"], "Flat 40% off");
        assert_eq!(
            card["cardContent"]["media"]["contentInfo"]["fileUrl"],
            "https://r2.example.com/card.jpg"
        );
        let sug = card["cardContent"]["suggestions"].as_array().unwrap();
        assert_eq!(sug.len(), 2);
        assert_eq!(sug[0]["reply"]["text"], "Show offers");
        assert_eq!(sug[0]["reply"]["postbackData"], "show_offers");
        assert_eq!(
            sug[1]["action"]["openUrlAction"]["url"],
            "https://shop.example.com"
        );
    }

    #[tokio::test]
    async fn send_rcs_rich_card_happy_path() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/GatewayAPI/rest"))
            .and(body_string_contains("method=SendMessage"))
            .and(body_string_contains("msg_type=RICH_CARD"))
            // fallback text travels in `msg` (urlencoded).
            .and(body_string_contains("msg=Diwali+sale"))
            // rich_card JSON param carries the standaloneCard shape.
            .and(body_string_contains("rich_card=%7B%22standaloneCard%22"))
            .respond_with(ResponseTemplate::new(200).set_body_raw(
                r#"{"response":{"id":"4040404040","phone":"919876543210","details":"","status":"success"}}"#,
                "application/json",
            ))
            .mount(&server)
            .await;

        let p = GupshupProvider::with_base_url(reqwest::Client::new(), server.uri());
        let opts = SendOptions {
            rcs: Some(rcs_payload()),
            ..SendOptions::default()
        };
        let r = p.send(req("ignored body"), &opts, &creds()).await.unwrap();
        assert_eq!(r.provider_message_id, "4040404040");
        assert_eq!(r.status, MessageStatus::Sent);
    }

    #[tokio::test]
    async fn rcs_capability_happy_path_maps_digits_back_to_phones() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/GatewayAPI/rest"))
            .and(body_string_contains("method=RCS_CAPABILITY"))
            .and(body_string_contains("phone_numbers=919876543210%2C919812345678"))
            .respond_with(ResponseTemplate::new(200).set_body_raw(
                r#"{"response":{"status":"success","capabilities":{"919876543210":true,"919812345678":false}}}"#,
                "application/json",
            ))
            .mount(&server)
            .await;

        let p = GupshupProvider::with_base_url(reqwest::Client::new(), server.uri());
        let phones = vec!["+919876543210".to_string(), "+919812345678".to_string()];
        let caps = p.rcs_capability(&phones, &creds()).await.unwrap();
        assert_eq!(caps.get("+919876543210"), Some(&true));
        assert_eq!(caps.get("+919812345678"), Some(&false));
    }

    #[tokio::test]
    async fn rcs_capability_error_status_rejects() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/GatewayAPI/rest"))
            .respond_with(ResponseTemplate::new(200).set_body_raw(
                r#"{"response":{"status":"error","details":"not enabled"}}"#,
                "application/json",
            ))
            .mount(&server)
            .await;

        let p = GupshupProvider::with_base_url(reqwest::Client::new(), server.uri());
        let e = p
            .rcs_capability(&["+919876543210".to_string()], &creds())
            .await
            .unwrap_err();
        assert!(matches!(e, ProviderError::Rejected { .. }));
    }

    #[test]
    fn parses_inbound_rcs_postback() {
        let p = GupshupProvider::new(reqwest::Client::new());
        let body =
            b"from=919876543210&text=Show+offers&to=SABNDE&messageId=gs-in-9&postbackData=show_offers";
        let msg = p.parse_inbound(body).unwrap();
        assert_eq!(msg.body, "Show offers");
        assert_eq!(msg.postback_data.as_deref(), Some("show_offers"));
    }

    #[test]
    fn parses_inbound_without_postback_as_none() {
        let p = GupshupProvider::new(reqwest::Client::new());
        let body = b"from=919876543210&text=hi&to=SABNDE&messageId=gs-in-10";
        let msg = p.parse_inbound(body).unwrap();
        assert!(msg.postback_data.is_none());
    }
}
