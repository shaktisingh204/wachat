//! On-disk shape of a `sabbi_models` document — the SabBI semantic layer.
//!
//! A **model** is the governed center of gravity: it names a base collection
//! and a reusable vocabulary of **measures** (aggregations), **dimensions**
//! (grouping/axis fields), **joins** (cross-collection `$lookup`s), and
//! **segments** (named reusable filters). Charts, dashboards, the AI copilot,
//! and embeds all author a `MetricQuery` against a model rather than touching
//! raw collections, so "revenue", "win rate", etc. are defined once.

use bson::{DateTime as BsonDateTime, Document, oid::ObjectId};
use serde::{Deserialize, Serialize};

/// A reusable aggregation defined on a model (e.g. `sum(amount)` as "Revenue").
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Measure {
    /// Stable key referenced by a `MetricQuery` (e.g. `"revenue"`).
    pub key: String,
    /// Human label shown in builders/catalogs.
    pub label: String,
    /// `sum` | `avg` | `min` | `max` | `count` | `count_distinct`.
    pub agg: String,
    /// Column the aggregation runs over. Ignored for `count`; required for the
    /// rest. Dotted paths (e.g. `data.amount`) are allowed.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub column: Option<String>,
    /// Display format hint: `currency` | `percent` | `number` | `duration`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub format: Option<String>,
    /// When true, a downward movement is the "good" direction (KPI colouring).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub down_is_good: Option<bool>,
}

/// A grouping/axis field defined on a model (e.g. `stage`, `createdAt`).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Dimension {
    /// Stable key referenced by a `MetricQuery` (e.g. `"stage"`).
    pub key: String,
    pub label: String,
    /// Source column (dotted paths allowed).
    pub column: String,
    /// `string` | `number` | `date` | `boolean`.
    pub kind: String,
    /// For `date` dimensions, the default truncation grain: `day`|`week`|`month`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub time_grain: Option<String>,
}

/// A cross-collection join resolved as a `$lookup` at query time.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Join {
    pub key: String,
    /// Collection to `$lookup` from.
    pub target_collection: String,
    /// Field on the base collection.
    pub local_field: String,
    /// Field on the target collection.
    pub foreign_field: String,
    /// Alias the joined documents are attached under.
    pub alias: String,
    /// `one` | `many` — informational (drives unwind behaviour downstream).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub kind: Option<String>,
}

/// A named, reusable filter (e.g. "Won deals" = `status eq won`).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Segment {
    pub key: String,
    pub label: String,
    /// Reusable filter clauses, same `{ column, op, value }` shape the chart
    /// engine understands.
    #[serde(default)]
    pub filters: Vec<Document>,
}

/// A governed semantic model stored in `sabbi_models`, tenant-scoped by the
/// `userId` field (which holds the project/tenant id — see `crm_common::tenant`).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BiModel {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /// Base Mongo collection the model reads from (e.g. `sabcrm_records`).
    pub collection: String,
    /// Always-applied filter merged into every query's `$match` (e.g.
    /// `{ "object": "leads" }` so a CRM model targets one object slug).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub base_filter: Option<Document>,

    /// The field in `collection` that holds the tenant key. Modules differ —
    /// SabCRM uses `projectId`, most others `userId`, SabChat `tenantId`.
    /// Defaults to `userId` (SabBI's own collections).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scope_field: Option<String>,
    /// Which JWT id to match `scope_field` against: `project` (the active
    /// project / `tid` claim) or `user` (the acting user / `sub`). Defaults to
    /// `project`. Lets a connector read a per-user-scoped module correctly even
    /// though SabBI's own tenant is the project.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scope_by: Option<String>,
    /// Whether `scope_field` is stored as a **string** rather than an
    /// `ObjectId`. Modules differ: SabCRM stores `projectId` as a string,
    /// SabPay stores `userId` as an `ObjectId`. Defaults to `false` (ObjectId).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scope_string: Option<bool>,

    #[serde(default)]
    pub measures: Vec<Measure>,
    #[serde(default)]
    pub dimensions: Vec<Dimension>,
    #[serde(default)]
    pub joins: Vec<Join>,
    #[serde(default)]
    pub segments: Vec<Segment>,

    /// `manual` | `connector` — how the model was created.
    pub source: String,
    /// When `source == "connector"`, which module seeded it
    /// (`crm` | `pay` | `chat` | `mail` | `sms` | `flow` | `sign` | `sites`).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub connector: Option<String>,

    /// `active` | `archived`.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
