//! Request DTOs.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub q: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProposalSectionInput {
    #[serde(default)]
    pub heading: String,
    #[serde(default)]
    pub body: String,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProposalAttachmentInput {
    pub url: String,
    #[serde(default)]
    pub name: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProposalInput {
    pub title: String,
    #[serde(default)]
    pub account_id: Option<String>,
    #[serde(default)]
    pub currency: Option<String>,
    #[serde(default)]
    pub total_amount: Option<f64>,
    /// ISO-8601 date/datetime.
    #[serde(default)]
    pub valid_until: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub sections: Vec<ProposalSectionInput>,
    #[serde(default)]
    pub attachments: Vec<ProposalAttachmentInput>,
    #[serde(default)]
    pub design_metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProposalInput {
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub account_id: Option<String>,
    #[serde(default)]
    pub currency: Option<String>,
    #[serde(default)]
    pub total_amount: Option<f64>,
    #[serde(default)]
    pub valid_until: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub sections: Option<Vec<ProposalSectionInput>>,
    #[serde(default)]
    pub attachments: Option<Vec<ProposalAttachmentInput>>,
    #[serde(default)]
    pub design_metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProposalResponse {
    pub id: String,
    pub entity: crate::types::CrmProposal,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteProposalResponse {
    pub deleted: bool,
}
