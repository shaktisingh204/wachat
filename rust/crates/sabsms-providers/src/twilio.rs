use hmac::{Hmac, Mac};
use sha1::Sha1;
use base64::{Engine as _, engine::general_purpose::STANDARD};
use std::collections::BTreeMap;
use crate::SmsProvider;
use async_trait::async_trait;

type HmacSha1 = Hmac<Sha1>;

/// Validates a Twilio request signature
///
/// # Arguments
/// * `auth_token` - The Twilio Auth Token
/// * `signature` - The `X-Twilio-Signature` header value
/// * `url` - The full URL of the request
/// * `post_params` - A BTreeMap of the POST parameters (must be sorted by key, BTreeMap does this automatically)
pub fn verify_twilio_signature(
    auth_token: &str,
    signature: &str,
    url: &str,
    post_params: &BTreeMap<&str, &str>,
) -> bool {
    let mut data = String::from(url);
    for (k, v) in post_params {
        data.push_str(k);
        data.push_str(v);
    }

    let mut mac = match HmacSha1::new_from_slice(auth_token.as_bytes()) {
        Ok(mac) => mac,
        Err(_) => return false,
    };

    mac.update(data.as_bytes());
    let result = mac.finalize().into_bytes();
    let expected_signature = STANDARD.encode(result);

    signature == expected_signature
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SmsStatus {
    Queued,
    Sending,
    Sent,
    Delivered,
    Failed,
    Undelivered,
    Receiving,
    Received,
    Read,
    Unknown(String),
}

/// Maps a Twilio status string to the unified `SmsStatus` enum
pub fn map_twilio_status(status: &str) -> SmsStatus {
    match status.to_lowercase().as_str() {
        "queued" => SmsStatus::Queued,
        "sending" => SmsStatus::Sending,
        "sent" => SmsStatus::Sent,
        "delivered" => SmsStatus::Delivered,
        "failed" => SmsStatus::Failed,
        "undelivered" => SmsStatus::Undelivered,
        "receiving" => SmsStatus::Receiving,
        "received" => SmsStatus::Received,
        "read" => SmsStatus::Read,
        other => SmsStatus::Unknown(other.to_string()),
    }
}

pub struct TwilioProvider {
    pub account_sid: String,
    pub auth_token: String,
}

#[async_trait]
impl SmsProvider for TwilioProvider {
    async fn send_sms(&self, _to: &str, _from: &str, _body: &str) -> Result<String, String> {
        // Implementation for sending SMS via Twilio API would go here
        // Usually requires an HTTP client like reqwest
        Ok("mock_twilio_message_sid".to_string())
    }
}
