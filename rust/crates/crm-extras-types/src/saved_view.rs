//! §12.25 Saved Views + Audience Segments.
//!
//! Mongo collections: `crm_saved_views`, `crm_segments`. A saved view
//! pins a recursive AND/OR filter tree, column config, sort spec,
//! density, share scope and pinned flag against an entity list.
//! Segments share the same filter tree but are tagged for audience
//! reuse across automations.
//!
//! Both structs flatten the `crm-core` `Identity` + `Audit` fragments
//! so the document root carries §0 ownership and audit fields directly.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Audit, Identity};
use serde::{Deserialize, Serialize};

/// Boolean composition for a `FilterGroup`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LogicalOp {
    #[default]
    And,
    Or,
}

/// A single comparison `field <op> value`. `op` is free-form
/// (`"eq"`, `"in"`, `"gte"`, `"contains"`, …) and `value` is raw JSON
/// because op semantics dictate the value shape.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FilterClause {
    pub field: String,
    pub op: String,
    #[serde(default)]
    pub value: serde_json::Value,
}

/// Recursive AND/OR group. `clauses` are leaf comparisons; `groups`
/// nest deeper boolean expressions under the same `logic`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FilterGroup {
    pub logic: LogicalOp,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub clauses: Vec<FilterClause>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub groups: Vec<FilterGroup>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnConfig {
    pub field: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub width: Option<u32>,
    #[serde(default)]
    pub hidden: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SortSpec {
    pub field: String,
    /// `"asc" | "desc"`.
    pub direction: String,
}

/// Row spacing preset for a saved-view list.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Density {
    Compact,
    #[default]
    Comfortable,
    Spacious,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedView {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    pub entity: String,
    pub name: String,
    pub root_filter: FilterGroup,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub columns: Vec<ColumnConfig>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub sort: Vec<SortSpec>,
    #[serde(default)]
    pub density: Density,
    /// `"private" | "team" | "global"`.
    pub share_scope: String,
    #[serde(default)]
    pub pinned: bool,
    pub owner_id: ObjectId,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Segment {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    pub name: String,
    pub entity: String,
    pub root_filter: FilterGroup,
    /// Last cached membership count, refreshed by the segment worker.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub count_cached: Option<u64>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub last_evaluated_at: Option<DateTime<Utc>>,
    /// Reverse-index: automations / campaigns currently using this
    /// segment as audience. Lets the UI warn before a destructive edit.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub used_by_automations: Vec<ObjectId>,
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
    fn saved_view_round_trips_with_flattened_fragments() {
        let owner = ObjectId::new();
        let view = SavedView {
            identity: identity(),
            audit: audit(),
            entity: "client".to_string(),
            name: "Hot leads".to_string(),
            root_filter: FilterGroup {
                logic: LogicalOp::And,
                clauses: vec![FilterClause {
                    field: "status".to_string(),
                    op: "eq".to_string(),
                    value: serde_json::json!("active"),
                }],
                groups: vec![FilterGroup {
                    logic: LogicalOp::Or,
                    clauses: vec![
                        FilterClause {
                            field: "score".to_string(),
                            op: "gte".to_string(),
                            value: serde_json::json!(80),
                        },
                        FilterClause {
                            field: "tier".to_string(),
                            op: "eq".to_string(),
                            value: serde_json::json!("gold"),
                        },
                    ],
                    groups: vec![],
                }],
            },
            columns: vec![ColumnConfig {
                field: "name".to_string(),
                label: Some("Client".to_string()),
                width: Some(220),
                hidden: false,
            }],
            sort: vec![SortSpec {
                field: "createdAt".to_string(),
                direction: "desc".to_string(),
            }],
            density: Density::Compact,
            share_scope: "team".to_string(),
            pinned: true,
            owner_id: owner,
        };

        let json = serde_json::to_value(&view).unwrap();
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());
        assert!(json.get("rootFilter").is_some());
        assert!(json.get("shareScope").is_some());
        assert_eq!(json.get("density").unwrap(), "compact");

        let root = json.get("rootFilter").unwrap();
        assert_eq!(root.get("logic").unwrap(), "and");
        let nested = &root.get("groups").unwrap()[0];
        assert_eq!(nested.get("logic").unwrap(), "or");

        let back: SavedView = serde_json::from_value(json).unwrap();
        assert_eq!(back.name, "Hot leads");
        assert!(matches!(back.density, Density::Compact));
        assert!(matches!(back.root_filter.logic, LogicalOp::And));
        assert_eq!(back.root_filter.groups.len(), 1);
        assert!(matches!(back.root_filter.groups[0].logic, LogicalOp::Or));
    }

    #[test]
    fn segment_round_trips() {
        let seg = Segment {
            identity: identity(),
            audit: audit(),
            name: "VIPs".to_string(),
            entity: "client".to_string(),
            root_filter: FilterGroup {
                logic: LogicalOp::And,
                clauses: vec![],
                groups: vec![],
            },
            count_cached: Some(42),
            last_evaluated_at: Some(Utc::now()),
            used_by_automations: vec![ObjectId::new()],
        };
        let json = serde_json::to_value(&seg).unwrap();
        assert!(json.get("countCached").is_some());
        assert!(json.get("usedByAutomations").is_some());

        let back: Segment = serde_json::from_value(json).unwrap();
        assert_eq!(back.count_cached, Some(42));
    }
}
