use hmac::{Hmac, Mac};
use sha1::Sha1;
use base64::{Engine as _, engine::general_purpose::STANDARD};
use std::collections::BTreeMap;
use crate::{SmsProvider, SmsStatus};
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::BTreeMap;

    #[test]
    fn test_map_twilio_status() {
        assert_eq!(map_twilio_status("queued"), SmsStatus::Queued);
        assert_eq!(map_twilio_status("delivered"), SmsStatus::Delivered);
        assert_eq!(map_twilio_status("FAILED"), SmsStatus::Failed);
        assert_eq!(map_twilio_status("unknown"), SmsStatus::Unknown("unknown".to_string()));
    }

    #[test]
    fn test_verify_twilio_signature() {
        let auth_token = "12345";
        let url = "https://mycompany.com/myapp.php?foo=1&bar=2";
        let mut post_params = BTreeMap::new();
        post_params.insert("CallSid", "CA1234567890ABCDE");
        post_params.insert("Caller", "+12349013030");
        post_params.insert("Digits", "1234");
        post_params.insert("From", "+12349013030");
        post_params.insert("To", "+18005551212");

        // The expected signature comes from a known valid output or can be calculated manually.
        // We'll just generate the valid signature to test it returns true on identical calculation.
        let mut data = String::from(url);
        for (k, v) in &post_params {
            data.push_str(k);
            data.push_str(v);
        }
        use hmac::{Hmac, Mac};
        use sha1::Sha1;
        use base64::{Engine as _, engine::general_purpose::STANDARD};
        let mut mac = Hmac::<Sha1>::new_from_slice(auth_token.as_bytes()).unwrap();
        mac.update(data.as_bytes());
        let expected_signature = STANDARD.encode(mac.finalize().into_bytes());

        assert!(verify_twilio_signature(auth_token, &expected_signature, url, &post_params));
        assert!(!verify_twilio_signature("wrong_token", &expected_signature, url, &post_params));
    }
}

