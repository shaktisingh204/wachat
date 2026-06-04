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

/// Which record surface a layout composes. Mirrors Twenty's `pageLayoutType`
/// (`RECORD_INDEX` / `RECORD_PAGE` / `DASHBOARD`); SabCRM renders the record
/// **detail** page from `Detail` and reserves `Form` for the create/edit
/// surface. Serialised as SCREAMING case and deserialised leniently — unknown
/// kinds fall back to [`PageLayoutType::Detail`] so an absent / future value
/// never breaks a read.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, ToSchema, PartialEq, Eq)]
pub enum PageLayoutType {
    /// The record-show (detail) page — the surface `renderLayoutWidget` drives.
    #[serde(rename = "DETAIL")]
    Detail,
    /// The record create/edit form surface.
    #[serde(rename = "FORM")]
    Form,
    /// Forward-compatible catch-all; treated as [`PageLayoutType::Detail`].
    #[serde(other)]
    Other,
}

impl Default for PageLayoutType {
    fn default() -> Self {
        PageLayoutType::Detail
    }
}

impl PageLayoutType {
    /// The wire/persistence string for this kind. `Other` normalises to
    /// `DETAIL` so round-tripping an unknown stored value is stable.
    pub fn as_str(self) -> &'static str {
        match self {
            PageLayoutType::Detail | PageLayoutType::Other => "DETAIL",
            PageLayoutType::Form => "FORM",
        }
    }
}

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
    /// When `true`, `GET /` returns the per-object **default** layout (a
    /// Details tab + an Activity tab of Notes/Tasks/Timeline) instead of a
    /// `404` when no layout has been stored for the object. The returned
    /// document then carries an empty `id` (it is not persisted). Optional,
    /// defaults to `false` so the historical 404 behaviour is preserved.
    #[serde(default)]
    pub with_default: bool,
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
    /// Which record surface this layout composes. Optional; defaults to
    /// [`PageLayoutType::Detail`] so existing callers that omit it keep
    /// driving the record-show page.
    #[serde(default)]
    pub page_layout_type: PageLayoutType,
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
    /// Which record surface this layout composes.
    pub page_layout_type: PageLayoutType,
    /// `true` when this body is a server-built default rather than a stored
    /// row (only ever set by `GET ?withDefault=true` / `GET /default`). The
    /// `id` is then empty and `createdAt` / `updatedAt` are empty strings.
    pub is_default: bool,
    /// Ordered tabs.
    pub tabs: Vec<Tab>,
    /// RFC3339 creation timestamp (empty for a server-built default).
    pub created_at: String,
    /// RFC3339 last-update timestamp (empty for a server-built default).
    pub updated_at: String,
}

/// Tiny `{ ok: true }` envelope returned by `DELETE /`.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct OkResponse {
    pub ok: bool,
}

impl Widget {
    /// Construct a config-less widget with a stable id + title. Used by the
    /// default-layout builder so the seeded tree matches the editor's
    /// `makeWidget(type)` shape (`{ id, type, title, config: {} }`).
    fn seeded(id: &str, widget_type: WidgetType, title: &str) -> Self {
        Widget {
            id: id.to_owned(),
            widget_type,
            title: title.to_owned(),
            config: Value::Null,
        }
    }
}

/// Build the per-object **default** record-detail layout: a *Details* tab
/// holding a single `FIELDS` widget, plus an *Activity* tab holding
/// `NOTES` / `TASKS` / `TIMELINE`. This mirrors the front-end editor's
/// `defaultLayout(object)` and the record-detail page's fixed-tab fallback,
/// so a never-configured object renders the same composition the editor
/// previews on *Reset*. Ids are deterministic (no RNG) so repeated reads are
/// stable and idempotent. The widget `config` blobs are empty — each widget
/// type's renderer supplies its own defaults.
pub fn default_layout_tabs() -> Vec<Tab> {
    vec![
        Tab {
            id: "tab-details".to_owned(),
            title: "Details".to_owned(),
            widgets: vec![Widget::seeded("w-fields", WidgetType::Fields, "Fields")],
        },
        Tab {
            id: "tab-activity".to_owned(),
            title: "Activity".to_owned(),
            widgets: vec![
                Widget::seeded("w-notes", WidgetType::Notes, "Notes"),
                Widget::seeded("w-tasks", WidgetType::Tasks, "Tasks"),
                Widget::seeded("w-timeline", WidgetType::Timeline, "Timeline"),
            ],
        },
    ]
}
