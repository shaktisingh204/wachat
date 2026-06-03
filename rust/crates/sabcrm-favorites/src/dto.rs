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
