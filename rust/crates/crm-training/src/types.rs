//! On-disk shape of a `crm_trainings` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmTraining {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /// `"onboarding"` | `"compliance"` | `"technical"` | `"soft_skills"` | `"leadership"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub training_type: Option<String>,

    /// `"classroom"` | `"online"` | `"hybrid"` | `"self_paced"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub delivery_mode: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub trainer_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub trainer_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub provider: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub start_date: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub end_date: Option<BsonDateTime>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub duration_hours: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub location: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_participants: Option<i32>,

    /// Denormalized count of enrolled participants.
    #[serde(default)]
    pub enrolled: i32,
    /// Denormalized count of participants that completed the training.
    #[serde(default)]
    pub completed: i32,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cost_per_person: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,

    #[serde(default)]
    pub certification_provided: bool,

    /// SabFile reference for course materials.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub materials_url: Option<String>,

    #[serde(default)]
    pub is_mandatory: bool,

    #[serde(default)]
    pub department_ids: Vec<ObjectId>,

    /// `"planned"` | `"open_for_enrollment"` | `"in_progress"` | `"completed"` | `"cancelled"` | `"archived"`.
    pub status: String,

    #[serde(default)]
    pub tags: Vec<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
