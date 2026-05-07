//! §12.24 Dashboards.
//!
//! Mongo collection: `crm_dashboards`. A dashboard is a named, shareable
//! grid of widgets. Each widget renders a chart / table / map / list
//! sourced from a saved view, ad-hoc query, or pre-baked report, and
//! supports filters, drill-down config and a refresh interval.
//!
//! The struct flattens the `crm-core` `Identity` + `Audit` fragments so
//! the document root carries §0 ownership and audit fields directly.

use bson::oid::ObjectId;
use crm_core::{Audit, Identity};
use serde::{Deserialize, Serialize};

/// Visual a widget renders as.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum WidgetKind {
    #[default]
    Metric,
    Line,
    Bar,
    Donut,
    Table,
    Funnel,
    Heatmap,
    Map,
    List,
}

/// Where the widget pulls its data from. Tagged so `kind` and `value`
/// are sibling JSON fields, e.g.
/// `{ "kind": "saved_view", "value": "<oid>" }`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", content = "value", rename_all = "snake_case")]
pub enum WidgetSource {
    /// Reference to a `SavedView` (see `saved_view.rs`).
    SavedView(ObjectId),
    /// Free-form query expression. The dashboard worker resolves the
    /// dialect (Mongo aggregation JSON, SQL, KQL, …).
    Query(String),
    /// Reference to a pre-built report definition.
    Report(ObjectId),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Widget {
    pub id: ObjectId,
    pub kind: WidgetKind,
    pub title: String,
    pub source: WidgetSource,
    /// Per-widget filter expression. Stored as raw JSON so the schema
    /// can evolve without bumping every dashboard doc.
    #[serde(default)]
    pub filters: serde_json::Value,
    /// Drill-down config — typically a `{ targetView, paramMap }`
    /// object. Optional because metric widgets often skip drill-down.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub drill_down: Option<serde_json::Value>,
    /// Auto-refresh cadence. `None` = manual refresh only.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub refresh_interval_seconds: Option<u32>,
    /// Grid coordinates `{ x, y, w, h }`. Raw JSON so the layout engine
    /// is free to add fields without a schema bump.
    #[serde(default)]
    pub layout: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Dashboard {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub widgets: Vec<Widget>,
    /// `"private" | "team" | "workspace"`.
    pub share_scope: String,
    /// Public embed token. Present iff the dashboard is currently
    /// shared via an iframe link.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub embed_token: Option<String>,
    pub owner_id: ObjectId,
}

/* ============================================================== */
/*  Tests                                                          */
/* ============================================================== */

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    fn identity() -> Identity {
        Identity {
            id: ObjectId::new(),
            project_id: ObjectId::new(),
            user_id: ObjectId::new(),
            tenant_id: None,
        }
    }

    fn audit() -> Audit {
        let now = Utc::now();
        Audit {
            created_at: now,
            updated_at: now,
            created_by: None,
            updated_by: None,
        }
    }

    #[test]
    fn dashboard_round_trips_with_flattened_fragments() {
        let view_id = ObjectId::new();
        let owner_id = ObjectId::new();
        let dash = Dashboard {
            identity: identity(),
            audit: audit(),
            name: "Sales pulse".to_string(),
            description: Some("Daily rollup".to_string()),
            widgets: vec![Widget {
                id: ObjectId::new(),
                kind: WidgetKind::Line,
                title: "Revenue (30d)".to_string(),
                source: WidgetSource::SavedView(view_id),
                filters: serde_json::json!({ "currency": "INR" }),
                drill_down: None,
                refresh_interval_seconds: Some(300),
                layout: serde_json::json!({ "x": 0, "y": 0, "w": 6, "h": 4 }),
            }],
            share_scope: "team".to_string(),
            embed_token: None,
            owner_id,
        };

        let json = serde_json::to_value(&dash).unwrap();
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());
        assert!(json.get("ownerId").is_some());
        assert!(json.get("shareScope").is_some());

        let widget_json = &json.get("widgets").unwrap()[0];
        assert_eq!(widget_json.get("kind").unwrap(), "line");
        let src = widget_json.get("source").unwrap();
        assert_eq!(src.get("kind").unwrap(), "saved_view");
        assert!(src.get("value").is_some());

        let back: Dashboard = serde_json::from_value(json).unwrap();
        assert_eq!(back.name, "Sales pulse");
        assert_eq!(back.widgets.len(), 1);
        match &back.widgets[0].source {
            WidgetSource::SavedView(id) => assert_eq!(*id, view_id),
            _ => panic!("widget source did not round-trip as SavedView"),
        }
    }
}
