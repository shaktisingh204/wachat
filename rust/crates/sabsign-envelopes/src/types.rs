//! On-disk shape of an `esign_envelopes` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

/// Top-level envelope status. Transitions:
///   draft → sent → in_progress → completed
///                              ↘ declined
///                              ↘ voided
///                              ↘ expired
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum EnvelopeStatus {
    Draft,
    Sent,
    InProgress,
    Completed,
    Declined,
    Voided,
    Expired,
}

impl Default for EnvelopeStatus {
    fn default() -> Self {
        Self::Draft
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum RoutingOrder {
    Sequential,
    Parallel,
    Conditional,
}

impl Default for RoutingOrder {
    fn default() -> Self {
        Self::Sequential
    }
}

/// Per-recipient authentication tier.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum AuthMethod {
    Email,
    SmsOtp,
    Kba,
    Pin,
}

impl Default for AuthMethod {
    fn default() -> Self {
        Self::Email
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct KbaQuestion {
    pub question: String,
    /// SHA-256 of normalised answer (lowercased, trimmed).
    pub answer_hash: String,
}

/// A single field placed on the document by the sender.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct EnvelopeField {
    pub id: String,
    pub recipient_role: String,
    pub field_type: String, // signature | initials | date | text | checkbox | dropdown
    pub page: u32,
    pub x: f32,
    pub y: f32,
    pub w: f32,
    pub h: f32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_value: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub value: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub options: Vec<String>,
    #[serde(default)]
    pub required: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub filled_at: Option<BsonDateTime>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum SignerStatus {
    Pending,
    Notified,
    Viewed,
    Completed,
    Declined,
}

impl Default for SignerStatus {
    fn default() -> Self {
        Self::Pending
    }
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
    pub auth_method: AuthMethod,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub kba_questions: Vec<KbaQuestion>,
    /// SHA-256 of PIN for in-person/kiosk signing.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pin_hash: Option<String>,
    /// 1-based; meaningful when `routingOrder = sequential`.
    pub order: u32,
    pub status: SignerStatus,
    /// Short-lived URL token for the public sign page.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub access_token: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notified_at: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub viewed_at: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub declined_at: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub decline_reason: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ip_address: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub user_agent: Option<String>,
}

/// Conditional routing rule. Evaluated against fields already filled.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RoutingRule {
    pub field_id: String,
    /// `equals | not_equals | contains | gt | lt | truthy`
    pub op: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub value: Option<String>,
    /// Signer id to route to when the rule matches.
    pub next_signer_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct EsignEnvelope {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub project_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tenant_id: Option<ObjectId>,

    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subject: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,

    /// SabFiles document id of the source PDF.
    pub doc_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub doc_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub doc_name: Option<String>,

    pub status: EnvelopeStatus,
    pub routing_order: RoutingOrder,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub routing_rules: Vec<RoutingRule>,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub signers: Vec<EnvelopeSigner>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub fields: Vec<EnvelopeField>,

    /// If set, envelope auto-expires at this instant.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<BsonDateTime>,
    /// Reminder cadence in days, 0 disables.
    #[serde(default)]
    pub reminder_days: u32,

    /// Set when `status = completed`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<BsonDateTime>,
    /// SabFiles id of the signed/flattened PDF.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub signed_doc_id: Option<String>,
    /// SabFiles id of the audit trail certificate PDF.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub audit_trail_pdf_id: Option<String>,
    /// Bulk-send batch id, when this envelope was spawned from a CSV bulk send.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bulk_batch_id: Option<String>,
    /// Template id, when spawned from a template.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub template_id: Option<String>,
    /// In-person/kiosk mode flag.
    #[serde(default)]
    pub in_person: bool,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
    #[serde(rename = "createdBy", default, skip_serializing_if = "Option::is_none")]
    pub created_by: Option<ObjectId>,
}
