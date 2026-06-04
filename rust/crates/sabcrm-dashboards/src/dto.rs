//! Wire-format DTOs for the SabCRM saved-dashboards HTTP surface.
//!
//! A stored dashboard document is
//! `{ _id, projectId, name, widgets: [{ id, type, title, config }], createdAt,
//! updatedAt }`. List / single responses are typed as `serde_json::Value` —
//! the stored document is returned verbatim (cleaned via
//! `document_to_clean_json`, `_id` relabelled to `id`).

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

/// The kind of a dashboard widget. Mirrors Twenty's chart/widget families,
/// flattened into the widget archetypes SabCRM renders.
///
/// Serialized as a lowercase string (`"kpi"`, `"bar"`, …). Any value outside
/// the known set is preserved verbatim via [`WidgetType::Other`] so that
/// forward-compatible widget kinds round-trip losslessly.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum WidgetType {
    /// Single headline number / KPI tile.
    Kpi,
    /// Bar chart (1D or 2D grouped/stacked).
    Bar,
    /// Line chart (single or multi-series).
    Line,
    /// Donut / pie chart.
    Donut,
    /// Funnel chart.
    Funnel,
    /// Recent-records list.
    Recent,
    /// Pipeline (kanban-style stage breakdown).
    Pipeline,
    /// Any other widget kind, preserved verbatim.
    #[serde(untagged)]
    Other(String),
}

/// The aggregate metric a data-backed widget computes over its object/field.
///
/// Mirrors Twenty's `AggregateOperation`. Serialized lowercase; unknown values
/// round-trip via [`WidgetMetric::Other`].
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum WidgetMetric {
    /// Row count.
    Count,
    /// Sum of the field across matching rows.
    Sum,
    /// Arithmetic mean (Twenty: `AVG`).
    Avg,
    /// Minimum field value.
    Min,
    /// Maximum field value.
    Max,
    /// Distinct-value count.
    CountUniqueValues,
    /// Count of rows where the field is empty.
    CountEmpty,
    /// Count of rows where the field is non-empty.
    CountNotEmpty,
    /// Percentage of rows that are empty.
    PercentageEmpty,
    /// Percentage of rows that are non-empty.
    PercentageNotEmpty,
    /// Any other aggregate, preserved verbatim.
    #[serde(untagged)]
    Other(String),
}

/// The typed configuration blob of a widget.
///
/// The three Twenty-parity coordinates a data-backed widget needs are first
/// class:
///
/// - [`object`](WidgetConfig::object) — the source object the widget queries
///   (Twenty's `objectMetadataId` / object singular name);
/// - [`field`](WidgetConfig::field) — the field the metric aggregates over
///   and/or the group-by axis; and
/// - [`metric`](WidgetConfig::metric) — the aggregate operation.
///
/// Every other key (group-by axes, granularity, limits, colors, view ids,
/// iframe URLs, …) is captured in [`extra`](WidgetConfig::extra) so the blob
/// **round-trips losslessly** through create / read / update.
#[derive(Debug, Clone, Default, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct WidgetConfig {
    /// Source object the widget queries (object singular name or metadata id).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub object: Option<String>,
    /// Field the metric aggregates over and/or the primary group-by axis.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub field: Option<String>,
    /// Aggregate operation the widget computes.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub metric: Option<WidgetMetric>,
    /// Any remaining config keys, preserved verbatim for lossless round-trip.
    #[serde(flatten)]
    #[schema(value_type = Object)]
    pub extra: BTreeMap<String, Value>,
}

/// A single dashboard widget: `{ id, type, title, config }`.
///
/// Unknown top-level keys (grid position, etc.) are preserved in
/// [`extra`](DashboardWidget::extra) so the widget round-trips losslessly.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct DashboardWidget {
    /// Stable widget id, unique within the dashboard.
    pub id: String,
    /// Widget kind.
    #[serde(rename = "type")]
    pub widget_type: WidgetType,
    /// Display title.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    /// Typed config blob (object / field / metric + verbatim extras).
    #[serde(default)]
    pub config: WidgetConfig,
    /// Any remaining widget-level keys, preserved verbatim.
    #[serde(flatten)]
    #[schema(value_type = Object)]
    pub extra: BTreeMap<String, Value>,
}

/// Query params for endpoints that only need the tenant scope
/// (`GET /`, `GET /{id}`, `DELETE /{id}`).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ScopeQuery {
    /// Tenant scope — required.
    pub project_id: String,
}

/// `POST /` body — create a saved dashboard. `projectId` scopes the row;
/// `name` is required; `widgets` defaults to an empty list.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateDashboardInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Human-readable dashboard name — required.
    pub name: String,
    /// Ordered list of widget objects (`{ id, type, title, config }`).
    /// Defaults to `[]` when absent.
    #[serde(default)]
    #[schema(value_type = Vec<Object>)]
    pub widgets: Option<Value>,
}

/// `PATCH /{id}` body — partial update. Each key in the flattened body
/// (minus `projectId` / `_id`) is `$set` verbatim; `updatedAt` is always
/// bumped.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateDashboardInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Remaining keys are treated as a partial document and `$set`
    /// (e.g. `name`, `widgets`).
    #[serde(flatten)]
    #[schema(value_type = Object)]
    pub patch: Value,
}

/// Response body for `GET /` — a list of raw dashboard documents.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    #[schema(value_type = Vec<Object>)]
    pub dashboards: Vec<Value>,
}

/// Response body for `GET /{id}`, `POST /` and `PATCH /{id}` — a single raw
/// dashboard document.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct DashboardResponse {
    #[schema(value_type = Object)]
    pub dashboard: Value,
}

/// Tiny `{ ok: true }` envelope returned by `DELETE /{id}`.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct OkResponse {
    pub ok: bool,
}

/// Parse a `widgets` JSON value into the typed [`DashboardWidget`] list.
///
/// `widgets` must be a JSON array; each element must carry an `id` and a
/// `type`. Returns the parsed widgets so callers can validate (e.g. unique
/// ids) before persisting. The typed model is lossless — `extra` captures any
/// keys not modelled explicitly — so re-serializing the result reproduces the
/// original blob.
pub fn parse_widgets(value: &Value) -> std::result::Result<Vec<DashboardWidget>, String> {
    let arr = match value {
        Value::Array(a) => a,
        Value::Null => return Ok(Vec::new()),
        _ => return Err("widgets must be an array.".to_owned()),
    };
    let mut out = Vec::with_capacity(arr.len());
    for (idx, item) in arr.iter().enumerate() {
        let widget: DashboardWidget = serde_json::from_value(item.clone())
            .map_err(|e| format!("widgets[{idx}] is invalid: {e}"))?;
        if widget.id.trim().is_empty() {
            return Err(format!("widgets[{idx}].id is required."));
        }
        out.push(widget);
    }
    Ok(out)
}
