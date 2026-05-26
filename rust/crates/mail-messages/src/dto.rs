//! Request DTOs for `/v1/mail/messages`.

use serde::{Deserialize, Serialize};

use crate::types::MailAddress;

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
    #[serde(default)]
    pub folder_id: Option<String>,
    #[serde(default)]
    pub unread_only: Option<bool>,
    #[serde(default)]
    pub starred_only: Option<bool>,
    #[serde(default)]
    pub label: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateMessageInput {
    pub account_id: String,
    pub folder_id: String,
    #[serde(default)]
    pub subject: Option<String>,
    #[serde(default)]
    pub from_addr: Option<MailAddress>,
    #[serde(default)]
    pub to_addrs: Vec<MailAddress>,
    #[serde(default)]
    pub cc: Vec<MailAddress>,
    #[serde(default)]
    pub bcc: Vec<MailAddress>,
    #[serde(default)]
    pub body_file_id: Option<String>,
    #[serde(default)]
    pub attachment_file_ids: Vec<String>,
    #[serde(default)]
    pub snippet: Option<String>,
    #[serde(default)]
    pub labels: Vec<String>,
    #[serde(default)]
    pub thread_id: Option<String>,
    #[serde(default)]
    pub unread: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateMessageInput {
    #[serde(default)]
    pub folder_id: Option<String>,
    #[serde(default)]
    pub unread: Option<bool>,
    #[serde(default)]
    pub starred: Option<bool>,
    #[serde(default)]
    pub labels: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateMessageResponse {
    pub id: String,
    pub entity: crate::types::MailMessage,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteMessageResponse {
    pub deleted: bool,
}
