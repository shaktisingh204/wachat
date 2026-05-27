//! On-disk shape of a `sabpractice_engagements` document.

use bson::{Bson, DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabPracticeEngagement {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub client_id: ObjectId,

    pub name: String,

    /// Free-form structured scope — any JSON shape. Stored as BSON.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scope_json: Option<Bson>,

    pub start_date: BsonDateTime,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub end_date: Option<BsonDateTime>,

    /// `active` | `paused` | `completed`. Free-form for legacy.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,

    /// Hourly rate in minor currency units (cents/paise).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub hourly_rate_minor: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,

    /// `monthly` | `quarterly` | `on_completion`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub billing_cadence: Option<String>,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub assigned_user_ids: Vec<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
