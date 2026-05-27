//! On-disk shape of a `sabworkerly_jobs` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabworkerlyJob {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub client_id: ObjectId,

    pub title: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub skills_required: Vec<String>,

    /// Free-form shift pattern label (e.g. "Mon–Fri 9-5").
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub shift_pattern: Option<String>,

    /// What the client pays the agency per hour (minor units).
    pub hourly_charge_rate_minor: i64,
    /// What the agency pays the worker per hour (minor units).
    pub hourly_pay_rate_minor: i64,
    pub currency: String,

    pub start_date: BsonDateTime,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub end_date: Option<BsonDateTime>,

    /// `open | filled | closed`.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
