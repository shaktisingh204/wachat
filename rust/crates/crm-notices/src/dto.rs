//! Request DTOs.

use serde::{Deserialize, Serialize};

use crate::types::CrmNotice;

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
    pub category: Option<String>,
    #[serde(default)]
    pub severity: Option<String>,
    #[serde(default)]
    pub issued_to: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateNoticeInput {
    #[serde(default)]
    pub notice_number: Option<String>,
    pub title: String,
    pub body: String,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub reference_number: Option<String>,
    #[serde(default)]
    pub issued_by: Option<String>,
    #[serde(default)]
    pub issued_by_name: Option<String>,
    #[serde(default)]
    pub issued_to: Option<String>,
    #[serde(default)]
    pub recipient_ids: Option<Vec<String>>,
    #[serde(default)]
    pub effective_from: Option<String>,
    #[serde(default)]
    pub effective_until: Option<String>,
    #[serde(default)]
    pub require_acknowledgement: Option<bool>,
    #[serde(default)]
    pub severity: Option<String>,
    #[serde(default)]
    pub attachments: Option<Vec<String>>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateNoticeInput {
    #[serde(default)]
    pub notice_number: Option<String>,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub body: Option<String>,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub reference_number: Option<String>,
    #[serde(default)]
    pub issued_by: Option<String>,
    #[serde(default)]
    pub issued_by_name: Option<String>,
    #[serde(default)]
    pub issued_to: Option<String>,
    #[serde(default)]
    pub recipient_ids: Option<Vec<String>>,
    #[serde(default)]
    pub effective_from: Option<String>,
    #[serde(default)]
    pub effective_until: Option<String>,
    #[serde(default)]
    pub require_acknowledgement: Option<bool>,
    #[serde(default)]
    pub acknowledgement_count: Option<i64>,
    #[serde(default)]
    pub severity: Option<String>,
    #[serde(default)]
    pub attachments: Option<Vec<String>>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub superseded_by: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateNoticeResponse {
    pub id: String,
    pub entity: CrmNotice,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteNoticeResponse {
    pub deleted: bool,
}
