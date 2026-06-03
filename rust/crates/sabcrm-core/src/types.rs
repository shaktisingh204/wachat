//! SabCRM — metadata-driven type system.
//!
//! Faithful Rust port of `src/lib/sabcrm/types.ts`. SabCRM (ported from
//! twentyhq/twenty) treats objects and their fields as *data*
//! ([`ObjectMetadata`] / [`FieldMetadata`]), not hardcoded screens — a
//! single generic record runtime renders every object as a table, kanban
//! board, detail panel and ⌘K entry.
//!
//! All structs serialize `camelCase` on the wire to match the existing TS
//! callers (e.g. `labelSingular`, `inTable`, `isLabel`, `groupByField`,
//! `targetObject`, `labelField`). Optional fields use `Option<>` and are
//! skipped when `None` so the emitted JSON matches `schema.ts` 1:1.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

/// A single option for SELECT / MULTI_SELECT fields. Mirrors the
/// `FieldOption` interface in `types.ts`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SelectOption {
    pub value: String,
    pub label: String,
    /// Token name from the `--zoru-*` palette or a hex color.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
}

/// Relation target descriptor for RELATION fields. Mirrors the
/// `FieldRelation` interface in `types.ts` (`relation` on a field).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RelationMeta {
    /// Slug of the object this field points at, e.g. `companies`.
    pub target_object: String,
    /// Cardinality from the perspective of THIS record
    /// (`MANY_TO_ONE` | `ONE_TO_MANY`).
    pub kind: String,
    /// Field on the target object used as the human label.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label_field: Option<String>,
}

/// Definition of one field on an object. Mirrors the `FieldMetadata`
/// interface in `types.ts`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct FieldMetadata {
    /// Stable key used as the property name inside a record's `data`.
    pub key: String,
    pub label: String,
    /// One of the `FieldType` union members (`TEXT`, `NUMBER`, …).
    pub r#type: String,
    /// Lucide / ZORU_ICONS icon shown in column headers + detail rows.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub required: Option<bool>,
    /// Shown as a column in the default table view.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub in_table: Option<bool>,
    /// Used as the record's display title (one per object).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_label: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// SELECT / MULTI_SELECT options.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub options: Option<Vec<SelectOption>>,
    /// RELATION target.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub relation: Option<RelationMeta>,
    /// Default value applied on create.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_value: Option<Value>,
    /// System fields cannot be edited or removed by users.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system: Option<bool>,
}

/// Kanban configuration derived from a SELECT field. Mirrors the
/// `BoardConfig` interface in `types.ts`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct BoardMeta {
    /// SELECT field whose options become the board columns.
    pub group_by_field: String,
}

/// Definition of one object (a CRM "table"). Mirrors the `ObjectMetadata`
/// interface in `types.ts`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ObjectMetadata {
    /// URL + collection slug, plural kebab, e.g. `opportunities`.
    pub slug: String,
    /// Singular human label, e.g. `Opportunity`.
    pub label_singular: String,
    /// Plural human label, e.g. `Opportunities`.
    pub label_plural: String,
    /// ZORU_ICONS / lucide icon name for nav + headers.
    pub icon: String,
    /// Whether this is a built-in standard object.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub standard: Option<bool>,
    /// Views this object supports (`table` | `board`).
    pub views: Vec<String>,
    pub fields: Vec<FieldMetadata>,
    /// Kanban configuration when `board` view is enabled.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub board: Option<BoardMeta>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}
