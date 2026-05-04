//! Errors emitted by the substitution engine.
//!
//! Substitution is pure, so the error surface is small: a placeholder we
//! couldn't fill, an empty value (Meta rejects these — see TS
//! `send-template.actions.ts`'s zero-width-space fallback), or a
//! syntactically invalid placeholder name.

use sabnode_common::ApiError;
use thiserror::Error;

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum SubstituteError {
    /// Template referenced `{{N}}` but the caller didn't supply position `N`.
    #[error(
        "missing positional variable {{{{{0}}}}} — template requires it but it was not provided"
    )]
    MissingPositional(u16),

    /// Template referenced `{{name}}` but the caller didn't supply that key.
    #[error("missing named variable {{{{{0}}}}} — template requires it but it was not provided")]
    MissingNamed(String),

    /// Caller supplied an empty string for a placeholder. Meta's send API
    /// rejects empty params with error #100; we surface it before the wire.
    #[error(
        "empty value for placeholder {{{{{placeholder}}}}} — Meta rejects empty template parameters"
    )]
    EmptyValue { placeholder: String },

    /// A `{{...}}` token that didn't parse as a positional or named slot.
    /// Reserved for future stricter checks (the parser regex already filters
    /// most malformed cases).
    #[error("invalid placeholder syntax: {0}")]
    InvalidPlaceholder(String),
}

impl From<SubstituteError> for ApiError {
    fn from(value: SubstituteError) -> Self {
        // All substitution failures are caller-provided data shape problems
        // — they're 4xx, not 5xx. Map to `Validation` (which renders as
        // `VALIDATION_ERROR` / 422 in the API envelope).
        ApiError::Validation(value.to_string())
    }
}
