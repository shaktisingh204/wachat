use serde::{Deserialize, Serialize};

use crate::types::SabprepRun;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub recipe_id: Option<String>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub page: Option<u32>,
    /// `"ok"` | `"partial"` | `"failed"`.
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabprepRun>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}
