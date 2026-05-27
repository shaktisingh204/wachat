//! Request DTOs for sabbackstage-tickets.

use serde::{Deserialize, Serialize};

use crate::types::SabbackstageTicket;

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
    pub event_id: Option<String>,
    #[serde(default)]
    pub type_id: Option<String>,
    #[serde(default)]
    pub order_id: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IssueTicketInput {
    pub type_id: String,
    pub event_id: String,
    pub order_id: String,
    pub attendee_name: String,
    pub attendee_email: String,
    #[serde(default)]
    pub attendee_phone: Option<String>,
    /// Pre-computed by the issuer (e.g. the orders handler) so QR
    /// payloads stay stable across retries.
    pub qr_code: String,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTicketInput {
    #[serde(default)]
    pub attendee_name: Option<String>,
    #[serde(default)]
    pub attendee_email: Option<String>,
    #[serde(default)]
    pub attendee_phone: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckInInput {
    pub qr_code: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckInResponse {
    pub ok: bool,
    pub ticket: SabbackstageTicket,
    pub already_checked_in: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTicketResponse {
    pub id: String,
    pub entity: SabbackstageTicket,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteTicketResponse {
    pub deleted: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabbackstageTicket>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}
