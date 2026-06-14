//! On-disk + wire shape of a SabSign envelope (`esign_envelopes`).
//!
//! Mirrors the TS `SabSignEnvelopeDoc` contract exactly — string ids,
//! ISO-8601 string timestamps, camelCase keys — so no `{$oid}`/`{$date}`
//! extended-JSON wrappers leak to the browser. `tenantId` is an internal
//! project-scope field (harmless extra on the wire).

use serde::{Deserialize, Serialize};

pub const VALID_STATUSES: &[&str] = &[
    "draft",
    "sent",
    "in_progress",
    "completed",
    "declined",
    "voided",
    "expired",
];

pub const VALID_ROUTING_ORDERS: &[&str] = &["sequential", "parallel", "conditional"];

pub const VALID_AUTH_METHODS: &[&str] = &["email", "sms_otp", "kba", "pin"];

/// Field-type catalog — the full twelve.
pub const VALID_FIELD_TYPES: &[&str] = &[
    "signature", "initials", "date", "text", "number", "checkbox", "radio",
    "dropdown", "image", "file", "stamp", "phone",
];

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct KbaQuestion {
    pub question: String,
    pub answer_hash: String,
}

/// Conditional-logic rule on a field: when the referenced field's value
/// satisfies `(op, value)`, apply `action` (`show` | `hide` | `require`) to
/// the field that owns this condition. Stored verbatim and evaluated in the
/// signer portal.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FieldCondition {
    pub when_field_id: String,
    /// `equals` | `not_equals` | `contains` | `truthy` | `gt` | `lt`.
    pub op: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub value: Option<String>,
    /// `show` | `hide` | `require`.
    pub action: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct EnvelopeField {
    pub id: String,
    pub recipient_role: String,
    pub field_type: String,
    pub page: u32,
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_value: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub value: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub options: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub required: Option<bool>,
    /// Conditional show/hide/require rules (evaluated client-side).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub conditions: Option<Vec<FieldCondition>>,
    /// Optional formula expression for `formula`-type fields (e.g.
    /// `sum:fieldA,fieldB` or `concat:fieldA,fieldB`) — evaluated client-side.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub formula: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub filled_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct EnvelopeSigner {
    pub id: String,
    pub role: String,
    pub name: String,
    pub email: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub phone: Option<String>,
    pub auth_method: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub kba_questions: Option<Vec<KbaQuestion>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pin_hash: Option<String>,
    pub order: i32,
    pub status: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub access_token: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notified_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub viewed_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub declined_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub decline_reason: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ip_address: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub user_agent: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RoutingRule {
    pub field_id: String,
    pub op: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub value: Option<String>,
    pub next_signer_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SabSignEnvelope {
    #[serde(rename = "_id")]
    pub id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub user_id: Option<String>,
    /// Tenant (project) scope.
    pub tenant_id: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subject: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    pub doc_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub doc_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub doc_name: Option<String>,
    pub status: String,
    pub routing_order: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub routing_rules: Option<Vec<RoutingRule>>,
    #[serde(default)]
    pub signers: Vec<EnvelopeSigner>,
    #[serde(default)]
    pub fields: Vec<EnvelopeField>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reminder_days: Option<i32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub signed_doc_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub audit_trail_pdf_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bulk_batch_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub template_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub in_person: Option<bool>,
    /// Reason captured when an envelope is voided (internal; surfaced via audit).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub void_reason: Option<String>,
    pub created_at: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
}

impl SabSignEnvelope {
    /// Strip secrets (`accessToken`, `pinHash`, KBA answer hashes) before the
    /// envelope is exposed on a public (signer-facing) endpoint.
    pub fn sanitized_for_public(mut self) -> Self {
        for s in &mut self.signers {
            s.access_token = None;
            s.pin_hash = None;
            if let Some(qs) = s.kba_questions.as_mut() {
                for q in qs {
                    q.answer_hash = String::new();
                }
            }
        }
        self
    }
}
