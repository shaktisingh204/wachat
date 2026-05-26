//! Read-only DTO for field-level aggregation responses.

use serde::{Deserialize, Serialize};

pub const VALID_FIELD_TYPES: &[&str] = &[
    "signature",
    "initials",
    "date",
    "text",
    "checkbox",
    "dropdown",
];

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FieldUsageBucket {
    pub field_type: String,
    pub total: u64,
    pub filled: u64,
    pub unfilled: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct EnvelopeFieldSummary {
    pub envelope_id: String,
    pub envelope_name: String,
    pub status: String,
    pub total_fields: u64,
    pub filled_fields: u64,
}
