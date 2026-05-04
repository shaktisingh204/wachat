//! Meta Graph API error envelope.
//!
//! Returned non-2xx (and occasionally embedded in 200-OK bodies as
//! `{ "error": ... }`) from every WhatsApp Cloud / Graph endpoint.
//!
//! Source-of-truth in TS: `getErrorMessage({ response: { data: responseData } })`
//! across `template.actions.ts` / `whatsapp.actions.ts` consistently reads
//! `data.error.message`, `data.error.code`, `data.error.error_subcode`,
//! `data.error.error_data`, `data.error.fbtrace_id`.

use serde::{Deserialize, Serialize};

/// The `error` object Meta returns. Most fields are optional in practice —
/// older endpoints sometimes return only `message`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct MetaApiError {
    pub message: String,
    pub r#type: Option<String>,
    pub code: Option<i64>,
    pub error_subcode: Option<i64>,
    pub fbtrace_id: Option<String>,
    /// Free-form blob — varies per error class (e.g. `details`, `messaging_product`).
    /// Keeping as `Value` because typing every variant adds churn for no value here.
    pub error_data: Option<serde_json::Value>,
}

/// Wrapper used when the body is exactly `{ "error": { ... } }`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetaApiErrorEnvelope {
    pub error: MetaApiError,
}
