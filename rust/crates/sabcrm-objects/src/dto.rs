//! Wire-format DTOs for the SabCRM object-metadata HTTP surface.
//!
//! Mirrors the payloads accepted by `src/lib/sabcrm/objects.server.ts` and
//! the persisted `SabcrmObjectDoc` shape in `src/lib/sabcrm/db.ts`
//! (`ObjectMetadata` + `projectId` + `extendsStandard?` + timestamps).

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

// ===========================================================================
// Twenty-parity wire types
// ===========================================================================
//
// The canonical `ObjectMetadata` / `FieldMetadata` shapes live in
// [`sabcrm_core`]. This crate's HTTP surface needs to carry **additional**
// Twenty-parity metadata that the core structs do not yet model — per-field
// `settings` blobs, object flags, a label-identifier and index definitions —
// and, crucially, to *round-trip* those keys on read-back (the core structs
// would silently drop unknown keys when deserializing a Mongo document).
//
// To keep this additive and avoid touching `sabcrm-core`, the wire layer uses
// the local mirror types below. They are a superset of the core shapes: every
// existing key is preserved (same name, same `camelCase`, same skip-if-none
// behaviour) and the new Twenty-parity keys are appended as optional fields.

/// One option for SELECT / MULTI_SELECT fields (wire mirror of
/// `sabcrm_core::SelectOption`).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SelectOption {
    pub value: String,
    pub label: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
}

/// Relation target descriptor for RELATION fields (wire mirror of
/// `sabcrm_core::RelationMeta`).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RelationMeta {
    pub target_object: String,
    pub kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label_field: Option<String>,
}

/// Definition of one field on an object — superset of
/// `sabcrm_core::FieldMetadata` with the Twenty-parity additions
/// `settings` (free-form, type-discriminated jsonb) and `isUnique`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct FieldMetadata {
    pub key: String,
    pub label: String,
    pub r#type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub required: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub in_table: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_label: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub options: Option<Vec<SelectOption>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub relation: Option<RelationMeta>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_value: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system: Option<bool>,

    // --- Twenty-parity additions (additive, optional) ---
    /// Type-discriminated per-field settings blob. Free-form JSON so the
    /// shape can vary by `type` (e.g. NUMBER `{ dataType, decimals }`,
    /// DATE `{ displayFormat }`, FILES `{ maxNumberOfValues }`). Mirrors
    /// Twenty's `FieldMetadata.settings`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub settings: Option<Value>,
    /// Whether this field is backed by a single-field UNIQUE index. Mirrors
    /// Twenty's (derived) `FieldMetadata.isUnique`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_unique: Option<bool>,
}

/// Kanban configuration (wire mirror of `sabcrm_core::BoardMeta`).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct BoardMeta {
    pub group_by_field: String,
}

/// The supported physical index types. Mirrors Twenty's `IndexType`
/// (`BTREE` default for scalar keys, `GIN` for jsonb / array / tsvector).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "UPPERCASE")]
pub enum IndexType {
    Btree,
    Gin,
}

/// One index definition on an object — Twenty's `IndexMetadata` distilled to
/// the fields we persist + can best-effort apply to the records collection.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct IndexMetadata {
    /// Index name (unique per object).
    pub name: String,
    /// Ordered list of field keys participating in the index.
    pub fields: Vec<String>,
    /// UNIQUE constraint. A single-field unique index is what drives a
    /// field's `isUnique` flag.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unique: Option<bool>,
    /// Physical index type (`BTREE` default).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub r#type: Option<IndexType>,
}

/// Definition of one object — superset of `sabcrm_core::ObjectMetadata`
/// with the Twenty-parity flags (`isSystem`, `isSearchable`),
/// `labelIdentifier` (which field key acts as the record title) and
/// first-class `indexes`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ObjectMetadata {
    pub slug: String,
    pub label_singular: String,
    pub label_plural: String,
    pub icon: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub standard: Option<bool>,
    pub views: Vec<String>,
    pub fields: Vec<FieldMetadata>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub board: Option<BoardMeta>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    // --- Twenty-parity additions (additive, optional) ---
    /// Internal object not surfaced as a normal CRM object. Mirrors
    /// Twenty's `ObjectMetadata.isSystem`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_system: Option<bool>,
    /// Whether records of this object are indexed into the search subsystem.
    /// Mirrors Twenty's `ObjectMetadata.isSearchable`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_searchable: Option<bool>,
    /// The field `key` that acts as the record's display label. Mirrors
    /// Twenty's `labelIdentifierFieldMetadataId` (we key by field `key`
    /// rather than a metadata id).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label_identifier: Option<String>,
    /// First-class index definitions for this object's records. Mirrors
    /// Twenty's `IndexMetadata` rows.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub indexes: Option<Vec<IndexMetadata>>,
}

impl ObjectMetadata {
    /// Build a wire `ObjectMetadata` from the canonical `sabcrm_core` shape.
    /// The Twenty-parity additions default to `None` (they are not modelled
    /// by the standard-object seed yet).
    pub fn from_core(core: sabcrm_core::ObjectMetadata) -> Self {
        let sabcrm_core::ObjectMetadata {
            slug,
            label_singular,
            label_plural,
            icon,
            standard,
            views,
            fields,
            board,
            description,
        } = core;

        Self {
            slug,
            label_singular,
            label_plural,
            icon,
            standard,
            views,
            fields: fields.into_iter().map(FieldMetadata::from_core).collect(),
            board: board.map(|b| BoardMeta {
                group_by_field: b.group_by_field,
            }),
            description,
            is_system: None,
            is_searchable: None,
            label_identifier: None,
            indexes: None,
        }
    }

    /// The slugs of the fields, for cheap membership checks during merges.
    pub fn has_field(&self, key: &str) -> bool {
        self.fields.iter().any(|f| f.key == key)
    }
}

impl FieldMetadata {
    /// Build a wire `FieldMetadata` from the canonical `sabcrm_core` shape.
    /// `settings` / `isUnique` default to `None`.
    pub fn from_core(core: sabcrm_core::FieldMetadata) -> Self {
        let sabcrm_core::FieldMetadata {
            key,
            label,
            r#type,
            icon,
            required,
            in_table,
            is_label,
            description,
            options,
            relation,
            default_value,
            system,
        } = core;

        Self {
            key,
            label,
            r#type,
            icon,
            required,
            in_table,
            is_label,
            description,
            options: options.map(|opts| {
                opts.into_iter()
                    .map(|o| SelectOption {
                        value: o.value,
                        label: o.label,
                        color: o.color,
                    })
                    .collect()
            }),
            relation: relation.map(|r| RelationMeta {
                target_object: r.target_object,
                kind: r.kind,
                label_field: r.label_field,
            }),
            default_value,
            system,
            settings: None,
            is_unique: None,
        }
    }
}

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

/// `PUT /{slug}/indexes` body — replace the object's index definitions.
/// Persists the defs verbatim and (best-effort) reconciles real indexes on
/// the records collection scoped by `projectId` + object slug.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SetIndexesInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// The full set of index definitions for this object (replaces any
    /// previously-persisted `indexes`).
    pub indexes: Vec<IndexMetadata>,
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
