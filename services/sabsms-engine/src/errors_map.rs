//! Provider-error normalization.
//!
//! Health scoring, analytics and the V2.6 router all key on these
//! normalized codes, never on raw provider codes. Every adapter surfaces
//! the provider's raw code (numeric string, cause keyword, or error
//! text) and `normalize_error` maps it to one of a small closed set:
//!
//! `invalid_number`, `unreachable`, `blocked_by_carrier`, `dnd`,
//! `spam_filtered`, `insufficient_provider_balance`, `rate_limited`,
//! `invalid_sender`, `template_mismatch`, `unknown`.
//!
//! `suppress = true` marks failures that are permanent properties of the
//! destination (invalid number, landline, recipient STOP) — the worker
//! and the DLR handler add those recipients to the suppression list.

use crate::types::ProviderId;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct NormalizedError {
    pub code: &'static str,
    /// Worth retrying on another attempt (or provider).
    pub retryable: bool,
    /// Permanently suppress the destination.
    pub suppress: bool,
}

const fn n(code: &'static str, retryable: bool, suppress: bool) -> NormalizedError {
    NormalizedError {
        code,
        retryable,
        suppress,
    }
}

pub const UNKNOWN: NormalizedError = n("unknown", false, false);

/// Map a raw provider error code to a normalized one.
pub fn normalize_error(provider: ProviderId, raw_code: &str) -> NormalizedError {
    let raw = raw_code.trim();
    if raw.is_empty() {
        return UNKNOWN;
    }
    let exact = match provider {
        ProviderId::Twilio => twilio(raw),
        ProviderId::Telnyx => telnyx(raw),
        ProviderId::Msg91 => msg91(raw),
        ProviderId::Gupshup => gupshup(raw),
        _ => None,
    };
    exact.unwrap_or_else(|| substring_fallback(raw))
}

fn twilio(raw: &str) -> Option<NormalizedError> {
    Some(match raw {
        // 21211: 'To' is not a valid phone number.
        "21211" => n("invalid_number", false, true),
        // 21614: 'To' is not a valid MOBILE number (landline etc.).
        "21614" => n("invalid_number", false, true),
        // 21610: attempt to message an unsubscribed (STOP) recipient —
        // the recipient opted out; semantically a do-not-disturb block.
        "21610" => n("dnd", false, true),
        // 21606/21659-style sender problems.
        "21606" | "21212" => n("invalid_sender", false, false),
        // 30003: unreachable destination handset (off / out of coverage).
        "30003" => n("unreachable", true, false),
        // 30004: message blocked by the destination / carrier.
        "30004" => n("blocked_by_carrier", false, false),
        // 30005: unknown destination handset — number likely doesn't exist.
        "30005" => n("invalid_number", false, true),
        // 30006: landline or unreachable carrier — SMS-incapable, permanent.
        "30006" => n("unreachable", false, true),
        // 30007: carrier spam filter.
        "30007" => n("spam_filtered", false, false),
        // 30008: delivery failed for unknown reasons.
        "30008" => n("unknown", false, false),
        // 20429: too many requests.
        "20429" => n("rate_limited", true, false),
        _ => return None,
    })
}

fn telnyx(raw: &str) -> Option<NormalizedError> {
    Some(match raw {
        // 40001: invalid 'to' address.
        "40001" => n("invalid_number", false, true),
        // 40002: invalid 'from' address.
        "40002" => n("invalid_sender", false, false),
        // 40300-range: carrier rejections (blocked content / recipient).
        "40300" | "40301" | "40302" | "40303" => n("blocked_by_carrier", false, false),
        // 40305: blocked as spam (per Telnyx delivery error docs; codes
        // outside the documented set intentionally fall to `unknown`).
        "40305" => n("spam_filtered", false, false),
        _ => return None,
    })
}

fn msg91(raw: &str) -> Option<NormalizedError> {
    Some(match raw {
        // DLR status codes: 9 = DND, 16 = rejected by carrier,
        // 17 = blocked number (NCPR), 28 = invalid number.
        "9" => n("dnd", false, false),
        "16" => n("blocked_by_carrier", false, false),
        "17" => n("dnd", false, false),
        "28" => n("invalid_number", false, true),
        // 2 = generic failure.
        "2" => n("unknown", false, false),
        _ => return None,
    })
}

fn gupshup(raw: &str) -> Option<NormalizedError> {
    // Gupshup surfaces DLR `cause` keywords and numeric send-error ids.
    Some(match raw.to_ascii_uppercase().as_str() {
        "ABSENT_SUBSCRIBER" | "HANDSET_BUSY" | "MEMORY_EXCEEDED" => n("unreachable", true, false),
        "DND_FAIL" | "DND_TIMEOUT" | "NCPR_FAIL" => n("dnd", false, false),
        "UNKNOWN_SUBSCRIBER" | "INVALID_NUMBER" => n("invalid_number", false, true),
        "BLOCKED" | "BLOCKED_FOR_USER" | "BARRED" => n("blocked_by_carrier", false, false),
        "SPAM" => n("spam_filtered", false, false),
        // Send-error ids: 105 invalid phone, 106 invalid mask (sender),
        // 175 insufficient credits.
        "105" => n("invalid_number", false, true),
        "106" => n("invalid_sender", false, false),
        "175" => n("insufficient_provider_balance", true, false),
        _ => return None,
    })
}

/// Last-chance textual mapping for providers (MSG91 especially) that
/// return error *messages* instead of codes.
fn substring_fallback(raw: &str) -> NormalizedError {
    let lower = raw.to_ascii_lowercase();
    if lower.contains("dnd") {
        return n("dnd", false, false);
    }
    if lower.contains("template") || lower.contains("dlt") {
        return n("template_mismatch", false, false);
    }
    if lower.contains("sender") || lower.contains("header") || lower.contains("mask") {
        return n("invalid_sender", false, false);
    }
    if lower.contains("balance") || lower.contains("credit") || lower.contains("insufficient") {
        return n("insufficient_provider_balance", true, false);
    }
    if lower.contains("rate") && lower.contains("limit") {
        return n("rate_limited", true, false);
    }
    if lower.contains("spam") {
        return n("spam_filtered", false, false);
    }
    if lower.contains("invalid") && (lower.contains("number") || lower.contains("mobile")) {
        return n("invalid_number", false, true);
    }
    UNKNOWN
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn twilio_table() {
        let cases: &[(&str, &str, bool, bool)] = &[
            ("21211", "invalid_number", false, true),
            ("21614", "invalid_number", false, true),
            ("21610", "dnd", false, true),
            ("30003", "unreachable", true, false),
            ("30004", "blocked_by_carrier", false, false),
            ("30005", "invalid_number", false, true),
            ("30006", "unreachable", false, true),
            ("30007", "spam_filtered", false, false),
            ("30008", "unknown", false, false),
            ("20429", "rate_limited", true, false),
        ];
        for (raw, code, retryable, suppress) in cases {
            let got = normalize_error(ProviderId::Twilio, raw);
            assert_eq!(got.code, *code, "twilio {raw}");
            assert_eq!(got.retryable, *retryable, "twilio {raw} retryable");
            assert_eq!(got.suppress, *suppress, "twilio {raw} suppress");
        }
    }

    #[test]
    fn telnyx_table() {
        assert_eq!(
            normalize_error(ProviderId::Telnyx, "40001").code,
            "invalid_number"
        );
        assert!(normalize_error(ProviderId::Telnyx, "40001").suppress);
        assert_eq!(
            normalize_error(ProviderId::Telnyx, "40002").code,
            "invalid_sender"
        );
        assert_eq!(
            normalize_error(ProviderId::Telnyx, "40300").code,
            "blocked_by_carrier"
        );
        // Undocumented codes stay unknown.
        assert_eq!(normalize_error(ProviderId::Telnyx, "99999").code, "unknown");
    }

    #[test]
    fn msg91_table() {
        assert_eq!(normalize_error(ProviderId::Msg91, "9").code, "dnd");
        assert_eq!(
            normalize_error(ProviderId::Msg91, "16").code,
            "blocked_by_carrier"
        );
        assert!(normalize_error(ProviderId::Msg91, "28").suppress);
        // Textual errors hit the substring fallback.
        assert_eq!(
            normalize_error(ProviderId::Msg91, "Invalid sender id").code,
            "invalid_sender"
        );
        assert_eq!(
            normalize_error(ProviderId::Msg91, "DLT template not matched").code,
            "template_mismatch"
        );
        assert_eq!(
            normalize_error(ProviderId::Msg91, "Number is in DND").code,
            "dnd"
        );
    }

    #[test]
    fn gupshup_table() {
        assert_eq!(
            normalize_error(ProviderId::Gupshup, "DND_FAIL").code,
            "dnd"
        );
        assert_eq!(
            normalize_error(ProviderId::Gupshup, "ABSENT_SUBSCRIBER").code,
            "unreachable"
        );
        assert!(normalize_error(ProviderId::Gupshup, "UNKNOWN_SUBSCRIBER").suppress);
        assert_eq!(
            normalize_error(ProviderId::Gupshup, "175").code,
            "insufficient_provider_balance"
        );
        assert_eq!(
            normalize_error(ProviderId::Gupshup, "106").code,
            "invalid_sender"
        );
    }

    #[test]
    fn unknown_and_empty_inputs() {
        assert_eq!(normalize_error(ProviderId::Twilio, "").code, "unknown");
        assert_eq!(normalize_error(ProviderId::Mock, "whatever").code, "unknown");
        assert_eq!(
            normalize_error(ProviderId::Vonage, "some-code").code,
            "unknown"
        );
    }

    #[test]
    fn substring_fallback_applies_across_providers() {
        assert_eq!(
            normalize_error(ProviderId::Gupshup, "insufficient credits in wallet").code,
            "insufficient_provider_balance"
        );
        assert_eq!(
            normalize_error(ProviderId::Msg91, "rate limit exceeded").code,
            "rate_limited"
        );
        assert_eq!(
            normalize_error(ProviderId::Msg91, "invalid mobile number").code,
            "invalid_number"
        );
    }
}
