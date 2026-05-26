//! Request / response DTOs for esign-envelopes.

use serde::{Deserialize, Serialize};

use crate::types::{
    EnvelopeField, EnvelopeSigner, EnvelopeStatus, EsignEnvelope, RoutingOrder, RoutingRule,
};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub q: Option<String>,
    /// `draft | sent | in_progress | completed | declined | voided | expired | all`
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
    pub routing_order: Option<RoutingOrder>,
    #[serde(default)]
    pub routing_rules: Vec<RoutingRule>,
    #[serde(default)]
    pub signers: Vec<EnvelopeSigner>,
    #[serde(default)]
    pub fields: Vec<EnvelopeField>,
    #[serde(default)]
    pub expires_at: Option<String>,
    #[serde(default)]
    pub reminder_days: Option<u32>,
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
    pub routing_order: Option<RoutingOrder>,
    #[serde(default)]
    pub routing_rules: Option<Vec<RoutingRule>>,
    #[serde(default)]
    pub signers: Option<Vec<EnvelopeSigner>>,
    #[serde(default)]
    pub fields: Option<Vec<EnvelopeField>>,
    #[serde(default)]
    pub expires_at: Option<String>,
    #[serde(default)]
    pub reminder_days: Option<u32>,
    #[serde(default)]
    pub status: Option<EnvelopeStatus>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateEnvelopeResponse {
    pub id: String,
    pub entity: EsignEnvelope,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteEnvelopeResponse {
    pub deleted: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<EsignEnvelope>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

/// Public sign-page input: signer fills fields, optionally provides PIN/OTP.
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
    pub kba_answers: Vec<String>,
    /// Map of fieldId → value supplied by the signer.
    #[serde(default)]
    pub field_values: Vec<FieldValuePair>,
    #[serde(default)]
    pub decline: bool,
    #[serde(default)]
    pub decline_reason: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FieldValuePair {
    pub field_id: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SignSubmissionResponse {
    pub ok: bool,
    pub envelope_status: EnvelopeStatus,
    pub next_signer_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VoidEnvelopeInput {
    #[serde(default)]
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendEnvelopeInput {
    /// If true, regenerate access tokens for each signer.
    #[serde(default)]
    pub rotate_tokens: bool,
}
