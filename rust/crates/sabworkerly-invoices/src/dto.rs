//! Request DTOs for sabworkerly-invoices.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub client_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateInvoiceLineInput {
    pub placement_id: String,
    pub worker_name: String,
    pub hours: f64,
    pub rate: i64,
    pub amount_minor: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateInvoiceInput {
    pub client_id: String,
    pub period_start: DateTime<Utc>,
    pub period_end: DateTime<Utc>,
    #[serde(default)]
    pub timesheet_ids: Vec<String>,
    #[serde(default)]
    pub line_items: Vec<CreateInvoiceLineInput>,
    pub total_minor: i64,
    #[serde(default)]
    pub currency: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInvoiceInput {
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub sent_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub paid_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateInvoiceResponse {
    pub id: String,
    pub entity: crate::types::SabworkerlyInvoice,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteInvoiceResponse {
    pub deleted: bool,
}
