//! Request / response DTOs for sabsign-templates. Mirrors the TS
//! `sabsign-templates.ts` client one-for-one.

use sabsign_envelopes::types::{EnvelopeField, EnvelopeSigner, RoutingRule};
use serde::{Deserialize, Serialize};

use crate::types::{SabSignTemplate, TemplateRecipientSlot};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub q: Option<String>,
    /// `"active"` | `"archived"` | `"all"`.
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTemplateInput {
    pub name: String,
    pub doc_id: String,
    #[serde(default)]
    pub doc_url: Option<String>,
    #[serde(default)]
    pub doc_name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub routing_order: Option<String>,
    #[serde(default)]
    pub routing_rules: Option<Vec<RoutingRule>>,
    #[serde(default)]
    pub recipient_slots: Option<Vec<TemplateRecipientSlot>>,
    #[serde(default)]
    pub fields: Option<Vec<EnvelopeField>>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTemplateInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub doc_id: Option<String>,
    #[serde(default)]
    pub doc_url: Option<String>,
    #[serde(default)]
    pub doc_name: Option<String>,
    #[serde(default)]
    pub routing_order: Option<String>,
    #[serde(default)]
    pub routing_rules: Option<Vec<RoutingRule>>,
    #[serde(default)]
    pub recipient_slots: Option<Vec<TemplateRecipientSlot>>,
    #[serde(default)]
    pub fields: Option<Vec<EnvelopeField>>,
    #[serde(default)]
    pub status: Option<String>,
}

/// Instantiate-with-signers — produces a draft envelope.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstantiateInput {
    #[serde(default)]
    pub envelope_name: Option<String>,
    #[serde(default)]
    pub subject: Option<String>,
    #[serde(default)]
    pub message: Option<String>,
    /// One signer per recipient slot, keyed by `role`.
    pub signers: Vec<EnvelopeSigner>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTemplateResponse {
    pub id: String,
    pub entity: SabSignTemplate,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteTemplateResponse {
    pub deleted: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabSignTemplate>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstantiateResponse {
    pub envelope_id: String,
}
