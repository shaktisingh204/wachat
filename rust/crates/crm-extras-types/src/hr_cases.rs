//! §12.28 HR Disciplinary Cases + Awards / Recognitions.
//!
//! Mongo collections: `crm_disciplinary_cases`, `crm_award_programs`.
//! A disciplinary case captures the type, employee, raised-by, severity,
//! evidence, hearings, decision and appeal. An award program carries a
//! nomination window, voting method, nominations log, winner, payout
//! and certificate template.
//!
//! Both top-level structs flatten the `crm-core` `Identity` + `Audit`
//! fragments so the document root carries §0 ownership and audit fields
//! directly.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Audit, Identity};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CaseSeverity {
    #[default]
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CaseStatus {
    #[default]
    Open,
    Investigating,
    Hearing,
    Decided,
    Appealed,
    Closed,
}

/// One scheduled hearing in the case.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Hearing {
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub at: DateTime<Utc>,
    /// Members of the disciplinary panel.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub panel_ids: Vec<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub location: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
}

/// One piece of evidence attached to a case.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvidenceItem {
    /// `"document" | "witness" | "recording" | "chat_log"`.
    pub kind: String,
    /// SabFiles id when the evidence is a file. Witness statements may
    /// have only `description`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub file_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub submitted_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DisciplinaryCase {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /// `"misconduct" | "performance" | "attendance" | "harassment"`.
    pub case_type: String,
    pub employee_id: ObjectId,
    pub raised_by_id: ObjectId,
    #[serde(default)]
    pub severity: CaseSeverity,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub evidence: Vec<EvidenceItem>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub hearings: Vec<Hearing>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub decision: Option<String>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub decided_at: Option<DateTime<Utc>>,
    /// Free-form appeal status (`"pending"`, `"upheld"`, `"overturned"`,
    /// …). `None` when no appeal has been raised.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub appeal_status: Option<String>,
    #[serde(default)]
    pub status: CaseStatus,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
}

/// One nomination inside an `AwardProgram`. Embedded rather than its
/// own collection because nominations are scoped to (and short-lived
/// with) the program.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Nomination {
    pub nominee_id: ObjectId,
    pub nominated_by_id: ObjectId,
    pub reason: String,
    #[serde(default)]
    pub vote_count: u32,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AwardProgram {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    pub name: String,
    pub criteria: String,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub nomination_open_from: DateTime<Utc>,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub nomination_open_until: DateTime<Utc>,
    /// `"panel" | "public" | "manager"`.
    pub voting_method: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub nominations: Vec<Nomination>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub winner_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub payout_amount: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,
    /// FK into the project's templates collection. Drives the
    /// certificate PDF the program issues to its winner.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub certificate_template_id: Option<ObjectId>,
    /// `"open" | "voting" | "decided" | "closed"`.
    pub status: String,
}

/* ============================================================== */
/*  Tests                                                          */
/* ============================================================== */

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    fn identity() -> Identity {
        Identity {
            id: ObjectId::new(),
            project_id: ObjectId::new(),
            user_id: ObjectId::new(),
            tenant_id: None,
        }
    }

    fn audit() -> Audit {
        let now = Utc::now();
        Audit {
            created_at: now,
            updated_at: now,
            created_by: None,
            updated_by: None,
        }
    }

    #[test]
    fn disciplinary_case_round_trips_with_flattened_fragments() {
        let case = DisciplinaryCase {
            identity: identity(),
            audit: audit(),
            case_type: "misconduct".to_string(),
            employee_id: ObjectId::new(),
            raised_by_id: ObjectId::new(),
            severity: CaseSeverity::High,
            evidence: vec![EvidenceItem {
                kind: "document".to_string(),
                file_id: Some(ObjectId::new()),
                description: Some("CCTV log".to_string()),
                submitted_at: Utc::now(),
            }],
            hearings: vec![Hearing {
                at: Utc::now(),
                panel_ids: vec![ObjectId::new(), ObjectId::new()],
                location: Some("HR Room 2".to_string()),
                summary: None,
            }],
            decision: None,
            decided_at: None,
            appeal_status: None,
            status: CaseStatus::Investigating,
            notes: None,
        };

        let json = serde_json::to_value(&case).unwrap();
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());
        assert!(json.get("caseType").is_some());
        assert_eq!(json.get("severity").unwrap(), "high");
        assert_eq!(json.get("status").unwrap(), "investigating");

        let back: DisciplinaryCase = serde_json::from_value(json).unwrap();
        assert_eq!(back.case_type, "misconduct");
        assert!(matches!(back.severity, CaseSeverity::High));
        assert!(matches!(back.status, CaseStatus::Investigating));
        assert_eq!(back.evidence.len(), 1);
        assert_eq!(back.hearings[0].panel_ids.len(), 2);
    }

    #[test]
    fn award_program_round_trips() {
        let program = AwardProgram {
            identity: identity(),
            audit: audit(),
            name: "Engineer of the Quarter".to_string(),
            criteria: "Top reviews + delivery".to_string(),
            nomination_open_from: Utc::now(),
            nomination_open_until: Utc::now(),
            voting_method: "panel".to_string(),
            nominations: vec![Nomination {
                nominee_id: ObjectId::new(),
                nominated_by_id: ObjectId::new(),
                reason: "Shipped Q1 OKRs".to_string(),
                vote_count: 5,
                at: Utc::now(),
            }],
            winner_id: None,
            payout_amount: Some(25_000.0),
            currency: Some("INR".to_string()),
            certificate_template_id: Some(ObjectId::new()),
            status: "voting".to_string(),
        };

        let json = serde_json::to_value(&program).unwrap();
        assert!(json.get("nominationOpenFrom").is_some());
        assert!(json.get("votingMethod").is_some());
        assert!(json.get("certificateTemplateId").is_some());

        let back: AwardProgram = serde_json::from_value(json).unwrap();
        assert_eq!(back.name, "Engineer of the Quarter");
        assert_eq!(back.nominations.len(), 1);
        assert_eq!(back.payout_amount, Some(25_000.0));
    }
}
