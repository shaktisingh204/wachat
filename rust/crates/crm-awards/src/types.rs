//! On-disk shape of a `crm_award_programs` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AwardNomination {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub nominee: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub nominee_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub nominated_at: Option<BsonDateTime>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AwardWinner {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub recipient: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub recipient_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub awarded_at: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub citation: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmAwardProgram {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub name: String,
    /// `"recognition"` | `"incentive"` | `"spot"` | `"annual"`.
    pub program_type: String,
    /// `"monthly"` | `"quarterly"` | `"annual"` | `"adhoc"`.
    pub frequency: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub period_start: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub period_end: Option<BsonDateTime>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub criteria: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub points_value: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cash_value: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    #[serde(default)]
    pub nominations: Vec<AwardNomination>,
    #[serde(default)]
    pub winners: Vec<AwardWinner>,

    /// `"draft"` | `"active"` | `"closed"` | `"archived"`.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
