//! On-disk + wire shape of a SabSign audit event (`esign_audit_events`).
//!
//! Matches the TS `SabSignAuditEvent` contract: string ids, ISO-8601 string
//! timestamps. `tenantId` + `seq` are internal fields (project scope +
//! deterministic chain ordering); they are harmless extras on the wire.

use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EsignAuditEvent {
    #[serde(rename = "_id", default, skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    /// Tenant (project) scope.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tenant_id: Option<String>,
    pub envelope_id: String,
    pub user_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub signer_id: Option<String>,
    pub event_type: String,
    /// ISO-8601 timestamp.
    pub ts: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ip: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub data: Option<Value>,
    /// Monotonic per-envelope sequence — drives deterministic chain ordering.
    #[serde(default)]
    pub seq: u64,
    /// SHA-256 hex digest chained off the previous event's hash.
    pub hash: String,
}
