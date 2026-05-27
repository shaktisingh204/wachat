//! On-disk shape of a `sabworkerly_payroll_runs` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabworkerlyPayrollLine {
    pub worker_id: ObjectId,
    pub hours: f64,
    /// Hourly pay rate, in minor units.
    pub rate: i64,
    /// hours × rate, in minor units.
    pub amount_minor: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabworkerlyPayrollRun {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub period_start: BsonDateTime,
    pub period_end: BsonDateTime,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub timesheet_ids: Vec<ObjectId>,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub line_items: Vec<SabworkerlyPayrollLine>,

    pub total_minor: i64,
    pub currency: String,

    /// `draft | approved | paid`.
    pub status: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub processed_at: Option<BsonDateTime>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
