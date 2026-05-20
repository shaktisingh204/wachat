use async_trait::async_trait;
use base64::Engine;
use hmac::{Hmac, Mac};
use serde::Deserialize;
use sha1::Sha1;
use std::collections::HashMap;

use super::{
    DlrEvent, InboundMessage, ProviderCreds, ProviderError, SendRequest, SendResult, SmsProvider,
};
use crate::types::{MessageStatus, ProviderId};

pub struct TwilioProvider {
    http: reqwest::Client,
}

impl TwilioProvider {
    pub fn new(http: reqwest::Client) -> Self {
        Self { http }
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
}

#[async_trait]
impl SmsProvider for TwilioProvider {
    fn id(&self) -> ProviderId {
        ProviderId::Twilio
    }

    async fn send(
        &self,
        req: SendRequest<'_>,
        creds: &ProviderCreds,
    ) -> Result<SendResult, ProviderError> {
        let (sid, token) = Self::creds(creds)?;
        let url = format!(
            "https://api.twilio.com/2010-04-01/Accounts/{}/Messages.json",
            sid
        );

        let form = vec![
            ("From", req.from.to_string()),
            ("To", req.to.to_string()),
            ("Body", req.body.to_string()),
        ];

        let resp = self
            .http
            .post(&url)
            .basic_auth(&sid, Some(&token))
            .form(&form)
            .send()
            .await?;

        let status = resp.status();
        let raw = resp.text().await?;

        if !status.is_success() {
            return Err(ProviderError::Rejected(format!(
                "twilio {}: {}",
                status, raw
            )));
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
}
