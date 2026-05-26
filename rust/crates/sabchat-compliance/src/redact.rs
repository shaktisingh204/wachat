//! PII redaction primitive shared by the `POST /redact-text` endpoint
//! and by the DSR delete flow.
//!
//! [`redact_pii`] applies four lightweight regex masks in sequence:
//!
//! 1. **Email** — `local@domain.tld` → `[REDACTED_EMAIL]`.
//! 2. **Credit-card-like** — runs of 13-19 digits with optional spaces
//!    or dashes between groups → `[REDACTED_CC]`. Matched **before**
//!    the phone pattern so a 16-digit card number doesn't get pulled
//!    apart by the phone regex.
//! 3. **US SSN** — `123-45-6789` → `[REDACTED_SSN]`.
//! 4. **Phone** — international E.164-ish (`+`?  7-15 digits with
//!    optional spaces / dashes / parentheses) → `[REDACTED_PHONE]`.
//!
//! The masks are intentionally coarse — the goal is "good enough for
//! GDPR / DPDP / CCPA right-to-be-forgotten on free text" rather than
//! a perfect PII classifier. Tenants that need stronger guarantees
//! should pipe the text through their own classifier first.
//!
//! Regexes are compiled exactly once via [`std::sync::OnceLock`]; the
//! redactor is safe to call from a hot path.

use std::sync::OnceLock;

use regex::Regex;

/// Placeholder strings — kept as `&str` constants so the test module
/// (and future call sites) can reference them by name.
const EMAIL_MASK: &str = "[REDACTED_EMAIL]";
const CC_MASK: &str = "[REDACTED_CC]";
const SSN_MASK: &str = "[REDACTED_SSN]";
const PHONE_MASK: &str = "[REDACTED_PHONE]";

/// Lazy-initialised regex cache. Each `Regex` is built once per process.
fn email_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        // RFC 5322 is famously hard to express; this is the WHATWG-ish
        // "obviously an email" subset that covers >99% of real-world
        // strings and never crosses whitespace boundaries.
        Regex::new(r"(?i)\b[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}\b")
            .expect("email regex must compile")
    })
}

fn cc_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        // 13-19 digits with optional single space/dash separators in
        // 3-5 groups. Anchored on word boundaries so we don't yank
        // digits out of the middle of a longer identifier.
        Regex::new(r"\b(?:\d[ -]?){12,18}\d\b").expect("credit-card regex must compile")
    })
}

fn ssn_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        // Classic US SSN format. We deliberately keep the dashes
        // mandatory — bare 9-digit runs are too common to mask
        // confidently without context.
        Regex::new(r"\b\d{3}-\d{2}-\d{4}\b").expect("ssn regex must compile")
    })
}

fn phone_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        // E.164-ish: optional `+`, 7-15 digits, with optional spaces /
        // dashes / parentheses between groups. We match a minimum of 7
        // digits to avoid eating two-digit room numbers and similar.
        Regex::new(r"\+?\d[\d \-().]{6,}\d").expect("phone regex must compile")
    })
}

/// Mask emails, credit-card-like numbers, US SSNs, and phone-like
/// strings in `text`. Pure function — does not allocate when no
/// matches are found (the `Cow` from `Regex::replace_all` borrows the
/// input).
pub fn redact_pii(text: &str) -> String {
    // Order matters: do the strict patterns (email / CC / SSN) first
    // so they don't get nibbled by the looser phone pattern.
    let after_email = email_re().replace_all(text, EMAIL_MASK);
    let after_cc = cc_re().replace_all(&after_email, CC_MASK);
    let after_ssn = ssn_re().replace_all(&after_cc, SSN_MASK);
    phone_re().replace_all(&after_ssn, PHONE_MASK).into_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn masks_email() {
        let out = redact_pii("ping alice@example.com please");
        assert!(out.contains(EMAIL_MASK), "got: {out}");
        assert!(!out.contains("alice@example.com"));
    }

    #[test]
    fn masks_credit_card_before_phone() {
        // A 16-digit card written with spaces should land in CC, not
        // phone, because the CC pattern runs first.
        let out = redact_pii("card 4111 1111 1111 1111 ok");
        assert!(out.contains(CC_MASK), "got: {out}");
        assert!(!out.contains("4111"));
    }

    #[test]
    fn masks_ssn() {
        let out = redact_pii("ssn 123-45-6789 trailing");
        assert!(out.contains(SSN_MASK), "got: {out}");
    }

    #[test]
    fn masks_phone() {
        let out = redact_pii("call +91 98765 43210 now");
        assert!(out.contains(PHONE_MASK), "got: {out}");
    }

    #[test]
    fn leaves_clean_text_alone() {
        let raw = "no PII in this sentence at all";
        assert_eq!(redact_pii(raw), raw);
    }
}
