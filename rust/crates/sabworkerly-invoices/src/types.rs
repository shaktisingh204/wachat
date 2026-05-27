//! On-disk shape of a `sabworkerly_invoices` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabworkerlyInvoiceLine {
    pub placement_id: ObjectId,
    pub worker_name: String,
    pub hours: f64,
    /// Hourly charge rate in minor units.
    pub rate: i64,
    /// hours × rate, in minor units.
    pub amount_minor: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabworkerlyInvoice {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub client_id: ObjectId,
    pub period_start: BsonDateTime,
    pub period_end: BsonDateTime,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub timesheet_ids: Vec<ObjectId>,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub line_items: Vec<SabworkerlyInvoiceLine>,

    pub total_minor: i64,
    pub currency: String,

    /// `draft | sent | paid | overdue`.
    pub status: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sent_at: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub paid_at: Option<BsonDateTime>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
