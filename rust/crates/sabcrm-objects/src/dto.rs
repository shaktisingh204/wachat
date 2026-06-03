//! Wire-format DTOs for the SabCRM object-metadata HTTP surface.
//!
//! Mirrors the payloads accepted by `src/lib/sabcrm/objects.server.ts` and
//! the persisted `SabcrmObjectDoc` shape in `src/lib/sabcrm/db.ts`
//! (`ObjectMetadata` + `projectId` + `extendsStandard?` + timestamps).

use sabcrm_core::ObjectMetadata;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

/// Query params for endpoints that only need the tenant scope
/// (`GET /`, `GET /{slug}`, `DELETE /{slug}`).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ScopeQuery {
    /// Tenant scope — required.
    pub project_id: String,
}

/// `POST /` body — insert a fully-custom object for the project.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateObjectInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// The object metadata to persist (`slug` must be unique per project).
    pub object: ObjectMetadata,
}

/// `PATCH /{slug}` body — partial update of a custom object (e.g. add or
/// update `fields`). Each key in `patch` is `$set` verbatim; `updatedAt`
/// is always bumped.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateObjectInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Partial object document — only the keys present are written.
    #[schema(value_type = Object)]
    pub patch: Value,
}

/// Response body for `GET /` — the merged list of objects.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub objects: Vec<ObjectMetadata>,
}

/// Response body for `GET /{slug}`, `POST /` and `PATCH /{slug}` — a
/// single merged object.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ObjectResponse {
    pub object: ObjectMetadata,
}

/// Tiny `{ ok: true }` envelope returned by `DELETE /{slug}`.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct OkResponse {
    pub ok: bool,
}
