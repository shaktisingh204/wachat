//! On-disk shape of a `crm_disciplinary_cases` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DisciplinaryHearing {
    pub date: BsonDateTime,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub outcome: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmDisciplinaryCase {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub employee_name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub employee_id: Option<ObjectId>,

    /// `"misconduct"` | `"performance"` | `"attendance"` | `"other"`.
    pub case_type: String,
    /// `"minor"` | `"major"` | `"severe"`.
    pub severity: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub raised_by: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub incident_date: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,

    #[serde(default)]
    pub evidence: Vec<String>,
    #[serde(default)]
    pub hearings: Vec<DisciplinaryHearing>,

    /// `"open"` | `"investigating"` | `"resolved"` | `"closed"` | `"archived"`.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
