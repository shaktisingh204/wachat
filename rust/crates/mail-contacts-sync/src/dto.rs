//! Request DTOs for `/v1/mail/contacts-sync`.

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
    pub account_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateContactInput {
    pub account_id: String,
    #[serde(default)]
    pub display_name: Option<String>,
    #[serde(default)]
    pub emails: Vec<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateContactInput {
    #[serde(default)]
    pub display_name: Option<String>,
    #[serde(default)]
    pub emails: Option<Vec<String>>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateContactResponse {
    pub id: String,
    pub entity: crate::types::MailContact,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteContactResponse {
    pub deleted: bool,
}
