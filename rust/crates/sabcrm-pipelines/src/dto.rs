//! Wire-format DTOs for the SabCRM sales-pipelines HTTP surface.
//!
//! Mirrors the persisted `sabcrm_pipelines` document shape:
//!
//! ```text
//! { _id, projectId, name, object (default "opportunities"),
//!   stages: [{ id, label, color }], isDefault?, createdAt, updatedAt }
//! ```
//!
//! List / single responses are typed as `serde_json::Value` — the stored
//! document is returned verbatim (cleaned via `document_to_clean_json`,
//! `_id` relabelled to `id`).

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

/// `GET /` query params — list the pipelines for one project.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    /// Tenant scope — required.
    pub project_id: String,
}

/// `POST /` body — create a pipeline. `projectId` scopes the row; the
/// remaining keys form the pipeline document (`name`, `object`, `stages`,
/// `isDefault`). `object` defaults to `"opportunities"` server-side; an
/// empty `stages` defaults to `[]`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreatePipelineInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Remaining keys are persisted as the pipeline document.
    #[serde(flatten)]
    #[schema(value_type = Object)]
    pub pipeline: Value,
}

/// `PATCH /{id}` body — partial update. Each key in the flattened body
/// (minus `projectId`) is `$set` verbatim; `updatedAt` is always bumped.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePipelineInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Remaining keys are treated as a partial document and `$set`.
    #[serde(flatten)]
    #[schema(value_type = Object)]
    pub patch: Value,
}

/// Query params for endpoints that only need the tenant scope
/// (`GET /{id}`, `DELETE /{id}`).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ScopeQuery {
    /// Tenant scope — required.
    pub project_id: String,
}

/// Response body for `GET /` — a list of raw pipeline documents.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    #[schema(value_type = Vec<Object>)]
    pub pipelines: Vec<Value>,
}

/// Response body for `GET /{id}`, `POST /`, `PATCH /{id}` — a single raw
/// pipeline document.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PipelineResponse {
    #[schema(value_type = Object)]
    pub pipeline: Value,
}

/// Tiny `{ ok: true }` envelope returned by `DELETE /{id}`.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct OkResponse {
    pub ok: bool,
}

// ===========================================================================
// Board depth — stages with counts/amounts, reordering, move-record-to-stage
// ===========================================================================

/// `GET /{id}/board` query params. Beyond the tenant scope, the caller may
/// override which `data.<field>` on the target object carries the stage id
/// and which carries the numeric amount summed per stage. Both default
/// server-side (`stage` / `amount`) when absent.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct BoardQuery {
    /// Tenant scope — required.
    pub project_id: String,
    /// `data.<field>` on the target object holding the stage id.
    /// Defaults to `"stage"`.
    #[serde(default)]
    pub stage_field: Option<String>,
    /// `data.<field>` on the target object holding the numeric amount.
    /// Defaults to `"amount"`.
    #[serde(default)]
    pub amount_field: Option<String>,
}

/// One column of the pipeline board: the stage descriptor (id / label /
/// color, carried verbatim from the pipeline document) plus the live
/// per-stage rollups computed from `sabcrm_records`.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct BoardStage {
    /// Stage id (always a string on the wire; numeric stored ids are
    /// stringified so the board tolerates non-string stage keys).
    pub id: String,
    /// Human label for the stage, if the pipeline document carried one.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    /// Stage color, if the pipeline document carried one.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    /// Zero-based position of the stage within the ordered pipeline.
    pub position: usize,
    /// Number of live records currently in this stage.
    pub count: i64,
    /// Sum of the amount field across the records in this stage.
    pub amount: f64,
}

/// Response body for `GET /{id}/board` — the pipeline document plus its
/// ordered, rolled-up stages and a tail bucket for records whose stage value
/// matches no declared stage (`null`/unknown ids).
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct BoardResponse {
    #[schema(value_type = Object)]
    pub pipeline: Value,
    /// Stages in pipeline order, each carrying its live count + amount.
    pub stages: Vec<BoardStage>,
    /// Rollup of records whose stage value does not match any declared
    /// stage (unassigned / unknown). Always present (count may be 0).
    pub unassigned: BoardStage,
    /// Total live records across all stages (including unassigned).
    pub total_count: i64,
    /// Total amount across all stages (including unassigned).
    pub total_amount: f64,
}

/// `POST /{id}/stages/reorder` body — reorder the pipeline's stages by id.
/// Any stage ids omitted from `order` keep their relative order and are
/// appended after the explicitly-ordered ones; ids in `order` that do not
/// match a stage are ignored. Stage value typing is tolerant of numeric keys.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ReorderStagesInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Desired stage-id order (stringified ids).
    pub order: Vec<String>,
}

/// `POST /{id}/move-record` body — move a single target-object record into a
/// stage of this pipeline by setting `data.<stageField>` to the stage id.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct MoveRecordInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Hex `_id` of the record to move (in `sabcrm_records`).
    pub record_id: String,
    /// Stage id to move the record into. Must match a declared stage.
    pub stage_id: String,
    /// `data.<field>` carrying the stage id. Defaults to `"stage"`.
    #[serde(default)]
    pub stage_field: Option<String>,
}

/// Response body for `POST /{id}/move-record` — the updated record document.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct MoveRecordResponse {
    #[schema(value_type = Object)]
    pub record: Value,
}
