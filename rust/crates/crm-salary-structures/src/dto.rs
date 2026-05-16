//! Request / response DTOs for the salary-structures HTTP surface.

use serde::{Deserialize, Serialize};

use crate::types::CrmSalaryStructure;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub q: Option<String>,
    /// `"active"` (default — excludes archived), `"archived"`, or `"all"`.
    #[serde(default)]
    pub status: Option<String>,
    /// Filter by FK into `crm_employees`.
    #[serde(default)]
    pub employee_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateStructureInput {
    pub employee_id: String,
    #[serde(default)]
    pub employee_name: Option<String>,
    #[serde(default)]
    pub effective_from: Option<String>,

    pub basic: f64,
    #[serde(default)]
    pub hra: Option<f64>,
    #[serde(default)]
    pub da: Option<f64>,
    #[serde(default)]
    pub other_allowances: Option<f64>,

    #[serde(default)]
    pub pf_employer: Option<f64>,
    #[serde(default)]
    pub pf_employee: Option<f64>,
    #[serde(default)]
    pub esi: Option<f64>,
    #[serde(default)]
    pub professional_tax: Option<f64>,

    #[serde(default)]
    pub gross: Option<f64>,
    #[serde(default)]
    pub net: Option<f64>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateStructureInput {
    #[serde(default)]
    pub employee_id: Option<String>,
    #[serde(default)]
    pub employee_name: Option<String>,
    #[serde(default)]
    pub effective_from: Option<String>,

    #[serde(default)]
    pub basic: Option<f64>,
    #[serde(default)]
    pub hra: Option<f64>,
    #[serde(default)]
    pub da: Option<f64>,
    #[serde(default)]
    pub other_allowances: Option<f64>,

    #[serde(default)]
    pub pf_employer: Option<f64>,
    #[serde(default)]
    pub pf_employee: Option<f64>,
    #[serde(default)]
    pub esi: Option<f64>,
    #[serde(default)]
    pub professional_tax: Option<f64>,

    #[serde(default)]
    pub gross: Option<f64>,
    #[serde(default)]
    pub net: Option<f64>,

    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateStructureResponse {
    pub id: String,
    pub entity: CrmSalaryStructure,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteStructureResponse {
    pub deleted: bool,
}
