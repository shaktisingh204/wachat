//! Wire-format DTOs for the SabCRM targets HTTP surface.
//!
//! A target row is the polymorphic junction
//! `(sourceObject, sourceId) → (targetObject, targetId)` within a
//! `projectId`. List responses return the stored document verbatim
//! (cleaned via `document_to_clean_json`, `_id` relabelled to `id`).

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

/// `GET /` query params — targets attached to a single source activity
/// (what records this note / task / activity points at).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListForSourceQuery {
    /// Tenant scope — required.
    pub project_id: String,
    /// Source activity kind (`notes` | `tasks` | `activities`).
    pub source_object: String,
    /// Serialized id of the source activity.
    pub source_id: String,
}

/// `GET /for-record` query params — sources attached to a single record
/// (notes / tasks / activities on this company, person, …).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListForRecordQuery {
    /// Tenant scope — required.
    pub project_id: String,
    /// Object slug of the linked record (e.g. `companies`, `people`).
    pub target_object: String,
    /// Serialized id of the linked record.
    pub target_id: String,
}

/// `POST /` body — link a source activity to a record (idempotent upsert).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct LinkTargetInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Source activity kind (`notes` | `tasks` | `activities`).
    pub source_object: String,
    /// Serialized id of the source activity.
    pub source_id: String,
    /// Object slug of the linked record.
    pub target_object: String,
    /// Serialized id of the linked record.
    pub target_id: String,
}

/// `DELETE /` query params — unlink a source activity from a record.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UnlinkTargetQuery {
    /// Tenant scope — required.
    pub project_id: String,
    /// Source activity kind (`notes` | `tasks` | `activities`).
    pub source_object: String,
    /// Serialized id of the source activity.
    pub source_id: String,
    /// Object slug of the linked record.
    pub target_object: String,
    /// Serialized id of the linked record.
    pub target_id: String,
}

/// Response body for the two `GET` directions — the matched target rows,
/// newest first.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    #[schema(value_type = Vec<Object>)]
    pub targets: Vec<Value>,
}

/// Response body for `POST /` — the upserted target row.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct TargetResponse {
    #[schema(value_type = Object)]
    pub target: Value,
}

/// Tiny `{ ok: true }` envelope returned by `DELETE /`.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct OkResponse {
    pub ok: bool,
}

// ===========================================================================
// Sales quotas (`/quotas`) — goals & targets for the weighted forecast
// ===========================================================================
//
// A second, ADDITIVE sub-resource on this router: per-project sales
// targets/quotas powering the `/sabcrm/forecast` goals + attainment UI.
// Stored in the separate `sabcrm_sales_targets` Mongo collection (the
// polymorphic junction rows above stay untouched in `sabcrm_targets`).
//
// Document shape:
//
// ```text
// { _id, projectId, name,
//   period: "month" | "quarter",
//   periodStart: "YYYY-MM-DD" (first day of the period),
//   metric: "revenue" | "count",
//   amount: number,
//   memberId?: string | null   (null/absent = whole-team target),
//   pipelineId?: string | null (null/absent = all pipelines),
//   createdAt, updatedAt }
// ```

/// `GET /quotas` query params — list a project's sales quotas, with
/// optional period / pipeline narrowing.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListQuotasQuery {
    /// Tenant scope — required.
    pub project_id: String,
    /// Optional period-kind filter (`month` | `quarter`).
    #[serde(default)]
    pub period: Option<String>,
    /// Optional exact period-start filter (`YYYY-MM-DD`).
    #[serde(default)]
    pub period_start: Option<String>,
    /// Optional pipeline filter (also matches team-wide quotas that
    /// declare no pipeline when used by consumers; the engine filters
    /// exact equality only).
    #[serde(default)]
    pub pipeline_id: Option<String>,
}

/// `POST /quotas` body — create a sales quota.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateQuotaInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Human label for the quota (e.g. "June team quota").
    pub name: String,
    /// Period kind — `month` | `quarter`.
    pub period: String,
    /// First day of the period, `YYYY-MM-DD`.
    pub period_start: String,
    /// What the quota measures — `revenue` | `count`.
    pub metric: String,
    /// Target amount (currency units for `revenue`, deals for `count`).
    pub amount: f64,
    /// Owning member (hex user id). Absent/null → whole-team quota.
    #[serde(default)]
    pub member_id: Option<String>,
    /// Scoping pipeline (hex id). Absent/null → all pipelines.
    #[serde(default)]
    pub pipeline_id: Option<String>,
}

/// `PATCH /quotas/{id}` body — partial update; only present keys are `$set`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateQuotaInput {
    /// Tenant scope — required.
    pub project_id: String,
    #[serde(default)]
    pub name: Option<String>,
    /// Period kind — `month` | `quarter`.
    #[serde(default)]
    pub period: Option<String>,
    /// First day of the period, `YYYY-MM-DD`.
    #[serde(default)]
    pub period_start: Option<String>,
    /// What the quota measures — `revenue` | `count`.
    #[serde(default)]
    pub metric: Option<String>,
    #[serde(default)]
    pub amount: Option<f64>,
    /// Owning member. `Some(None)`-style clearing is expressed by sending
    /// an explicit empty string (`""` → unset to team-wide).
    #[serde(default)]
    pub member_id: Option<String>,
    /// Scoping pipeline. `""` → unset to all-pipelines.
    #[serde(default)]
    pub pipeline_id: Option<String>,
}

/// `DELETE /quotas/{id}` query params — tenant scope only.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct QuotaScopeQuery {
    /// Tenant scope — required.
    pub project_id: String,
}

/// Response body for `GET /quotas` — the project's quota rows, newest first.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListQuotasResponse {
    #[schema(value_type = Vec<Object>)]
    pub quotas: Vec<Value>,
}

/// Response body for `POST /quotas` / `PATCH /quotas/{id}` — one quota row.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct QuotaResponse {
    #[schema(value_type = Object)]
    pub quota: Value,
}

// ===========================================================================
// tests — serde defaults keep the quota inputs additive
// ===========================================================================

#[cfg(test)]
mod tests {
    use super::*;

    /// A minimal create body (no member / pipeline) deserializes with both
    /// optional scopes defaulted to `None` — team-wide, all-pipelines.
    #[test]
    fn create_quota_optionals_default_to_none() {
        let input: CreateQuotaInput = serde_json::from_str(
            r#"{
                "projectId": "p1",
                "name": "June team quota",
                "period": "month",
                "periodStart": "2026-06-01",
                "metric": "revenue",
                "amount": 50000
            }"#,
        )
        .expect("deserialize");
        assert_eq!(input.project_id, "p1");
        assert_eq!(input.period, "month");
        assert_eq!(input.period_start, "2026-06-01");
        assert_eq!(input.metric, "revenue");
        assert_eq!(input.amount, 50000.0);
        assert_eq!(input.member_id, None);
        assert_eq!(input.pipeline_id, None);
    }

    /// A fully-specified create body round-trips its camelCase keys.
    #[test]
    fn create_quota_parses_camel_case_keys() {
        let input: CreateQuotaInput = serde_json::from_str(
            r#"{
                "projectId": "p1",
                "name": "Q3 — Priya",
                "period": "quarter",
                "periodStart": "2026-07-01",
                "metric": "count",
                "amount": 12,
                "memberId": "u42",
                "pipelineId": "65aa"
            }"#,
        )
        .expect("deserialize");
        assert_eq!(input.period, "quarter");
        assert_eq!(input.metric, "count");
        assert_eq!(input.member_id.as_deref(), Some("u42"));
        assert_eq!(input.pipeline_id.as_deref(), Some("65aa"));
    }

    /// A patch body with only `projectId` deserializes with every field
    /// `None` (nothing to `$set` — the handler rejects it as empty).
    #[test]
    fn update_quota_defaults_to_all_none() {
        let input: UpdateQuotaInput =
            serde_json::from_str(r#"{ "projectId": "p1" }"#).expect("deserialize");
        assert_eq!(input.name, None);
        assert_eq!(input.period, None);
        assert_eq!(input.period_start, None);
        assert_eq!(input.metric, None);
        assert_eq!(input.amount, None);
        assert_eq!(input.member_id, None);
        assert_eq!(input.pipeline_id, None);
    }

    /// The list query's filters are all optional.
    #[test]
    fn list_quotas_query_filters_default_to_none() {
        let q: ListQuotasQuery =
            serde_json::from_str(r#"{ "projectId": "p1" }"#).expect("deserialize");
        assert_eq!(q.period, None);
        assert_eq!(q.period_start, None);
        assert_eq!(q.pipeline_id, None);
    }
}
