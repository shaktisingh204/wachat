//! §10 Recruitment cluster.
//!
//! Job postings → candidates (ATS) → interviews → offers, plus a
//! self-service careers-page document. Every top-level entity flattens
//! the standard `crm-core` fragments (`Identity`, `Audit`, and where
//! appropriate `Assignment`) so the document root carries the §0
//! ownership / audit / assignment fields directly.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Assignment, Audit, Identity};
use serde::{Deserialize, Serialize};

/* ============================================================ *
 * 1. Job Postings                                              *
 * ============================================================ */

/// One row in the careers page / requisition list.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JobPosting {
    /* ----- crm-core fragments (flattened) ------------------- */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    pub title: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub location: Option<String>,

    /// FK into the org's department collection. Optional because
    /// early-stage tenants often skip the department dimension.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub department_id: Option<ObjectId>,

    /// Free-form: `"full_time" | "part_time" | "contract" | "intern" | "consultant"`.
    pub employment_type: String,

    pub openings: u32,

    /// Job description (HTML / markdown — renderer's choice).
    pub jd: String,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub required_skills: Vec<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub salary_min: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub salary_max: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub salary_currency: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub experience_years_min: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub experience_years_max: Option<f32>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub education: Option<String>,

    /// Free-form: `"draft" | "open" | "on_hold" | "closed"`.
    pub status: String,

    /// Whether the posting is rendered on the public careers page.
    pub careers_page_visible: bool,

    /// Auto-close timestamp. `None` = never expires.
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub expiry: Option<DateTime<Utc>>,
}

/* ============================================================ *
 * 2. Candidates                                                *
 * ============================================================ */

/// One panellist's score on a single criterion (e.g. "Communication").
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CandidateRating {
    pub criterion: String,
    pub score: f32,
    pub by: ObjectId,
}

/// Compact summary of an interview round on the candidate timeline.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InterviewHistoryEntry {
    pub interview_id: ObjectId,
    pub round: u8,
    /// `"pending" | "advance" | "reject" | "hold"`.
    pub decision: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub score: Option<f32>,
}

/// Full ATS profile.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Candidate {
    /* ----- crm-core fragments (flattened) ------------------- */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,
    /// `assignedTo` carries the recruiter who owns the candidate.
    #[serde(flatten)]
    pub assignment: Assignment,

    pub full_name: String,
    pub email: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub phone: Option<String>,

    /// SabFiles file id for the parsed resume PDF.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub resume_file_id: Option<ObjectId>,

    /// Skills lifted out of the resume by the parser.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub parsed_skills: Vec<String>,

    /// `"linkedin" | "referral" | "careers_page" | ...`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,

    /// Posting the candidate applied to (None for talent-pool entries).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub job_posting_id: Option<ObjectId>,

    /// `"applied" | "shortlisted" | "interviewing" | "offered" | "hired" | "rejected"`.
    pub stage: String,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub ratings: Vec<CandidateRating>,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub interview_history: Vec<InterviewHistoryEntry>,

    /// `"none" | "pending" | "accepted" | "declined"`.
    pub offer_status: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub current_ctc: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expected_ctc: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notice_period_days: Option<u32>,
}

/* ============================================================ *
 * 3. Interviews                                                *
 * ============================================================ */

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum InterviewMode {
    #[default]
    Onsite,
    Video,
    Phone,
}

/// One panellist's structured feedback on an interview.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InterviewFeedback {
    pub panelist_id: ObjectId,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub score: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
    /// `"pending" | "advance" | "reject" | "hold"`.
    pub decision: String,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Interview {
    /* ----- crm-core fragments (flattened) ------------------- */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    pub candidate_id: ObjectId,
    pub job_posting_id: ObjectId,
    pub round: u8,

    /// Employees making up the interview panel.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub panel_ids: Vec<ObjectId>,

    pub mode: InterviewMode,

    /// Video-call URL, room number, or phone-bridge code — depends on `mode`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub link: Option<String>,

    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub slot_start: DateTime<Utc>,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub slot_end: DateTime<Utc>,

    /// FK into the project's feedback-form templates collection.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub feedback_form_id: Option<ObjectId>,

    /// `"scheduled" | "completed" | "cancelled" | "no_show"`.
    pub status: String,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub feedback: Vec<InterviewFeedback>,
}

/* ============================================================ *
 * 4. Offers                                                    *
 * ============================================================ */

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Offer {
    /* ----- crm-core fragments (flattened) ------------------- */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    pub candidate_id: ObjectId,

    /// FK into the project's offer-letter templates collection.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub template_id: Option<ObjectId>,

    pub ctc: f64,
    pub currency: String,

    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub joining_date: DateTime<Utc>,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub validity: DateTime<Utc>,

    /// `"digio" | "docusign" | ...`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub esign_provider: Option<String>,
    /// Provider-side document handle (string — providers vary in shape).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub esign_doc_id: Option<String>,

    /// `"draft" | "sent" | "signed" | "declined" | "expired"`.
    pub status: String,

    /// SabFiles file id for the rendered PDF.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub file_id: Option<ObjectId>,
}

/* ============================================================ *
 * 5. Careers Page                                              *
 * ============================================================ */

/// Public careers-page configuration. One per project (or a few — the
/// slug uniquely addresses each).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CareersPage {
    /* ----- crm-core fragments (flattened) ------------------- */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /// Public URL slug — `/careers/<slug>`.
    pub slug: String,

    /// Opaque theme blob: colour palette, typography, hero image ids.
    /// Stored as JSON so the renderer can evolve without DTO churn.
    pub theme: serde_json::Value,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub intro_html: Option<String>,

    /// Subset of `JobPosting._id`s rendered on this page.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub visible_job_posting_ids: Vec<ObjectId>,

    /// Application-form field definitions (label, type, required, options …).
    /// Opaque JSON — same form-builder schema used elsewhere.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub application_form_fields: Vec<serde_json::Value>,
}

/* ============================================================ *
 * Tests                                                        *
 * ============================================================ */

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    fn ident() -> Identity {
        Identity {
            id: ObjectId::new(),
            project_id: ObjectId::new(),
            user_id: ObjectId::new(),
            tenant_id: None,
        }
    }

    fn audit() -> Audit {
        Audit::new(None)
    }

    #[test]
    fn job_posting_round_trips_with_flattened_fragments() {
        let posting = JobPosting {
            identity: ident(),
            audit: audit(),
            title: "Senior Rust Engineer".to_string(),
            location: Some("Bengaluru".to_string()),
            department_id: Some(ObjectId::new()),
            employment_type: "full_time".to_string(),
            openings: 2,
            jd: "<p>Build SabNode internals.</p>".to_string(),
            required_skills: vec!["rust".to_string(), "tokio".to_string()],
            salary_min: Some(2_500_000.0),
            salary_max: Some(4_000_000.0),
            salary_currency: Some("INR".to_string()),
            experience_years_min: Some(4.0),
            experience_years_max: Some(8.0),
            education: Some("B.E. / B.Tech".to_string()),
            status: "open".to_string(),
            careers_page_visible: true,
            expiry: Some(Utc::now()),
        };

        let json = serde_json::to_value(&posting).unwrap();

        // Identity flattened to the document root.
        assert!(json.get("_id").is_some(), "_id must be at root");
        assert!(json.get("projectId").is_some(), "projectId must be at root");
        assert!(json.get("userId").is_some(), "userId must be at root");

        // Audit flattened, no nested envelope keys.
        assert!(json.get("createdAt").is_some(), "createdAt must be at root");
        assert!(
            json.get("identity").is_none(),
            "identity must NOT be nested"
        );
        assert!(json.get("audit").is_none(), "audit must NOT be nested");

        // camelCase entity fields.
        assert!(json.get("employmentType").is_some());
        assert!(json.get("careersPageVisible").is_some());
        assert!(json.get("requiredSkills").is_some());

        let back: JobPosting = serde_json::from_value(json).unwrap();
        assert_eq!(back.title, "Senior Rust Engineer");
        assert_eq!(back.openings, 2);
        assert_eq!(back.status, "open");
    }

    #[test]
    fn candidate_round_trips_with_assignment_and_history() {
        let interview_id = ObjectId::new();
        let recruiter_id = ObjectId::new();

        let candidate = Candidate {
            identity: ident(),
            audit: audit(),
            assignment: Assignment {
                assigned_to: Some(recruiter_id),
                ..Default::default()
            },
            full_name: "Asha Iyer".to_string(),
            email: "asha@example.com".to_string(),
            phone: Some("+91-9000000000".to_string()),
            resume_file_id: Some(ObjectId::new()),
            parsed_skills: vec!["rust".to_string(), "mongodb".to_string()],
            source: Some("careers_page".to_string()),
            job_posting_id: Some(ObjectId::new()),
            stage: "interviewing".to_string(),
            ratings: vec![CandidateRating {
                criterion: "Communication".to_string(),
                score: 4.5,
                by: ObjectId::new(),
            }],
            interview_history: vec![InterviewHistoryEntry {
                interview_id,
                round: 1,
                decision: "advance".to_string(),
                score: Some(4.2),
            }],
            offer_status: "none".to_string(),
            current_ctc: Some(1_800_000.0),
            expected_ctc: Some(3_000_000.0),
            notice_period_days: Some(60),
        };

        let json = serde_json::to_value(&candidate).unwrap();

        // Flattened fragments at root.
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        assert!(json.get("createdAt").is_some());
        // bson::ObjectId serializes through serde_json as
        // `{"$oid": "<hex>"}` (extjson form), not a bare hex string.
        assert_eq!(
            json.pointer("/assignedTo/$oid").and_then(|v| v.as_str()),
            Some(recruiter_id.to_hex().as_str())
        );
        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());
        assert!(json.get("assignment").is_none());

        // camelCase entity fields.
        assert!(json.get("fullName").is_some());
        assert!(json.get("parsedSkills").is_some());
        assert!(json.get("interviewHistory").is_some());
        assert!(json.get("offerStatus").is_some());
        assert!(json.get("noticePeriodDays").is_some());

        let back: Candidate = serde_json::from_value(json).unwrap();
        assert_eq!(back.full_name, "Asha Iyer");
        assert_eq!(back.stage, "interviewing");
        assert_eq!(back.interview_history.len(), 1);
        assert_eq!(back.interview_history[0].interview_id, interview_id);
    }

    #[test]
    fn interview_mode_serializes_lowercase() {
        let interview = Interview {
            identity: ident(),
            audit: audit(),
            candidate_id: ObjectId::new(),
            job_posting_id: ObjectId::new(),
            round: 2,
            panel_ids: vec![ObjectId::new(), ObjectId::new()],
            mode: InterviewMode::Video,
            link: Some("https://meet.example.com/abc".to_string()),
            slot_start: Utc::now(),
            slot_end: Utc::now(),
            feedback_form_id: None,
            status: "scheduled".to_string(),
            feedback: vec![],
        };

        let json = serde_json::to_value(&interview).unwrap();
        assert_eq!(json.get("mode").and_then(|v| v.as_str()), Some("video"));
        assert!(json.get("panelIds").is_some());
        assert!(json.get("slotStart").is_some());

        let back: Interview = serde_json::from_value(json).unwrap();
        assert_eq!(back.mode, InterviewMode::Video);
        assert_eq!(back.round, 2);
    }
}
