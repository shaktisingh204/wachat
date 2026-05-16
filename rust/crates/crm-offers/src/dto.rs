//! Request DTOs.

use serde::{Deserialize, Serialize};

use crate::types::CrmOffer;

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
    pub candidate_id: Option<String>,
    #[serde(default)]
    pub job_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateOfferInput {
    pub candidate_id: String,
    #[serde(default)]
    pub candidate_name: Option<String>,
    #[serde(default)]
    pub job_id: Option<String>,
    #[serde(default)]
    pub job_title: Option<String>,
    #[serde(default)]
    pub offer_letter_url: Option<String>,
    pub salary_amount: f64,
    #[serde(default)]
    pub salary_currency: Option<String>,
    #[serde(default)]
    pub salary_period: Option<String>,
    #[serde(default)]
    pub bonus: Option<f64>,
    #[serde(default)]
    pub equity: Option<String>,
    #[serde(default)]
    pub benefits: Vec<String>,
    #[serde(default)]
    pub joining_date: Option<String>,
    #[serde(default)]
    pub expires_at: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
    #[serde(default)]
    pub approver_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateOfferInput {
    #[serde(default)]
    pub candidate_name: Option<String>,
    #[serde(default)]
    pub job_id: Option<String>,
    #[serde(default)]
    pub job_title: Option<String>,
    #[serde(default)]
    pub offer_letter_url: Option<String>,
    #[serde(default)]
    pub salary_amount: Option<f64>,
    #[serde(default)]
    pub salary_currency: Option<String>,
    #[serde(default)]
    pub salary_period: Option<String>,
    #[serde(default)]
    pub bonus: Option<f64>,
    #[serde(default)]
    pub equity: Option<String>,
    #[serde(default)]
    pub benefits: Option<Vec<String>>,
    #[serde(default)]
    pub joining_date: Option<String>,
    #[serde(default)]
    pub expires_at: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub response_notes: Option<String>,
    #[serde(default)]
    pub approver_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateOfferResponse {
    pub id: String,
    pub entity: CrmOffer,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteOfferResponse {
    pub deleted: bool,
}
