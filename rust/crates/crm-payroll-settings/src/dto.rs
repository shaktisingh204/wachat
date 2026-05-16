//! Request DTOs.

use bson::Document;
use serde::{Deserialize, Serialize};

use crate::types::CrmPayrollSetting;

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
    pub pay_cycle: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSettingInput {
    #[serde(default)]
    pub company_name: Option<String>,
    #[serde(default)]
    pub pf_rate: Option<f64>,
    #[serde(default)]
    pub esi_rate: Option<f64>,
    #[serde(default)]
    pub pay_cycle: Option<String>,
    #[serde(default)]
    pub tax_slabs: Option<Vec<Document>>,
    #[serde(default)]
    pub default_currency: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSettingInput {
    #[serde(default)]
    pub company_name: Option<String>,
    #[serde(default)]
    pub pf_rate: Option<f64>,
    #[serde(default)]
    pub esi_rate: Option<f64>,
    #[serde(default)]
    pub pay_cycle: Option<String>,
    #[serde(default)]
    pub tax_slabs: Option<Vec<Document>>,
    #[serde(default)]
    pub default_currency: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSettingResponse {
    pub id: String,
    pub entity: CrmPayrollSetting,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteSettingResponse {
    pub deleted: bool,
}
