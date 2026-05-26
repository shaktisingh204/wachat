//! Request DTOs for the KB Category router.

use serde::{Deserialize, Serialize};

use crate::types::CrmKbCategory;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub q: Option<String>,
    /// `"all"` | `"active"` (default) | `"archived"`.
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub visibility: Option<String>,
    /// Filter to children of a given node. Use the literal `"root"` to
    /// fetch top-level categories (parentId == null).
    #[serde(default)]
    pub parent_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCategoryInput {
    pub name: String,
    #[serde(default)]
    pub slug: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub icon: Option<String>,
    #[serde(default)]
    pub parent_id: Option<String>,
    #[serde(default)]
    pub order: Option<i32>,
    #[serde(default)]
    pub visibility: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCategoryInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub slug: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub icon: Option<String>,
    #[serde(default)]
    pub parent_id: Option<String>,
    #[serde(default)]
    pub order: Option<i32>,
    #[serde(default)]
    pub visibility: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub article_count: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCategoryResponse {
    pub id: String,
    pub entity: CrmKbCategory,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteCategoryResponse {
    pub deleted: bool,
}
