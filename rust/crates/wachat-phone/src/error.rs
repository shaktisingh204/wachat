//! Error type for phone-number parsing/validation. Maps cleanly onto
//! `ApiError::BadRequest` so HTTP handlers can `?`-propagate.

use sabnode_common::ApiError;
use thiserror::Error;

/// Failure modes when normalizing or validating a phone number.
///
/// Each variant carries no payload — callers usually want to log the raw
/// input themselves (it's PII; we don't want it ending up in `Display`).
#[derive(Debug, Error, PartialEq, Eq, Clone, Copy)]
pub enum PhoneError {
    #[error("phone number is empty")]
    Empty,

    #[error("phone number contains invalid characters")]
    InvalidChars,

    #[error("phone number is shorter than the E.164 minimum (8 digits)")]
    TooShort,

    #[error("phone number is longer than the E.164 maximum (15 digits)")]
    TooLong,

    #[error("phone number is missing a country code and no default region was supplied")]
    NoCountryCode,

    #[error("phone number country code is not recognized")]
    UnknownCountryCode,
}

impl From<PhoneError> for ApiError {
    fn from(e: PhoneError) -> Self {
        // All phone-validation failures are user-input problems → 400.
        ApiError::BadRequest(e.to_string())
    }
}
