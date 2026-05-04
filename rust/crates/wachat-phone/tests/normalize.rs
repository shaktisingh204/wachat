//! Golden tests for `normalize_e164`. These mirror the test cases the
//! TS `contact.actions.ts` is implicitly exercising — the strings here
//! came from real-world support tickets.

use wachat_phone::{PhoneError, normalize_e164};

#[test]
fn india_with_separators() {
    assert_eq!(
        normalize_e164("+91 98765-43210", None).unwrap(),
        "+919876543210"
    );
}

#[test]
fn india_default_region_no_cc() {
    assert_eq!(
        normalize_e164("9876543210", Some("IN")).unwrap(),
        "+919876543210"
    );
}

#[test]
fn india_default_region_already_has_cc() {
    // User typed the country code in but no leading +; default region
    // should not double-prepend.
    assert_eq!(
        normalize_e164("919876543210", Some("IN")).unwrap(),
        "+919876543210"
    );
}

#[test]
fn us_e164_with_parens_and_dashes() {
    assert_eq!(
        normalize_e164("+1 (202) 555-0100", None).unwrap(),
        "+12025550100"
    );
}

#[test]
fn double_zero_idd_uk() {
    assert_eq!(
        normalize_e164("0044 20 7946 0958", None).unwrap(),
        "+442079460958"
    );
}

#[test]
fn rejects_too_short() {
    assert_eq!(normalize_e164("+1234567", None), Err(PhoneError::TooShort));
}

#[test]
fn rejects_too_long() {
    assert_eq!(
        normalize_e164("+1234567890123456", None),
        Err(PhoneError::TooLong)
    );
}

#[test]
fn rejects_letters() {
    assert!(matches!(
        normalize_e164("+1-800-CALL-ME-NOW", None),
        Err(PhoneError::InvalidChars)
    ));
}

#[test]
fn rejects_empty() {
    assert_eq!(normalize_e164("", None), Err(PhoneError::Empty));
    assert_eq!(normalize_e164("    ", None), Err(PhoneError::Empty));
}

#[test]
fn rejects_no_cc_no_region() {
    assert_eq!(
        normalize_e164("9876543210", None),
        Err(PhoneError::NoCountryCode)
    );
}

#[test]
fn unknown_default_region() {
    assert_eq!(
        normalize_e164("9876543210", Some("ZZ")),
        Err(PhoneError::UnknownCountryCode)
    );
}
