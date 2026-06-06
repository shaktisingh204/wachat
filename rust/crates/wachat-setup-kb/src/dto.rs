//! Wire DTOs for the setup knowledge-base endpoints. `camelCase` to match the
//! JSON the `/wachat/setup/docs` page sends and renders.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

/// Query for `GET /articles?q=&category=&sort=`.
///
/// - `q` — case-insensitive substring match over `title` + `content`.
/// - `category` — exact match (e.g. `setup` | `troubleshooting` | `best-practices`).
/// - `sort` — one of `date-desc` (default) | `date-asc` | `title-asc` | `title-desc`.
#[derive(Debug, Clone, Default, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListArticlesQuery {
    #[serde(default)]
    pub q: Option<String>,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub sort: Option<String>,
}

/// Body for `POST /articles` (create) and `PUT /articles/{article_id}` (update).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ArticleBody {
    /// Article headline.
    pub title: String,
    /// Article body / markdown text.
    pub content: String,
    /// Bucket the article belongs to (e.g. `setup`, `troubleshooting`, `best-practices`).
    pub category: String,
}

/// Response for `GET /articles` — matching articles as cleaned JSON docs.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListArticlesResponse {
    #[schema(value_type = Vec<Object>)]
    pub articles: Vec<Value>,
}

/// `{ success: true }` envelope for PUT / DELETE.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct SuccessResponse {
    pub success: bool,
}

impl SuccessResponse {
    pub fn ok() -> Self {
        Self { success: true }
    }
}
