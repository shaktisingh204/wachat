//! §9.10 Performance & Appraisal — DTOs.
//!
//! Mongo collection: `crm_appraisals` (top-level `AppraisalReview`).
//! `Goal` and `Kpi` are first-class siblings in the same module — they
//! also persist as their own documents (`crm_goals` / `crm_kpis`) and
//! feed an appraisal cycle. All three flatten the `crm-core`
//! `Identity` + `Audit` fragments.
//!
//! Spec (§9.10 verbatim):
//! > Goal Setting, KPI Tracking, Appraisal Reviews — fields: cycle,
//! > employee, reviewer(s), self-rating, manager-rating, peer-rating,
//! > normalized score, increment %, new CTC, promotion?, comments,
//! > approver.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Audit, Identity};
use serde::{Deserialize, Serialize};

/* ===================== Goal ===================== */

/// One OKR-style objective tracked against an employee. `weight_pct`
/// lets a cycle weight goals against each other; `progress_pct` is the
/// employee/manager-asserted completion.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Goal {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    pub employee_id: ObjectId,

    pub title: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    pub period_from: DateTime<Utc>,
    pub period_to: DateTime<Utc>,

    /// Relative weight inside the cycle (0..100). Optional — not all
    /// orgs weight goals.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub weight_pct: Option<f32>,

    /// Free-form lifecycle: `"draft"` | `"in_progress"` | `"complete"` |
    /// `"missed"`.
    pub status: String,

    /// 0..100 completion. Tracked separately from `status` so a goal
    /// can be `"in_progress"` at 80% or `"missed"` at 20%.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub progress_pct: Option<f32>,
}

/* ===================== KPI ===================== */

/// Quantitative metric tracked against a target (vs `Goal`'s qualitative
/// objective). `target` and `actual` are unit-less floats; `unit` is a
/// free-form label ("calls/day", "USD", "%").
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Kpi {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    pub employee_id: ObjectId,

    pub name: String,

    pub target: f64,
    /// Measured value. `None` until the period closes.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub actual: Option<f64>,

    pub period_from: DateTime<Utc>,
    pub period_to: DateTime<Utc>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub unit: Option<String>,

    /// Normalized score (e.g. 0..5 or 0..100) computed from
    /// `actual / target`. Stored so a stale denominator doesn't shift
    /// historical reports.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub score: Option<f32>,
}

/* ===================== Appraisal ===================== */

/// One comment pinned to an appraisal — `role` distinguishes whose
/// voice it is so the UI can render the correct avatar/label.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppraisalComment {
    pub author_id: ObjectId,
    /// `"self"` | `"manager"` | `"peer"` | `"approver"`.
    pub role: String,
    pub body: String,
    pub at: DateTime<Utc>,
}

/// Appraisal review — one document per (cycle, employee). Aggregates
/// the three rating sources, the normalized number HR finally uses,
/// and the comp + comp-action outcomes (increment, promotion).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppraisalReview {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /// Cycle label (e.g. "FY26-H1", "2026-Annual"). Free-form so the
    /// tenant chooses their cadence.
    pub cycle: String,
    pub employee_id: ObjectId,

    /// Reviewers — manager + peers. The manager is conventionally
    /// reviewer[0] but the role is authoritative on each comment.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub reviewer_ids: Vec<ObjectId>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub self_rating: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub manager_rating: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub peer_rating: Option<f32>,

    /// HR-normalized final score (post calibration). Drives comp.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub normalized_score: Option<f32>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub increment_pct: Option<f32>,
    /// New CTC after the increment is applied.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub new_ctc: Option<f64>,

    /// Whether this review also issues a promotion.
    #[serde(default)]
    pub promotion: bool,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub comments: Vec<AppraisalComment>,

    /// Final approver (HRBP / department head).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub approver_id: Option<ObjectId>,

    /// `"open"` | `"submitted"` | `"approved"` | `"closed"`.
    pub status: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_identity() -> Identity {
        Identity {
            id: ObjectId::new(),
            project_id: ObjectId::new(),
            user_id: ObjectId::new(),
            tenant_id: None,
        }
    }

    #[test]
    fn goal_round_trips_with_flattened_fragments() {
        let goal = Goal {
            identity: sample_identity(),
            audit: Audit::new(None),
            employee_id: ObjectId::new(),
            title: "Ship cache-components migration".into(),
            description: Some("Migrate top 10 routes off unstable_cache.".into()),
            period_from: Utc::now(),
            period_to: Utc::now(),
            weight_pct: Some(40.0),
            status: "in_progress".into(),
            progress_pct: Some(60.0),
        };

        let json = serde_json::to_value(&goal).unwrap();
        assert!(json.get("identity").is_none(), "Identity must flatten");
        assert!(json.get("audit").is_none(), "Audit must flatten");
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("employeeId").is_some());
        assert!(json.get("title").is_some());
        assert!(json.get("weightPct").is_some());
        assert!(json.get("progressPct").is_some());
        assert_eq!(
            json.get("status").and_then(|v| v.as_str()),
            Some("in_progress")
        );

        let back: Goal = serde_json::from_value(json).unwrap();
        assert_eq!(back.title, "Ship cache-components migration");
        assert_eq!(back.weight_pct, Some(40.0));
    }

    #[test]
    fn kpi_round_trips_with_flattened_fragments() {
        let kpi = Kpi {
            identity: sample_identity(),
            audit: Audit::new(None),
            employee_id: ObjectId::new(),
            name: "Outbound calls / day".into(),
            target: 50.0,
            actual: Some(47.5),
            period_from: Utc::now(),
            period_to: Utc::now(),
            unit: Some("calls/day".into()),
            score: Some(4.2),
        };

        let json = serde_json::to_value(&kpi).unwrap();
        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());
        assert!(json.get("_id").is_some());
        assert!(json.get("name").is_some());
        assert!(json.get("target").is_some());
        assert!(json.get("actual").is_some());
        assert!(json.get("unit").is_some());
        assert!(json.get("score").is_some());

        let back: Kpi = serde_json::from_value(json).unwrap();
        assert_eq!(back.name, "Outbound calls / day");
        assert_eq!(back.target, 50.0);
        assert_eq!(back.actual, Some(47.5));
    }

    #[test]
    fn appraisal_review_round_trips_with_flattened_fragments() {
        let review = AppraisalReview {
            identity: sample_identity(),
            audit: Audit::new(None),
            cycle: "FY26-Annual".into(),
            employee_id: ObjectId::new(),
            reviewer_ids: vec![ObjectId::new(), ObjectId::new()],
            self_rating: Some(4.0),
            manager_rating: Some(4.5),
            peer_rating: Some(4.2),
            normalized_score: Some(4.3),
            increment_pct: Some(12.5),
            new_ctc: Some(2_700_000.0),
            promotion: true,
            comments: vec![AppraisalComment {
                author_id: ObjectId::new(),
                role: "manager".into(),
                body: "Strong delivery this cycle.".into(),
                at: Utc::now(),
            }],
            approver_id: Some(ObjectId::new()),
            status: "approved".into(),
        };

        let json = serde_json::to_value(&review).unwrap();
        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());
        assert!(json.get("_id").is_some());
        assert!(json.get("cycle").is_some());
        assert!(json.get("reviewerIds").is_some());
        assert!(json.get("selfRating").is_some());
        assert!(json.get("managerRating").is_some());
        assert!(json.get("peerRating").is_some());
        assert!(json.get("normalizedScore").is_some());
        assert!(json.get("incrementPct").is_some());
        assert!(json.get("newCtc").is_some());
        assert_eq!(json.get("promotion").and_then(|v| v.as_bool()), Some(true));
        let comments = json.get("comments").unwrap().as_array().unwrap();
        assert_eq!(comments.len(), 1);

        let back: AppraisalReview = serde_json::from_value(json).unwrap();
        assert_eq!(back.cycle, "FY26-Annual");
        assert_eq!(back.reviewer_ids.len(), 2);
        assert!(back.promotion);
        assert_eq!(back.status, "approved");
    }
}
