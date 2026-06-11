//! PayU Biz (India) SHA-512 hashing — port of the Next.js `src/lib/payu.ts`.
//!
//! PayU's standard integration is a form-POST redirect flow. We build the
//! request hash + field set on the server, the browser auto-submits a hidden
//! form to `secure.payu.in` (or the test host), and PayU POSTs the customer
//! back to our callback with a reverse-hash we re-verify.
//!
//! Platform credentials come from the engine environment:
//!   PAYU_MERCHANT_KEY   — merchant key
//!   PAYU_MERCHANT_SALT  — merchant salt
//!   PAYU_MODE           — "test" | "production" (default "test")

use sha2::{Digest, Sha512};

const PAYU_TEST: &str = "https://test.payu.in/_payment";
const PAYU_PROD: &str = "https://secure.payu.in/_payment";

/// Resolved platform PayU configuration.
#[derive(Debug, Clone)]
pub struct PayuConfig {
    pub key: String,
    pub salt: String,
    /// Hosted-page POST target for the active mode.
    pub action: String,
}

/// Read the platform PayU config from the environment. Returns `None` when the
/// key or salt is missing (callers surface a 503 — payments unavailable).
pub fn config() -> Option<PayuConfig> {
    let key = std::env::var("PAYU_MERCHANT_KEY").ok()?;
    let salt = std::env::var("PAYU_MERCHANT_SALT").ok()?;
    if key.trim().is_empty() || salt.trim().is_empty() {
        return None;
    }
    let mode = std::env::var("PAYU_MODE").unwrap_or_else(|_| "test".to_owned());
    let action = if mode == "production" { PAYU_PROD } else { PAYU_TEST };
    Some(PayuConfig {
        key,
        salt,
        action: action.to_owned(),
    })
}

fn sha512_hex(input: &str) -> String {
    let mut h = Sha512::new();
    h.update(input.as_bytes());
    hex::encode(h.finalize())
}

/// Fields that go into the forward (request) hash. `udf1` carries the SabPay
/// payment id; `udf2` is the literal source tag `"sabpay"`.
pub struct RequestHashInput<'a> {
    pub key: &'a str,
    pub txnid: &'a str,
    pub amount: &'a str,
    pub productinfo: &'a str,
    pub firstname: &'a str,
    pub email: &'a str,
    pub udf1: &'a str,
    pub udf2: &'a str,
}

/// Forward hash:
/// `sha512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||salt)`
///
/// After `udf5` there are six empty placeholders (`udf6..udf10`) before the
/// salt — identical to the Node implementation.
pub fn build_request_hash(input: &RequestHashInput, salt: &str) -> String {
    let parts = [
        input.key,
        input.txnid,
        input.amount,
        input.productinfo,
        input.firstname,
        input.email,
        input.udf1,
        input.udf2,
        "", // udf3
        "", // udf4
        "", // udf5
        "", // udf6
        "", // udf7
        "", // udf8
        "", // udf9
        "", // udf10
        salt,
    ];
    sha512_hex(&parts.join("|"))
}

/// Fields PayU posts back to the callback, used to recompute the reverse hash.
#[derive(Debug, Default, Clone)]
pub struct ResponseFields {
    pub status: String,
    pub key: String,
    pub txnid: String,
    pub amount: String,
    pub productinfo: String,
    pub firstname: String,
    pub email: String,
    pub udf1: String,
    pub udf2: String,
    pub udf3: String,
    pub udf4: String,
    pub udf5: String,
    pub udf6: String,
    pub udf7: String,
    pub udf8: String,
    pub udf9: String,
    pub udf10: String,
    pub hash: String,
}

/// Reverse hash:
/// `sha512(salt|status|udf10|udf9|udf8|udf7|udf6|udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key)`
fn build_response_hash(f: &ResponseFields, salt: &str) -> String {
    let parts = [
        salt,
        f.status.as_str(),
        f.udf10.as_str(),
        f.udf9.as_str(),
        f.udf8.as_str(),
        f.udf7.as_str(),
        f.udf6.as_str(),
        f.udf5.as_str(),
        f.udf4.as_str(),
        f.udf3.as_str(),
        f.udf2.as_str(),
        f.udf1.as_str(),
        f.email.as_str(),
        f.firstname.as_str(),
        f.productinfo.as_str(),
        f.amount.as_str(),
        f.txnid.as_str(),
        f.key.as_str(),
    ];
    sha512_hex(&parts.join("|"))
}

/// Constant-time-ish verification of PayU's posted reverse hash.
pub fn verify_response_hash(f: &ResponseFields, salt: &str) -> bool {
    let expected = build_response_hash(f, salt);
    let received = f.hash.to_lowercase();
    if expected.len() != received.len() {
        return false;
    }
    let mut diff: u8 = 0;
    for (a, b) in expected.bytes().zip(received.bytes()) {
        diff |= a ^ b;
    }
    diff == 0
}

/// Format an integer paise amount as PayU's `"123.45"` string (2 decimals).
pub fn format_amount_paise(paise: i64) -> String {
    let major = paise / 100;
    let minor = (paise % 100).abs();
    format!("{major}.{minor:02}")
}

/// Strip a description down to PayU-safe `productinfo` (alphanumerics + a few
/// punctuation marks), capped at 100 chars; falls back to `"Payment"`.
pub fn safe_productinfo(description: &str) -> String {
    let cleaned: String = description
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || matches!(c, ' ' | '.' | ',' | '-') {
                c
            } else {
                ' '
            }
        })
        .collect();
    let trimmed = cleaned.trim();
    if trimmed.is_empty() {
        "Payment".to_owned()
    } else {
        trimmed.chars().take(100).collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn amount_formats_two_decimals() {
        assert_eq!(format_amount_paise(49900), "499.00");
        assert_eq!(format_amount_paise(49999), "499.99");
        assert_eq!(format_amount_paise(100), "1.00");
        assert_eq!(format_amount_paise(105), "1.05");
    }

    #[test]
    fn productinfo_is_sanitised() {
        assert_eq!(safe_productinfo("Pro plan | March"), "Pro plan   March");
        assert_eq!(safe_productinfo("   "), "Payment");
    }

    #[test]
    fn reverse_hash_round_trips() {
        let salt = "saltY";
        let mut f = ResponseFields {
            status: "success".into(),
            key: "k".into(),
            txnid: "sp123".into(),
            amount: "499.00".into(),
            productinfo: "Pro".into(),
            firstname: "A".into(),
            email: "a@b.com".into(),
            udf1: "pay_x".into(),
            udf2: "sabpay".into(),
            ..Default::default()
        };
        f.hash = build_response_hash(&f, salt);
        assert!(verify_response_hash(&f, salt));
        f.amount = "1.00".into();
        assert!(!verify_response_hash(&f, salt));
    }
}
