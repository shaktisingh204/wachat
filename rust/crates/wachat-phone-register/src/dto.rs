//! Wire-shape DTOs for the five Meta Graph API requests this crate makes.
//!
//! Kept in a dedicated module so the public surface (`VerificationMethod`)
//! lives next to the private request-body types and the `serde` rules
//! that pin them to Meta's exact field names. Every payload here is
//! intentionally tiny — there's nothing optional to negotiate with Meta
//! on these endpoints.

use serde::{Deserialize, Serialize};

/// Method Meta should use to deliver the verification code to the
/// phone-number's owner.
///
/// Mirrors the `codeMethod: 'SMS' | 'VOICE'` parameter of
/// `handleRequestVerificationCode` in
/// `src/app/actions/whatsapp.actions.ts:847`. Serializes to **uppercase**
/// (`"SMS"` / `"VOICE"`) to match the wire shape Meta expects on
/// `POST /{phone-number-id}/request_code`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum VerificationMethod {
    /// Deliver the code via SMS to the phone number under registration.
    Sms,
    /// Deliver the code via a voice call.
    Voice,
}

impl VerificationMethod {
    /// String form Meta expects on the wire (`"SMS"` / `"VOICE"`).
    /// Convenience for tracing without round-tripping through serde_json.
    pub fn as_meta_str(self) -> &'static str {
        match self {
            VerificationMethod::Sms => "SMS",
            VerificationMethod::Voice => "VOICE",
        }
    }
}

// -------------------------------------------------------------------------
// Internal request bodies
// -------------------------------------------------------------------------

/// Body of `POST /{phone-number-id}/register`.
///
/// Mirrors the TS payload at `whatsapp.actions.ts:828`:
///
/// ```ts
/// { messaging_product: 'whatsapp', pin: '...' }
/// ```
///
/// `messaging_product` is hard-coded to `"whatsapp"`.
#[derive(Debug, Serialize)]
pub(crate) struct RegisterBody<'a> {
    pub messaging_product: &'static str,
    pub pin: &'a str,
}

/// Body of `POST /{phone-number-id}/request_code`.
///
/// Mirrors the TS payload at `whatsapp.actions.ts:857`:
///
/// ```ts
/// { code_method: codeMethod, language: 'en' }
/// ```
#[derive(Debug, Serialize)]
pub(crate) struct RequestCodeBody<'a> {
    pub code_method: VerificationMethod,
    pub language: &'a str,
}

/// Body of `POST /{phone-number-id}/verify_code`.
///
/// Mirrors the TS payload at `whatsapp.actions.ts:879`:
///
/// ```ts
/// { code }
/// ```
#[derive(Debug, Serialize)]
pub(crate) struct VerifyCodeBody<'a> {
    pub code: &'a str,
}

/// Body of `POST /{phone-number-id}/deregister`.
///
/// Mirrors the TS payload at `whatsapp.actions.ts:900`:
///
/// ```ts
/// { messaging_product: 'whatsapp' }
/// ```
#[derive(Debug, Serialize)]
pub(crate) struct DeregisterBody {
    pub messaging_product: &'static str,
}

/// Body of `POST /{phone-number-id}` (set 2FA pin).
///
/// Mirrors the TS payload at `whatsapp.actions.ts:929`:
///
/// ```ts
/// { pin }
/// ```
#[derive(Debug, Serialize)]
pub(crate) struct TwoStepPinBody<'a> {
    pub pin: &'a str,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn verification_method_serializes_uppercase() {
        let s = serde_json::to_string(&VerificationMethod::Sms).unwrap();
        assert_eq!(s, "\"SMS\"");
        let s = serde_json::to_string(&VerificationMethod::Voice).unwrap();
        assert_eq!(s, "\"VOICE\"");
    }

    #[test]
    fn verification_method_meta_str_matches_serde() {
        assert_eq!(VerificationMethod::Sms.as_meta_str(), "SMS");
        assert_eq!(VerificationMethod::Voice.as_meta_str(), "VOICE");
    }

    #[test]
    fn register_body_uses_whatsapp_product() {
        let body = RegisterBody {
            messaging_product: "whatsapp",
            pin: "123456",
        };
        let v = serde_json::to_value(&body).unwrap();
        assert_eq!(v["messaging_product"], "whatsapp");
        // PIN is part of the payload but never logged from the registrar.
        assert!(v["pin"].is_string());
    }

    #[test]
    fn request_code_body_field_names_match_meta() {
        let body = RequestCodeBody {
            code_method: VerificationMethod::Sms,
            language: "en",
        };
        let v = serde_json::to_value(&body).unwrap();
        assert_eq!(v["code_method"], "SMS");
        assert_eq!(v["language"], "en");
    }

    #[test]
    fn deregister_body_uses_whatsapp_product() {
        let body = DeregisterBody {
            messaging_product: "whatsapp",
        };
        let v = serde_json::to_value(&body).unwrap();
        assert_eq!(v["messaging_product"], "whatsapp");
    }
}
