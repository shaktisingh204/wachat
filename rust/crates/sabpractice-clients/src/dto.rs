//! Request DTOs.

use serde::{Deserialize, Serialize};

use crate::types::BooksLinkRef;

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
    pub firm_id: Option<String>,
    #[serde(default)]
    pub assigned_to: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateClientInput {
    pub name: String,
    #[serde(default)]
    pub firm_id: Option<String>,
    #[serde(default)]
    pub industry: Option<String>,
    #[serde(default)]
    pub fiscal_year_start: Option<String>,
    #[serde(default)]
    pub primary_contact_name: Option<String>,
    #[serde(default)]
    pub primary_contact_email: Option<String>,
    #[serde(default)]
    pub primary_contact_phone: Option<String>,
    #[serde(default)]
    pub address: Option<String>,
    #[serde(default)]
    pub tax_id: Option<String>,
    #[serde(default)]
    pub registration_no: Option<String>,
    #[serde(default)]
    pub website: Option<String>,
    #[serde(default)]
    pub timezone: Option<String>,
    #[serde(default)]
    pub currency: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub books_link_ref: Option<BooksLinkRef>,
    #[serde(default)]
    pub assigned_advisor_user_ids: Vec<String>,
    #[serde(default)]
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateClientInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub firm_id: Option<String>,
    #[serde(default)]
    pub industry: Option<String>,
    #[serde(default)]
    pub fiscal_year_start: Option<String>,
    #[serde(default)]
    pub primary_contact_name: Option<String>,
    #[serde(default)]
    pub primary_contact_email: Option<String>,
    #[serde(default)]
    pub primary_contact_phone: Option<String>,
    #[serde(default)]
    pub address: Option<String>,
    #[serde(default)]
    pub tax_id: Option<String>,
    #[serde(default)]
    pub registration_no: Option<String>,
    #[serde(default)]
    pub website: Option<String>,
    #[serde(default)]
    pub timezone: Option<String>,
    #[serde(default)]
    pub currency: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub books_link_ref: Option<BooksLinkRef>,
    #[serde(default)]
    pub assigned_advisor_user_ids: Option<Vec<String>>,
    #[serde(default)]
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateClientResponse {
    pub id: String,
    pub entity: crate::types::SabPracticeClient,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteClientResponse {
    pub deleted: bool,
}
