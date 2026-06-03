//! §10 Learning — Training Programs, Employee Certifications, and
//! Learning Paths (with per-employee progress tracking). Each
//! top-level entity flattens `crm-core` `Identity` + `Audit`.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Audit, Identity};
use serde::{Deserialize, Serialize};

/* =============================================================== */
/* Training Programs                                               */
/* =============================================================== */

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingAttendance {
    pub employee_id: ObjectId,
    #[serde(default)]
    pub attended: bool,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub attended_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingScore {
    pub employee_id: ObjectId,
    pub score: f32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub certificate_file_id: Option<ObjectId>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingProgram {
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    pub title: String,
    /// "online" | "in_person" | "hybrid"
    pub mode: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub instructor: Option<String>,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub scheduled_start: DateTime<Utc>,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub scheduled_end: DateTime<Utc>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub capacity: Option<u32>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub attendance: Vec<TrainingAttendance>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub scores: Vec<TrainingScore>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub certificate_template_id: Option<ObjectId>,
    pub status: String,
}

/* =============================================================== */
/* Certifications                                                  */
/* =============================================================== */

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmployeeCertification {
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    pub employee_id: ObjectId,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub issuer: Option<String>,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub issued: DateTime<Utc>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub expiry: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub file_id: Option<ObjectId>,
    #[serde(default)]
    pub verified: bool,
}

/* =============================================================== */
/* Learning Paths                                                  */
/* =============================================================== */

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LearningPathStep {
    pub id: ObjectId,
    pub label: String,
    /// "training" | "reading" | "task"
    pub kind: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub target_id: Option<ObjectId>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LearningPath {
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub steps: Vec<LearningPathStep>,
    /// FK ids of paths that must be completed first.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub prerequisites: Vec<ObjectId>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LearningPathProgress {
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    pub path_id: ObjectId,
    pub employee_id: ObjectId,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub completed_step_ids: Vec<ObjectId>,
    pub completion_pct: f32,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub started_at: DateTime<Utc>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub completed_at: Option<DateTime<Utc>>,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ident() -> Identity {
        Identity {
            id: ObjectId::new(),
            project_id: ObjectId::new(),
            user_id: ObjectId::new(),
            tenant_id: None,
        }
    }

    fn audit() -> Audit {
        Audit {
            created_at: Utc::now(),
            updated_at: Utc::now(),
            created_by: None,
            updated_by: None,
        }
    }

    #[test]
    fn training_program_round_trips_with_flattened_fragments() {
        let program = TrainingProgram {
            identity: ident(),
            audit: audit(),
            title: "AWS Fundamentals".into(),
            mode: "online".into(),
            instructor: Some("Jane Doe".into()),
            scheduled_start: Utc::now(),
            scheduled_end: Utc::now(),
            capacity: Some(30),
            attendance: vec![TrainingAttendance {
                employee_id: ObjectId::new(),
                attended: true,
                attended_at: Some(Utc::now()),
            }],
            scores: vec![],
            certificate_template_id: None,
            status: "scheduled".into(),
        };

        let json = serde_json::to_value(&program).unwrap();
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("scheduledStart").is_some());
        assert_eq!(json.get("mode").and_then(|v| v.as_str()), Some("online"));
        let back: TrainingProgram = serde_json::from_value(json).unwrap();
        assert_eq!(back.title, "AWS Fundamentals");
    }
}
