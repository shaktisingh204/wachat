//! Request/response DTOs for the SabSign envelopes API.
//!
//! Field names mirror the TS clients (`sabsign-envelopes.ts`) one-for-one.

use serde::{Deserialize, Serialize};

use crate::types::{EnvelopeField, EnvelopeSigner, RoutingRule, SabSignEnvelope};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub q: Option<String>,
    /// One of `VALID_STATUSES`, or `"all"`.
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub template_id: Option<String>,
    #[serde(default)]
    pub bulk_batch_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateEnvelopeInput {
    pub name: String,
    pub doc_id: String,
    #[serde(default)]
    pub doc_url: Option<String>,
    #[serde(default)]
    pub doc_name: Option<String>,
    #[serde(default)]
    pub subject: Option<String>,
    #[serde(default)]
    pub message: Option<String>,
    #[serde(default)]
    pub routing_order: Option<String>,
    #[serde(default)]
    pub routing_rules: Option<Vec<RoutingRule>>,
    #[serde(default)]
    pub signers: Option<Vec<EnvelopeSigner>>,
    #[serde(default)]
    pub fields: Option<Vec<EnvelopeField>>,
    #[serde(default)]
    pub expires_at: Option<String>,
    #[serde(default)]
    pub reminder_days: Option<i32>,
    #[serde(default)]
    pub in_person: Option<bool>,
    #[serde(default)]
    pub template_id: Option<String>,
    #[serde(default)]
    pub bulk_batch_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateEnvelopeInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub subject: Option<String>,
    #[serde(default)]
    pub message: Option<String>,
    #[serde(default)]
    pub routing_order: Option<String>,
    #[serde(default)]
    pub routing_rules: Option<Vec<RoutingRule>>,
    #[serde(default)]
    pub signers: Option<Vec<EnvelopeSigner>>,
    #[serde(default)]
    pub fields: Option<Vec<EnvelopeField>>,
    #[serde(default)]
    pub expires_at: Option<String>,
    #[serde(default)]
    pub reminder_days: Option<i32>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendBody {
    #[serde(default)]
    pub rotate_tokens: bool,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VoidBody {
    #[serde(default)]
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FieldValueInput {
    pub field_id: String,
    pub value: String,
}

/// Public sign-page submission. The signer is an external party
/// authenticated by `(signerId, accessToken)` rather than a session.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SignSubmissionInput {
    pub signer_id: String,
    pub access_token: String,
    #[serde(default)]
    pub pin: Option<String>,
    #[serde(default)]
    pub otp: Option<String>,
    #[serde(default)]
    pub kba_answers: Option<Vec<String>>,
    #[serde(default)]
    pub field_values: Option<Vec<FieldValueInput>>,
    #[serde(default)]
    pub decline: Option<bool>,
    #[serde(default)]
    pub decline_reason: Option<String>,
    #[serde(default)]
    pub ip: Option<String>,
    #[serde(default)]
    pub user_agent: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SignViewQuery {
    pub signer_id: String,
    pub token: String,
}

// ── Responses ────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabSignEnvelope>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateResponse {
    pub id: String,
    pub entity: SabSignEnvelope,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteResponse {
    pub deleted: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SignSubmissionResponse {
    pub ok: bool,
    pub envelope_status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_signer_id: Option<String>,
}

/// Sanitized, signer-scoped view returned by the public sign endpoint.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SignViewResponse {
    pub envelope: SabSignEnvelope,
    pub signer_id: String,
}
