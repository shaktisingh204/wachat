//! On-disk shape of a `crm_probations` document.
//!
//! Mirrors the TS source-of-truth in
//! `src/app/actions/crm-probation.actions.ts`. Field names are
//! camelCase (employeeId, employeeName, startDate, endDate,
//! evaluatorId, evaluatorName, overallScore) per Employee Transitions §2.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProbationCriterion {
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub target: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub achieved: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub score: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmProbation {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub employee_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub employee_name: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub start_date: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub end_date: Option<BsonDateTime>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub evaluator_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub evaluator_name: Option<String>,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub criteria: Vec<ProbationCriterion>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub overall_score: Option<f64>,

    /// `"confirm"` | `"extend"` | `"terminate"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub recommendation: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,

    /// `"in_progress"` | `"confirmed"` | `"extended"` | `"terminated"`
    /// | `"archived"`.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
