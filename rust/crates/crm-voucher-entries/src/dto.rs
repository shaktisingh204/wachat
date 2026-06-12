//! Request DTOs.

use serde::{Deserialize, Serialize};

use crate::types::{CrmVoucherEntry, VoucherLine};

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
    /// Filter to a single voucher book.
    #[serde(default)]
    pub voucher_book_id: Option<String>,
    /// SabCRM (project) mounts only — required there, ignored on legacy.
    #[serde(default)]
    pub project_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateEntryInput {
    pub voucher_book_id: String,
    pub voucher_number: String,
    /// RFC3339 date string.
    pub date: String,
    #[serde(default)]
    pub narration: Option<String>,
    #[serde(default)]
    pub debit_entries: Vec<VoucherLineInput>,
    #[serde(default)]
    pub credit_entries: Vec<VoucherLineInput>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub reference: Option<String>,
    /// SabCRM (project) mounts only — required there, ignored on legacy.
    #[serde(default)]
    pub project_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VoucherLineInput {
    pub account_id: String,
    pub amount: f64,
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateEntryInput {
    #[serde(default)]
    pub voucher_book_id: Option<String>,
    #[serde(default)]
    pub voucher_number: Option<String>,
    #[serde(default)]
    pub date: Option<String>,
    #[serde(default)]
    pub narration: Option<String>,
    #[serde(default)]
    pub debit_entries: Option<Vec<VoucherLineInput>>,
    #[serde(default)]
    pub credit_entries: Option<Vec<VoucherLineInput>>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub reference: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateEntryResponse {
    pub id: String,
    pub entity: CrmVoucherEntry,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteEntryResponse {
    pub deleted: bool,
}

/// Scope carrier for get/update/delete on SabCRM (project) mounts —
/// `?projectId=<oid>`. Ignored on the legacy (`userId`) mount.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScopeQuery {
    #[serde(default)]
    pub project_id: Option<String>,
}

impl VoucherLineInput {
    /// Parse the `accountId` string into a real `ObjectId`; bubble the error
    /// up so handlers can return a 400.
    pub fn into_line(self) -> Result<VoucherLine, sabnode_common::ApiError> {
        let oid = bson::oid::ObjectId::parse_str(&self.account_id).map_err(|_| {
            sabnode_common::ApiError::Validation("invalid accountId in voucher line".to_owned())
        })?;
        Ok(VoucherLine {
            account_id: oid,
            amount: self.amount,
            description: self.description,
        })
    }
}
