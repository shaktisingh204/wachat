//! Request DTOs.

use serde::{Deserialize, Serialize};

use crate::types::CrmContract;

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
    #[serde(default)]
    pub r#type: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateContractInput {
    #[serde(default)]
    pub contract_no: Option<String>,
    pub title: String,
    pub party_name: String,
    #[serde(default)]
    pub r#type: Option<String>,
    #[serde(default)]
    pub party_email: Option<String>,
    #[serde(default)]
    pub party_phone: Option<String>,
    #[serde(default)]
    pub signatory_name: Option<String>,
    #[serde(default)]
    pub signatory_email: Option<String>,
    #[serde(default)]
    pub scope: Option<String>,
    #[serde(default)]
    pub deliverables: Option<String>,
    #[serde(default)]
    pub currency: Option<String>,
    #[serde(default)]
    pub branch: Option<String>,
    #[serde(default)]
    pub owner_id: Option<String>,
    #[serde(default)]
    pub source_proposal_id: Option<String>,
    #[serde(default)]
    pub source_proposal_number: Option<String>,
    #[serde(default)]
    pub effective_date: Option<String>,
    #[serde(default)]
    pub expiry_date: Option<String>,
    #[serde(default)]
    pub auto_renew: Option<bool>,
    #[serde(default)]
    pub renewal_notice_days: Option<i32>,
    #[serde(default)]
    pub value: Option<f64>,
    #[serde(default)]
    pub esign_provider: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
    #[serde(default)]
    pub attachments: Vec<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateContractInput {
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub party_name: Option<String>,
    #[serde(default)]
    pub r#type: Option<String>,
    #[serde(default)]
    pub party_email: Option<String>,
    #[serde(default)]
    pub party_phone: Option<String>,
    #[serde(default)]
    pub signatory_name: Option<String>,
    #[serde(default)]
    pub signatory_email: Option<String>,
    #[serde(default)]
    pub scope: Option<String>,
    #[serde(default)]
    pub deliverables: Option<String>,
    #[serde(default)]
    pub currency: Option<String>,
    #[serde(default)]
    pub branch: Option<String>,
    #[serde(default)]
    pub owner_id: Option<String>,
    #[serde(default)]
    pub effective_date: Option<String>,
    #[serde(default)]
    pub expiry_date: Option<String>,
    #[serde(default)]
    pub auto_renew: Option<bool>,
    #[serde(default)]
    pub renewal_notice_days: Option<i32>,
    #[serde(default)]
    pub value: Option<f64>,
    #[serde(default)]
    pub esign_provider: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
    #[serde(default)]
    pub attachments: Option<Vec<String>>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateContractResponse {
    pub id: String,
    pub entity: CrmContract,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteContractResponse {
    pub deleted: bool,
}
