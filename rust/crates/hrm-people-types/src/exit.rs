//! §10 Exit & Comp — Exits, Succession Plans, Compensation Bands,
//! Announcements, and the Policy Library. Each top-level entity
//! flattens `crm-core` `Identity` + `Audit`.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Audit, Identity};
use serde::{Deserialize, Serialize};

/* =============================================================== */
/* Exits                                                           */
/* =============================================================== */

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ExitType {
    #[default]
    Resignation,
    Termination,
    Retirement,
    EndOfContract,
    Death,
    Other,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Exit {
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    pub employee_id: ObjectId,
    #[serde(default)]
    pub exit_type: ExitType,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub notice_start: DateTime<Utc>,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub last_day: DateTime<Utc>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fnf_amount: Option<f64>,
    /// "pending" | "computed" | "paid"
    pub fnf_status: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub exit_interview_summary: Option<String>,
    /// "pending" | "issued"
    pub noc_status: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub noc_file_id: Option<ObjectId>,
    /// "pending" | "complete"
    pub asset_return_status: String,
    #[serde(default)]
    pub knowledge_transfer_done: bool,
}

/* =============================================================== */
/* Succession Plans                                                */
/* =============================================================== */

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SuccessionCandidate {
    pub employee_id: ObjectId,
    /// "ready_now" | "ready_1y" | "ready_2y" | "high_potential"
    pub readiness: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SuccessionPlan {
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    pub role_designation_id: ObjectId,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub candidates: Vec<SuccessionCandidate>,
}

/* =============================================================== */
/* Compensation Bands                                              */
/* =============================================================== */

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompensationBand {
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    pub level: String,
    pub min_ctc: f64,
    pub mid_ctc: f64,
    pub max_ctc: f64,
    pub currency: String,
}

/* =============================================================== */
/* Announcements                                                   */
/* =============================================================== */

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Announcement {
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    pub title: String,
    pub body: String,
    /// "all" | "department" | "role"
    pub audience: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub audience_value: Option<String>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub scheduled_for: Option<DateTime<Utc>>,
    /// "email" | "slack" | "in_app"
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub channels: Vec<String>,
    #[serde(default)]
    pub sent: bool,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub sent_at: Option<DateTime<Utc>>,
}

/* =============================================================== */
/* Policy Library                                                  */
/* =============================================================== */

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PolicyAcknowledgement {
    pub employee_id: ObjectId,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub acknowledged_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Policy {
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    pub name: String,
    pub version: String,
    /// SabFiles file id with the canonical PDF.
    pub file_id: ObjectId,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub effective_from: DateTime<Utc>,
    #[serde(default)]
    pub requires_acknowledgement: bool,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub acknowledgements: Vec<PolicyAcknowledgement>,
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
    fn exit_round_trips_with_flattened_fragments() {
        let exit = Exit {
            identity: ident(),
            audit: audit(),
            employee_id: ObjectId::new(),
            exit_type: ExitType::EndOfContract,
            notice_start: Utc::now(),
            last_day: Utc::now(),
            fnf_amount: Some(125_000.0),
            fnf_status: "computed".into(),
            exit_interview_summary: Some("Positive".into()),
            noc_status: "pending".into(),
            noc_file_id: None,
            asset_return_status: "complete".into(),
            knowledge_transfer_done: true,
        };

        let json = serde_json::to_value(&exit).unwrap();
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("employeeId").is_some());
        assert_eq!(
            json.get("exitType").and_then(|v| v.as_str()),
            Some("end_of_contract"),
            "ExitType serializes snake_case"
        );
        let back: Exit = serde_json::from_value(json).unwrap();
        assert_eq!(back.exit_type, ExitType::EndOfContract);
        assert_eq!(back.fnf_status, "computed");
    }
}
