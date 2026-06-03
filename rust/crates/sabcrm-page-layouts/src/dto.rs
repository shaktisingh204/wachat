//! Wire-format DTOs for the SabCRM record-page-layout HTTP surface.
//!
//! A layout is a list of `tabs`, each a list of `widgets`. The persisted
//! document is `{ _id, projectId, object, tabs, createdAt, updatedAt }` in
//! the `sabcrm_page_layouts` collection. Responses are typed as the
//! structured [`LayoutResponse`]; the stored `tabs` array round-trips
//! verbatim through `serde_json::Value` so unknown widget `config` keys are
//! preserved.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

/// The kind of a record-page widget. Mirrors Twenty's widget catalogue; the
/// variants below are the ones SabCRM renders. Serialised as SCREAMING
/// case (`FIELDS`, `RECORD_TABLE`, …) and deserialised leniently — unknown
/// kinds fall back to [`WidgetType::Other`].
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema, PartialEq, Eq)]
pub enum WidgetType {
    /// A record's own field values.
    #[serde(rename = "FIELDS")]
    Fields,
    /// Attached notes.
    #[serde(rename = "NOTES")]
    Notes,
    /// Attached tasks.
    #[serde(rename = "TASKS")]
    Tasks,
    /// Activity timeline.
    #[serde(rename = "TIMELINE")]
    Timeline,
    /// Attached files.
    #[serde(rename = "FILES")]
    Files,
    /// A related-records table.
    #[serde(rename = "RECORD_TABLE")]
    RecordTable,
    /// Free-form rich-text body.
    #[serde(rename = "RICH_TEXT")]
    RichText,
    /// A chart / graph.
    #[serde(rename = "GRAPH")]
    Graph,
    /// An embedded iframe.
    #[serde(rename = "IFRAME")]
    Iframe,
    /// Forward-compatible catch-all for any other persisted kind.
    #[serde(other)]
    Other,
}

/// One widget inside a tab. `config` is an opaque per-type blob (chart
/// query, iframe URL, related-object slug, …) round-tripped verbatim.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Widget {
    /// Stable client-assigned widget id (unique within the layout).
    pub id: String,
    /// Widget kind.
    #[serde(rename = "type")]
    pub widget_type: WidgetType,
    /// Display title.
    #[serde(default)]
    pub title: String,
    /// Opaque per-type configuration blob.
    #[serde(default)]
    #[schema(value_type = Object)]
    pub config: Value,
}

/// One tab — an ordered group of widgets.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Tab {
    /// Stable client-assigned tab id (unique within the layout).
    pub id: String,
    /// Display title.
    #[serde(default)]
    pub title: String,
    /// Ordered widgets in this tab.
    #[serde(default)]
    pub widgets: Vec<Widget>,
}

/// `GET /` / `DELETE /` query params — identify one object's layout.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ScopeQuery {
    /// Tenant scope — required.
    pub project_id: String,
    /// Object slug whose layout to read/reset — required.
    pub object: String,
}

/// `PUT /` body — upsert one object's layout. `projectId` / `object` in the
/// body must agree with the query string (the query string wins).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SaveLayoutInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Object slug — required.
    pub object: String,
    /// The full ordered tab/widget tree to persist.
    #[serde(default)]
    pub tabs: Vec<Tab>,
}

/// Response body for `GET /` and `PUT /` — one object's full layout.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct LayoutResponse {
    /// Hex `_id` of the persisted layout document.
    pub id: String,
    /// Tenant scope.
    pub project_id: String,
    /// Object slug.
    pub object: String,
    /// Ordered tabs.
    pub tabs: Vec<Tab>,
    /// RFC3339 creation timestamp.
    pub created_at: String,
    /// RFC3339 last-update timestamp.
    pub updated_at: String,
}

/// Tiny `{ ok: true }` envelope returned by `DELETE /`.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct OkResponse {
    pub ok: bool,
}
