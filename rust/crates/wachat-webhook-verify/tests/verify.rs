//! Table-driven tests for [`WebhookVerifier`].
//!
//! Each row picks a (secret, body, header_builder) triple and asserts
//! the expected outcome. The header builder is a closure so we can
//! exercise edge cases (wrong prefix, tampered hex, mixed case) without
//! duplicating fixtures.

use hmac::{Hmac, Mac};
use sha2::Sha256;

use wachat_webhook_verify::{VerifyError, WebhookVerifier};

type HmacSha256 = Hmac<Sha256>;

/// Compute the canonical `sha256=<hex>` header value for `(secret, body)`.
fn sign(secret: &[u8], body: &[u8]) -> String {
    let mut mac = HmacSha256::new_from_slice(secret).unwrap();
    mac.update(body);
    let digest = mac.finalize().into_bytes();
    format!("sha256={}", hex::encode(digest))
}

#[derive(Debug)]
struct Case {
    name: &'static str,
    secret: &'static [u8],
    body: &'static [u8],
    /// Build the header value from the canonical signature for the
    /// given `(secret, body)`. Most cases just pass it through; the
    /// tamper / format cases mutate it.
    header: fn(canonical: String) -> Option<String>,
    expected: Result<(), VerifyError>,
}

const SECRET: &[u8] = b"super-secret-meta-app-secret";
const BODY: &[u8] = br#"{"object":"whatsapp_business_account","entry":[{"id":"1","time":1700000000,"changes":[]}]}"#;

fn cases() -> Vec<Case> {
    vec![
        Case {
            name: "known-good signature passes",
            secret: SECRET,
            body: BODY,
            header: |sig| Some(sig),
            expected: Ok(()),
        },
        Case {
            name: "lowercase `sha256=` prefix accepted (Meta canonical form)",
            secret: SECRET,
            body: BODY,
            header: |sig| {
                // Already lowercase; assert that explicitly.
                assert!(sig.starts_with("sha256="));
                Some(sig)
            },
            expected: Ok(()),
        },
        Case {
            name: "uppercase `SHA256=` prefix tolerated",
            secret: SECRET,
            body: BODY,
            header: |sig| {
                let hex = sig.strip_prefix("sha256=").unwrap();
                Some(format!("SHA256={hex}"))
            },
            expected: Ok(()),
        },
        Case {
            name: "tampered body fails",
            secret: SECRET,
            // Sign with the *real* body, then pretend it was something else.
            body: BODY,
            header: |sig| Some(sig),
            // We mutate the body in the runner (see below) — keep
            // expected as mismatch; runner overrides body for this case.
            expected: Err(VerifyError::SignatureMismatch),
        },
        Case {
            name: "missing header fails",
            secret: SECRET,
            body: BODY,
            header: |_sig| None,
            expected: Err(VerifyError::MissingHeader),
        },
        Case {
            name: "wrong prefix (`sha1=`) fails",
            secret: SECRET,
            body: BODY,
            header: |sig| {
                let hex = sig.strip_prefix("sha256=").unwrap();
                Some(format!("sha1={hex}"))
            },
            expected: Err(VerifyError::BadFormat),
        },
        Case {
            name: "no prefix at all fails",
            secret: SECRET,
            body: BODY,
            header: |sig| {
                let hex = sig.strip_prefix("sha256=").unwrap().to_owned();
                Some(hex)
            },
            expected: Err(VerifyError::BadFormat),
        },
        Case {
            name: "empty hex payload fails",
            secret: SECRET,
            body: BODY,
            header: |_sig| Some("sha256=".to_owned()),
            expected: Err(VerifyError::BadFormat),
        },
        Case {
            name: "non-hex payload fails",
            secret: SECRET,
            body: BODY,
            header: |_sig| Some("sha256=ZZZZZZZZ".to_owned()),
            expected: Err(VerifyError::BadHex),
        },
        Case {
            name: "wrong-length hex (truncated) fails",
            secret: SECRET,
            body: BODY,
            header: |sig| {
                let hex = sig.strip_prefix("sha256=").unwrap();
                Some(format!("sha256={}", &hex[..hex.len() - 2]))
            },
            expected: Err(VerifyError::SignatureMismatch),
        },
        Case {
            name: "wrong secret fails",
            // Sign with a different secret in the runner.
            secret: b"WRONG-secret",
            body: BODY,
            header: |sig| Some(sig),
            expected: Err(VerifyError::SignatureMismatch),
        },
    ]
}

#[test]
fn signature_verification_matrix() {
    // The verifier we test against uses the *real* secret. Cases that
    // want a mismatch flip either the body, the secret used to sign,
    // or the header bytes.
    let verifier = WebhookVerifier::new(SECRET);

    for case in cases() {
        // The "tampered body" case is the only one where we sign with
        // one body and verify a different one.
        let (sign_body, verify_body): (&[u8], &[u8]) = if case.name == "tampered body fails" {
            (BODY, b"{\"object\":\"tampered\"}")
        } else {
            (case.body, case.body)
        };

        let canonical = sign(case.secret, sign_body);
        let header = (case.header)(canonical);

        let got = match header.as_deref() {
            Some(h) => verifier.verify(h, verify_body),
            None => Err(VerifyError::MissingHeader),
        };

        assert_eq!(
            got, case.expected,
            "case `{}`: expected {:?}, got {:?}",
            case.name, case.expected, got,
        );
    }
}

#[test]
fn debug_does_not_leak_secret() {
    let verifier = WebhookVerifier::new(b"hunter2".to_vec());
    let s = format!("{verifier:?}");
    assert!(
        !s.contains("hunter2"),
        "Debug must not print the secret: {s}"
    );
    assert!(s.contains("app_secret_len"));
}

#[test]
fn api_error_mapping_is_unauthorized() {
    use sabnode_common::ApiError;

    for err in [
        VerifyError::MissingHeader,
        VerifyError::BadFormat,
        VerifyError::BadHex,
        VerifyError::SignatureMismatch,
        VerifyError::StaleTimestamp,
    ] {
        let api: ApiError = err.into();
        assert!(matches!(api, ApiError::Unauthorized(_)), "got {api:?}");
    }
}
