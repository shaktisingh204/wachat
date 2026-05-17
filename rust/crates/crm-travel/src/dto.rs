//! Request DTOs for the Travel Request entity.

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
    #[serde(default)]
    pub employee_id: Option<String>,
    #[serde(default)]
    pub approver_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct CreateTravelRequestInput {
    pub employee_id: String,
    #[serde(default)]
    pub employee_name: Option<String>,
    #[serde(default)]
    pub purpose: Option<String>,
    #[serde(default)]
    pub from_city: Option<String>,
    #[serde(default)]
    pub to_city: Option<String>,
    #[serde(default)]
    pub mode: Option<String>,
    /// RFC3339 date-time string. Parsed into BSON DateTime on insert.
    #[serde(default)]
    pub travel_date: Option<String>,
    #[serde(default)]
    pub return_date: Option<String>,
    #[serde(default)]
    pub estimated_cost: Option<f64>,
    #[serde(default)]
    pub actual_cost: Option<f64>,
    #[serde(default)]
    pub currency: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub approver_id: Option<String>,
    #[serde(default)]
    pub approver_name: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct UpdateTravelRequestInput {
    #[serde(default)]
    pub employee_id: Option<String>,
    #[serde(default)]
    pub employee_name: Option<String>,
    #[serde(default)]
    pub purpose: Option<String>,
    #[serde(default)]
    pub from_city: Option<String>,
    #[serde(default)]
    pub to_city: Option<String>,
    #[serde(default)]
    pub mode: Option<String>,
    #[serde(default)]
    pub travel_date: Option<String>,
    #[serde(default)]
    pub return_date: Option<String>,
    #[serde(default)]
    pub estimated_cost: Option<f64>,
    #[serde(default)]
    pub actual_cost: Option<f64>,
    #[serde(default)]
    pub currency: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub approver_id: Option<String>,
    #[serde(default)]
    pub approver_name: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTravelRequestResponse {
    pub id: String,
    pub entity: crate::types::CrmTravelRequest,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteTravelRequestResponse {
    pub deleted: bool,
}
