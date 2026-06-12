//! Wire-format DTOs for the SabCRM sales-pipelines HTTP surface.
//!
//! Mirrors the persisted `sabcrm_pipelines` document shape:
//!
//! ```text
//! { _id, projectId, name, object (default "opportunities"),
//!   stages: [{ id, label, color,
//!              requiredFields?, requiresApproval?, rottingDays? }],
//!   isDefault?, lostReasonRequired?, lostReasons?, createdAt, updatedAt }
//! ```
//!
//! ## Stage governance (Zoho-Blueprint / Pipedrive-inspired)
//!
//! Each stage may additionally declare **entry gates**:
//!
//! - `requiredFields: string[]` — record `data.<key>`s that must be
//!   non-empty before a record may ENTER this stage;
//! - `requiresApproval: bool` — entering this stage raises an approval
//!   request (see the sibling `sabcrm-approvals` crate) instead of moving
//!   immediately;
//! - `rottingDays?: number` — idle-days threshold for the deal-rotting UI;
//! - `kind?: "open" | "won" | "lost"` — explicit stage classification so
//!   consumers no longer have to infer won/lost from the stage label;
//! - `probability?: number` — win probability (0–100) used by the weighted
//!   forecast (`sum(amount × probability)`). Absent → consumers fall back
//!   to a kind/position-based default.
//!
//! And the pipeline document may declare loss governance:
//!
//! - `lostReasonRequired?: bool` — marking a record lost requires a reason;
//! - `lostReasons?: string[]` — the curated list of allowed lost reasons.
//!
//! All governance keys are **additive with serde defaults** — pipelines
//! persisted before this extension (stages as bare `{ id, label, color }`)
//! keep deserializing unchanged (see [`StageGovernance`] /
//! [`PipelineGovernance`] and the unit tests at the bottom of this module).
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
// Stage governance — typed views over the schemaless stage / pipeline docs
// ===========================================================================

/// Typed **entry-gate** slice of one stage descriptor. The stored stage is a
/// free-form JSON object (`{ id, label, color, ... }`); this struct extracts
/// only the governance keys, all serde-defaulted so legacy stages (without
/// any governance) deserialize to the permissive baseline: no required
/// fields, no approval, no rotting threshold.
#[derive(Debug, Clone, Default, PartialEq, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct StageGovernance {
    /// Record `data.<key>`s that must be non-empty before a record may
    /// ENTER this stage. Empty → no required-field gate.
    #[serde(default)]
    pub required_fields: Vec<String>,
    /// Entering this stage raises an approval request (handled by
    /// `sabcrm-approvals`) instead of moving immediately.
    #[serde(default)]
    pub requires_approval: bool,
    /// Idle-days threshold for the deal-rotting UI. `None` → never rots.
    #[serde(default)]
    pub rotting_days: Option<u32>,
    /// Explicit stage classification (`"open"` / `"won"` / `"lost"`). Kept as
    /// a free string for wire tolerance; `None` → unclassified (consumers may
    /// fall back to label heuristics for legacy pipelines).
    #[serde(default)]
    pub kind: Option<String>,
    /// Win probability of records sitting in this stage, in **percent**
    /// (0–100). Drives the weighted forecast
    /// (`weighted = amount × probability / 100`). `None` → unset (consumers
    /// fall back to a kind/position-based default). Stored verbatim; values
    /// outside 0–100 are clamped by consumers, not the engine.
    #[serde(default)]
    pub probability: Option<f64>,
}

impl StageGovernance {
    /// Parse the governance slice out of a raw stage descriptor. Unknown /
    /// malformed governance keys fall back to the permissive default rather
    /// than failing the whole stage.
    pub fn from_stage(stage: &Value) -> Self {
        serde_json::from_value(stage.clone()).unwrap_or_default()
    }
}

/// Typed **loss-governance** slice of one pipeline document, serde-defaulted
/// so legacy pipelines (without the keys) deserialize to the permissive
/// baseline: lost reason optional, no curated reason list.
#[derive(Debug, Clone, Default, PartialEq, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PipelineGovernance {
    /// Marking a record lost requires one of [`Self::lost_reasons`] (or any
    /// free-text reason when the list is empty).
    #[serde(default)]
    pub lost_reason_required: bool,
    /// Curated list of allowed lost reasons. Empty → free text allowed.
    #[serde(default)]
    pub lost_reasons: Vec<String>,
}

impl PipelineGovernance {
    /// Parse the governance slice out of a raw pipeline document. Unknown /
    /// malformed keys fall back to the permissive default.
    pub fn from_pipeline(pipeline: &Value) -> Self {
        serde_json::from_value(pipeline.clone()).unwrap_or_default()
    }
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
    /// Record `data.<key>`s required to ENTER this stage (entry gate).
    /// Omitted on the wire when empty so legacy consumers are unaffected.
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub required_fields: Vec<String>,
    /// Entering this stage raises an approval request instead of moving
    /// immediately. Omitted on the wire when `false`.
    #[serde(skip_serializing_if = "std::ops::Not::not", default)]
    pub requires_approval: bool,
    /// Idle-days threshold for the deal-rotting UI, if declared.
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub rotting_days: Option<u32>,
    /// Explicit stage classification (`"open"` / `"won"` / `"lost"`), if
    /// declared. Omitted on the wire when absent.
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub kind: Option<String>,
    /// Win probability of this stage in percent (0–100), if declared.
    /// Omitted on the wire when absent (consumers apply their own default).
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub probability: Option<f64>,
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

// ===========================================================================
// tests — serde defaults keep legacy documents deserializing
// ===========================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    /// A legacy stage (`{ id, label, color }`, pre-governance) parses to the
    /// permissive baseline: no required fields, no approval, no rotting.
    #[test]
    fn legacy_stage_defaults_to_permissive_governance() {
        let stage = json!({ "id": "qualified", "label": "Qualified", "color": "#22c55e" });
        let gov = StageGovernance::from_stage(&stage);
        assert_eq!(gov, StageGovernance::default());
        assert!(gov.required_fields.is_empty());
        assert!(!gov.requires_approval);
        assert_eq!(gov.rotting_days, None);
        assert_eq!(gov.kind, None);
        assert_eq!(gov.probability, None);
    }

    /// A governed stage round-trips its camelCase governance keys.
    #[test]
    fn governed_stage_parses_camel_case_keys() {
        let stage = json!({
            "id": "negotiation",
            "label": "Negotiation",
            "requiredFields": ["amount", "closeDate"],
            "requiresApproval": true,
            "rottingDays": 14,
            "kind": "open",
            "probability": 60
        });
        let gov = StageGovernance::from_stage(&stage);
        assert_eq!(gov.required_fields, vec!["amount", "closeDate"]);
        assert!(gov.requires_approval);
        assert_eq!(gov.rotting_days, Some(14));
        assert_eq!(gov.kind.as_deref(), Some("open"));
        assert_eq!(gov.probability, Some(60.0));
    }

    /// The stage `probability` marker round-trips (integer and fractional
    /// percents) and defaults to `None` when absent (legacy stages unset).
    #[test]
    fn stage_probability_round_trips() {
        let with_int = json!({ "id": "proposal", "probability": 40 });
        assert_eq!(StageGovernance::from_stage(&with_int).probability, Some(40.0));

        let with_frac = json!({ "id": "proposal", "probability": 12.5 });
        assert_eq!(StageGovernance::from_stage(&with_frac).probability, Some(12.5));

        let legacy = json!({ "id": "proposal", "label": "Proposal" });
        assert_eq!(StageGovernance::from_stage(&legacy).probability, None);
    }

    /// The explicit stage `kind` marker round-trips for won/lost stages and
    /// defaults to `None` when absent (legacy stages stay unclassified).
    #[test]
    fn stage_kind_marker_round_trips() {
        let lost = json!({ "id": "closed", "label": "Closed", "kind": "lost" });
        assert_eq!(StageGovernance::from_stage(&lost).kind.as_deref(), Some("lost"));

        let won = json!({ "id": "won", "label": "Won", "kind": "won" });
        assert_eq!(StageGovernance::from_stage(&won).kind.as_deref(), Some("won"));

        let legacy = json!({ "id": "won", "label": "Won" });
        assert_eq!(StageGovernance::from_stage(&legacy).kind, None);
    }

    /// Malformed governance keys fall back to the permissive default rather
    /// than erroring the stage.
    #[test]
    fn malformed_stage_governance_falls_back_to_default() {
        let stage = json!({ "id": "won", "requiredFields": "not-an-array" });
        assert_eq!(StageGovernance::from_stage(&stage), StageGovernance::default());
    }

    /// A legacy pipeline (no loss-governance keys) parses to the permissive
    /// baseline: lost reason optional, no curated list.
    #[test]
    fn legacy_pipeline_defaults_to_permissive_loss_governance() {
        let pipeline = json!({
            "id": "65a1",
            "projectId": "p1",
            "name": "Sales",
            "object": "leads",
            "stages": [{ "id": "new", "label": "New" }]
        });
        let gov = PipelineGovernance::from_pipeline(&pipeline);
        assert_eq!(gov, PipelineGovernance::default());
        assert!(!gov.lost_reason_required);
        assert!(gov.lost_reasons.is_empty());
    }

    /// A governed pipeline round-trips its camelCase loss-governance keys.
    #[test]
    fn governed_pipeline_parses_loss_governance() {
        let pipeline = json!({
            "name": "Sales",
            "lostReasonRequired": true,
            "lostReasons": ["Price", "Competitor", "No budget"]
        });
        let gov = PipelineGovernance::from_pipeline(&pipeline);
        assert!(gov.lost_reason_required);
        assert_eq!(gov.lost_reasons, vec!["Price", "Competitor", "No budget"]);
    }

    /// Governance structs serialize back out in camelCase (wire contract).
    #[test]
    fn governance_serializes_camel_case() {
        let gov = StageGovernance {
            required_fields: vec!["amount".into()],
            requires_approval: true,
            rotting_days: Some(7),
            kind: Some("won".into()),
            probability: Some(100.0),
        };
        let v = serde_json::to_value(&gov).expect("serialize");
        assert_eq!(v["requiredFields"], json!(["amount"]));
        assert_eq!(v["requiresApproval"], json!(true));
        assert_eq!(v["rottingDays"], json!(7));
        assert_eq!(v["kind"], json!("won"));
        assert_eq!(v["probability"], json!(100.0));
    }
}
