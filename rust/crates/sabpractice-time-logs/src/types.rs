//! On-disk shape of a `sabpractice_time_logs` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabPracticeTimeLog {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub task_id: ObjectId,
    /// Cached for filter/rollup performance.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub engagement_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub client_id: Option<ObjectId>,

    /// Whoever did the work — string user id (firm staff).
    pub logger_user_id: String,

    pub date: BsonDateTime,
    pub hours: f64,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,

    #[serde(default)]
    pub billable: bool,

    /// Bound when the row gets rolled into an invoice.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub billed_invoice_id: Option<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
