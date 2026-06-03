//! Cross-cutting primitives — addresses, pagination, id strings.

use serde::{Deserialize, Serialize};

pub type ObjectIdString = String;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailAddress {
    pub email: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PageQuery {
    #[serde(default = "default_page")]
    pub page: u64,
    #[serde(default = "default_limit")]
    pub limit: u64,
}

fn default_page() -> u64 {
    1
}
fn default_limit() -> u64 {
    20
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PageResponse<T> {
    pub items: Vec<T>,
    pub total: u64,
    pub page: u64,
    pub limit: u64,
    pub has_more: bool,
}

impl<T> PageResponse<T> {
    pub fn new(items: Vec<T>, total: u64, page: u64, limit: u64) -> Self {
        let has_more = page * limit < total;
        Self {
            items,
            total,
            page,
            limit,
            has_more,
        }
    }
}
