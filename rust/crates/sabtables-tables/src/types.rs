//! On-disk shape of a `sabtables_tables` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

/// Exhaustive set of cell field-types supported by SabTables. Variants
/// serialize as snake_case strings on the wire (matching the TS literal
/// union in `src/lib/rust-client/sabtables-tables.ts`).
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SabtablesFieldType {
    #[default]
    Text,
    LongText,
    Number,
    Currency,
    Percent,
    Date,
    Datetime,
    Checkbox,
    SingleSelect,
    MultiSelect,
    Attachment,
    /// Foreign-key link to another table.
    Link,
    /// Computed: pull a field from a linked record.
    Lookup,
    Formula,
    /// Computed: aggregate over linked records.
    Rollup,
    /// Computed: count of linked records.
    Count,
    User,
    CreatedBy,
    CreatedAt,
    UpdatedBy,
    UpdatedAt,
    Url,
    Email,
    Phone,
    Rating,
    Duration,
    Autonumber,
}

/// A single field-definition embedded inside a Table document. Options
/// vary by `field_type` and are kept as free-form BSON so we don't have
/// to model 25 typed payload shapes here.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabtablesField {
    /// Stable id used by Records / Views to reference this column.
    pub id: String,
    pub name: String,
    pub field_type: SabtablesFieldType,
    /// Per-type config — select-options, currency code, link.tableId,
    /// formula expression, rollup aggregation, etc.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub options: Option<bson::Bson>,
    /// Optional ordering hint (lower = leftmost). Frontend may instead
    /// rely on array order.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub order: Option<i32>,
    #[serde(default)]
    pub is_required: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabtablesTable {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,

    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub base_id: ObjectId,

    pub name: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /// Field id (matches `SabtablesField::id`) of the row-title column.
    pub primary_field_id: String,

    pub fields: Vec<SabtablesField>,

    /// Cached count — recomputed on insert/delete by the records crate.
    #[serde(default)]
    pub records_count: u64,

    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
