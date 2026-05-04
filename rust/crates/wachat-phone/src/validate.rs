//! Cheap structural validation and decomposition of an E.164 string.
//!
//! These helpers do *not* re-do the heavy normalization in
//! [`crate::normalize`]; they assume input is already (or claims to be) a
//! canonical `+CCNNN…` string and answer two questions: "is it shaped like
//! E.164?" and "what are its parts?".

use serde::{Deserialize, Serialize};

use crate::error::PhoneError;

/// Decomposed view of an E.164 number.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PhoneParts {
    /// Numeric ITU calling code (e.g. `91` for India).
    pub country_code: u16,
    /// Subscriber digits with the country code stripped off.
    pub national_number: String,
    /// ISO-3166 alpha-2 region, when we can infer it unambiguously from
    /// the calling code. `None` for ambiguous codes (e.g. `1` is shared
    /// by US/CA and the NANP).
    pub region: Option<String>,
}

/// Returns true iff `s` is a syntactically-valid E.164 string:
/// leading `+`, then 8–15 ASCII digits, no separators.
pub fn is_valid_e164(s: &str) -> bool {
    let bytes = s.as_bytes();
    if bytes.first() != Some(&b'+') {
        return false;
    }
    let digits = &bytes[1..];
    if digits.len() < 8 || digits.len() > 15 {
        return false;
    }
    digits.iter().all(|b| b.is_ascii_digit())
}

/// Decompose an E.164 string into country code + national number.
///
/// The country-code split uses a small longest-match table covering the
/// regions in [`crate::dialing::country_code_for_region`] plus a couple
/// of common 3-digit codes. For codes outside that table we fall back to
/// "first digit is the country code", which is correct for NANP `+1` and
/// degrades gracefully (the national number is still recoverable since
/// the original string is preserved by the caller).
pub fn parts(s: &str) -> Result<PhoneParts, PhoneError> {
    if !is_valid_e164(s) {
        // Map the most likely cause; callers that want detail should run
        // `normalize_e164` first.
        return Err(if s.is_empty() {
            PhoneError::Empty
        } else if !s.starts_with('+') {
            PhoneError::NoCountryCode
        } else if s.len() < 9 {
            PhoneError::TooShort
        } else if s.len() > 16 {
            PhoneError::TooLong
        } else {
            PhoneError::InvalidChars
        });
    }

    let digits = &s[1..];

    // Longest-prefix match against known codes. Order: 3-digit, then
    // 2-digit, then 1-digit. Covers every region in `dialing.rs`.
    const KNOWN: &[(&str, u16, Option<&str>)] = &[
        ("971", 971, Some("AE")),
        ("234", 234, Some("NG")),
        ("91", 91, Some("IN")),
        ("44", 44, Some("GB")),
        ("61", 61, Some("AU")),
        ("65", 65, Some("SG")),
        ("55", 55, Some("BR")),
        ("52", 52, Some("MX")),
        ("27", 27, Some("ZA")),
        ("1", 1, None), // NANP — ambiguous (US/CA/etc.)
    ];

    for (prefix, code, region) in KNOWN {
        if digits.starts_with(prefix) && digits.len() > prefix.len() {
            return Ok(PhoneParts {
                country_code: *code,
                national_number: digits[prefix.len()..].to_string(),
                region: region.map(|r| r.to_string()),
            });
        }
    }

    // Unknown code — best-effort: take the first digit as the country
    // code. This keeps the function total without lying about the region.
    let cc_char = digits
        .chars()
        .next()
        .ok_or(PhoneError::UnknownCountryCode)?;
    let country_code = cc_char.to_digit(10).ok_or(PhoneError::InvalidChars)? as u16;
    Ok(PhoneParts {
        country_code,
        national_number: digits[1..].to_string(),
        region: None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn valid_e164_strings() {
        assert!(is_valid_e164("+919876543210"));
        assert!(is_valid_e164("+12025550100"));
        assert!(is_valid_e164("+442079460958"));
    }

    #[test]
    fn invalid_e164_strings() {
        assert!(!is_valid_e164("919876543210")); // missing +
        assert!(!is_valid_e164("+91 9876543210")); // space
        assert!(!is_valid_e164("+91")); // too short
        assert!(!is_valid_e164("+1234567890123456")); // too long
        assert!(!is_valid_e164(""));
    }

    #[test]
    fn parts_split_india() {
        let p = parts("+919876543210").unwrap();
        assert_eq!(p.country_code, 91);
        assert_eq!(p.national_number, "9876543210");
        assert_eq!(p.region.as_deref(), Some("IN"));
    }

    #[test]
    fn parts_split_nanp() {
        let p = parts("+12025550100").unwrap();
        assert_eq!(p.country_code, 1);
        assert_eq!(p.national_number, "2025550100");
        assert_eq!(p.region, None);
    }
}
