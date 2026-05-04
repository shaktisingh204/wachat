//! E.164 normalization.
//!
//! ## Ported TS rules
//! From `src/app/actions/contact.actions.ts`:
//! ```text
//! // Sanitize and combine phone number parts
//! const waId = `${countryCode.replace(/\D/g, '')}${phone.replace(/\D/g, '')}`;
//! ```
//! and the bulk-import path:
//! ```text
//! const waId = contactRow.phone.replace(/\D/g, '');
//! ```
//!
//! Behaviour we preserve:
//! 1. Strip every non-digit character (spaces, dashes, parens, dots, the
//!    leading `+`, NBSP, etc.) — the TS regex `/\D/` is exactly this.
//! 2. If the resulting digit-string is empty → `Empty`.
//! 3. If the input had a leading `+` or `00` international prefix, treat
//!    the digits as already-international. Otherwise, when a
//!    `default_region` is supplied (e.g. `Some("IN")`) and the digits
//!    don't already start with that country code, prepend it.
//! 4. Validate length is between 8 and 15 digits inclusive (E.164 §3.4).
//! 5. Return canonical `+CCNNNNNNNN` (we always emit the `+`, unlike the
//!    TS `waId` which is bare digits — Rust callers can `.trim_start_matches('+')`
//!    when they need the legacy `waId` shape).

use crate::dialing::country_code_for_region;
use crate::error::PhoneError;

/// Maximum length of an E.164 number (subscriber + country code).
const E164_MAX_DIGITS: usize = 15;
/// Practical minimum (ITU recommends ≥ 8 incl. country code).
const E164_MIN_DIGITS: usize = 8;

/// Normalize an arbitrary user-supplied phone string into canonical E.164.
///
/// * `input` — the raw user input (may contain `+`, spaces, dashes, parens,
///   country names, etc. — only the digits matter, mirroring the TS regex).
/// * `default_region` — ISO-3166 alpha-2 region whose calling code should
///   be prepended when the input has no international prefix. Pass `None`
///   to require an explicit country code.
///
/// Returns the canonical `+CCNNNNNNNN` form on success.
///
/// # Errors
/// See [`PhoneError`] for the full set of failure modes.
pub fn normalize_e164(input: &str, default_region: Option<&str>) -> Result<String, PhoneError> {
    if input.trim().is_empty() {
        return Err(PhoneError::Empty);
    }

    // Detect "international" intent BEFORE stripping. Two well-known
    // markers: a leading `+` (after optional whitespace) or a leading
    // `00` (the European IDD, used widely outside North America).
    let trimmed = input.trim_start();
    let has_intl_prefix = trimmed.starts_with('+') || trimmed.starts_with("00");

    // Strip every non-digit (TS: `phone.replace(/\D/g, '')`).
    let mut digits = String::with_capacity(input.len());
    for ch in input.chars() {
        if ch.is_ascii_digit() {
            digits.push(ch);
        } else if !is_allowed_separator(ch) {
            // The TS regex is `\D` which matches *anything* non-digit
            // silently — but for a typed Rust API we reject obvious
            // garbage like letters so callers get a clear error instead
            // of a silently-mangled number.
            return Err(PhoneError::InvalidChars);
        }
    }

    if digits.is_empty() {
        return Err(PhoneError::Empty);
    }

    // If we saw `00…`, drop the leading two zeros — they're the IDD, not
    // part of the country code.
    if has_intl_prefix && trimmed.starts_with("00") && digits.starts_with("00") {
        digits.drain(..2);
    }

    // Decide whether to prepend a default region's code.
    let final_digits = if has_intl_prefix {
        digits
    } else {
        match default_region {
            Some(region) => {
                let cc = country_code_for_region(region).ok_or(PhoneError::UnknownCountryCode)?;
                let cc_str = cc.to_string();
                // Don't double-prepend: if the user typed
                // "9198765..." with the IN code already present and we
                // were asked to default to IN, leave it alone. We only
                // detect this for the *exact* code prefix to avoid
                // false positives (e.g. US "1xxx" vs Canadian).
                if digits.starts_with(&cc_str) && digits.len() > cc_str.len() {
                    digits
                } else {
                    let mut out = String::with_capacity(cc_str.len() + digits.len());
                    out.push_str(&cc_str);
                    out.push_str(&digits);
                    out
                }
            }
            None => return Err(PhoneError::NoCountryCode),
        }
    };

    // Length validation per E.164.
    if final_digits.len() < E164_MIN_DIGITS {
        return Err(PhoneError::TooShort);
    }
    if final_digits.len() > E164_MAX_DIGITS {
        return Err(PhoneError::TooLong);
    }

    let mut out = String::with_capacity(final_digits.len() + 1);
    out.push('+');
    out.push_str(&final_digits);
    Ok(out)
}

/// Characters that are silently dropped during normalization. Anything
/// outside this set (and outside ASCII digits) is rejected as
/// `InvalidChars` — slightly stricter than the TS regex on purpose.
fn is_allowed_separator(ch: char) -> bool {
    matches!(
        ch,
        ' ' | '\t'
            | '-'
            | '('
            | ')'
            | '.'
            | '+'
            | '/'
            | '\u{00A0}' // NBSP
            | '\u{2009}' // thin space
            | '\u{200B}' // zero-width space
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strips_separators_and_keeps_country_code() {
        assert_eq!(
            normalize_e164("+91 98765-43210", None).unwrap(),
            "+919876543210"
        );
    }

    #[test]
    fn prepends_default_region_when_missing_cc() {
        assert_eq!(
            normalize_e164("9876543210", Some("IN")).unwrap(),
            "+919876543210"
        );
    }

    #[test]
    fn double_zero_is_treated_as_idd() {
        assert_eq!(
            normalize_e164("0044 20 7946 0958", None).unwrap(),
            "+442079460958"
        );
    }

    #[test]
    fn rejects_letters() {
        assert!(matches!(
            normalize_e164("1800-CALLME", None),
            Err(PhoneError::InvalidChars)
        ));
    }

    #[test]
    fn empty_input_rejected() {
        assert_eq!(normalize_e164("", None), Err(PhoneError::Empty));
        assert_eq!(normalize_e164("   ", None), Err(PhoneError::Empty));
    }

    #[test]
    fn missing_cc_without_region_rejected() {
        assert_eq!(
            normalize_e164("9876543210", None),
            Err(PhoneError::NoCountryCode)
        );
    }
}
