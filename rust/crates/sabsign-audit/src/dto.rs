//! DTOs for esign-audit.

use serde::{Deserialize, Serialize};

use crate::types::EsignAuditEvent;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    /// Hex-encoded envelope id; filters audit events to one envelope.
    #[serde(default)]
    pub envelope_id: Option<String>,
    #[serde(default)]
    pub event_type: Option<String>,
    #[serde(default)]
    pub limit: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<EsignAuditEvent>,
    pub chain_valid: bool,
}
