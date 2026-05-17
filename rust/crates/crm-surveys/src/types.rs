//! On-disk shape of a `crm_surveys` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmSurveyQuestion {
    pub label: String,
    /// `"short_text"` | `"long_text"` | `"single_choice"`
    /// | `"multiple_choice"` | `"rating"` | `"boolean"`.
    #[serde(rename = "type")]
    pub question_type: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub required: Option<bool>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub options: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmSurvey {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub title: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /// `"engagement"` | `"exit"` | `"onboarding"` | `"pulse"` | `"custom"`.
    #[serde(rename = "type", default, skip_serializing_if = "Option::is_none")]
    pub survey_type: Option<String>,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub questions: Vec<CrmSurveyQuestion>,

    /// `"all"` | `"department"` | `"team"` | `"role"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub target_audience: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub audience_ids: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub anonymous: Option<bool>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub starts_at: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ends_at: Option<BsonDateTime>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub response_count: Option<i32>,

    /// `"draft"` | `"active"` | `"closed"` | `"archived"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
