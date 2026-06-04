//! Wire-format DTOs for the SabCRM favorites HTTP surface.
//!
//! Mirrors the payloads accepted by `src/lib/sabcrm/favorites.server.ts`
//! and the persisted `SabcrmFavoriteDoc` shape in `src/lib/sabcrm/db.ts`.
//! The `userId` is always the caller (from `AuthUser`) and never arrives
//! in a request body. List responses return the stored document verbatim
//! (cleaned via `document_to_clean_json`, `_id` relabelled to `id`).

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

/// `GET /` query params — list the caller's favorites for a project.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    /// Tenant scope — required.
    pub project_id: String,
}

/// `POST /` body — upsert a favorite for the caller.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AddFavoriteInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Object slug of the favorited record.
    pub object: String,
    /// Serialized id of the favorited record.
    pub record_id: String,
}

/// One entry in a `PATCH /reorder` request — a favorite id and its new
/// zero-based slot in the caller's ordered list.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ReorderItem {
    /// Hex id (`_id`) of the favorite to move.
    pub id: String,
    /// New zero-based position in the ordered list.
    pub position: i32,
}

/// `PATCH /reorder` body — reassign positions across the caller's favorites
/// within a project. Only the listed favorites are touched; their `position`
/// values are written as given, mirroring Twenty's drag-to-reorder.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ReorderInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// The favorites to reposition, in any order.
    pub items: Vec<ReorderItem>,
}

/// `DELETE /` query params — remove a favorite for the caller.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RemoveFavoriteQuery {
    /// Tenant scope — required.
    pub project_id: String,
    /// Object slug of the favorited record.
    pub object: String,
    /// Serialized id of the favorited record.
    pub record_id: String,
}

/// Response body for `GET /` — the caller's favorites, newest first.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    #[schema(value_type = Vec<Object>)]
    pub favorites: Vec<Value>,
}

/// Response body for `POST /` — the upserted favorite.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct FavoriteResponse {
    #[schema(value_type = Object)]
    pub favorite: Value,
}

/// Tiny `{ ok: true }` envelope returned by `DELETE /`.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct OkResponse {
    pub ok: bool,
}
