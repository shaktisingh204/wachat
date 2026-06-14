//! On-disk + wire shape of a SabSign template (`esign_templates`).
//!
//! Reuses the envelope field/rule types so a template's pre-placed fields are
//! byte-for-byte compatible with the envelopes they instantiate. Matches the
//! TS `SabSignTemplateDoc` contract (string ids + ISO string timestamps).

use sabsign_envelopes::types::{EnvelopeField, RoutingRule};
use serde::{Deserialize, Serialize};

pub const VALID_STATUSES: &[&str] = &["active", "archived"];

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TemplateRecipientSlot {
    pub role: String,
    pub label: String,
    pub order: i32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub auth_method: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SabSignTemplate {
    #[serde(rename = "_id")]
    pub id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub user_id: Option<String>,
    /// Tenant (project) scope.
    pub tenant_id: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub doc_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub doc_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub doc_name: Option<String>,
    pub routing_order: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub routing_rules: Option<Vec<RoutingRule>>,
    #[serde(default)]
    pub recipient_slots: Vec<TemplateRecipientSlot>,
    #[serde(default)]
    pub fields: Vec<EnvelopeField>,
    /// `"active"` | `"archived"`.
    pub status: String,
    pub created_at: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
}
