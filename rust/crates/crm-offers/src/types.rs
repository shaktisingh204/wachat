//! On-disk shape of a `crm_offers` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmOffer {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub candidate_id: ObjectId,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub candidate_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub job_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub job_title: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub offer_letter_url: Option<String>,

    pub salary_amount: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub salary_currency: Option<String>,
    /// `"annual"` | `"monthly"` | `"hourly"`.
    pub salary_period: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bonus: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub equity: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub benefits: Vec<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub joining_date: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,

    /// `"draft"` | `"sent"` | `"accepted"` | `"rejected"` | `"expired"` | `"withdrawn"` | `"archived"`.
    pub status: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sent_at: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub responded_at: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub response_notes: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub approver_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub approved_at: Option<BsonDateTime>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
