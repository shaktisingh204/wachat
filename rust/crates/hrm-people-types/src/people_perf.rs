//! §10 Performance — OKRs/Goals, 360 Feedback, Recognition, Surveys/Pulse,
//! and One-on-Ones. Each top-level entity flattens `crm-core`
//! `Identity` + `Audit` so the document root carries the §0 ownership /
//! audit fields directly.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Audit, Identity};
use serde::{Deserialize, Serialize};

/* =============================================================== */
/* OKRs & Goals                                                    */
/* =============================================================== */

/// Single key-result inside an `Okr.keyResults`. `target` / `actual`
/// are stored as `f64` so a KR can express either a count
/// ("100 deals closed") or a currency value ("₹50L revenue").
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyResult {
    pub id: ObjectId,
    pub label: String,
    pub target: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub actual: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub unit: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub progress_pct: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Okr {
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    pub objective: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub key_results: Vec<KeyResult>,
    pub owner_id: ObjectId,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub period_from: DateTime<Utc>,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub period_to: DateTime<Utc>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub weight_pct: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub score: Option<f32>,
}

/* =============================================================== */
/* 360 Feedback                                                    */
/* =============================================================== */

/// One participant in a 360 cycle. `role` is a free-form string ("manager",
/// "peer", "report", "self") so the front-end can extend without a schema
/// migration.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Feedback360Rater {
    pub rater_id: ObjectId,
    pub target_employee_id: ObjectId,
    pub role: String,
    #[serde(default)]
    pub submitted: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Feedback360Cycle {
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    pub name: String,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub period_from: DateTime<Utc>,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub period_to: DateTime<Utc>,
    #[serde(default)]
    pub anonymous: bool,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub questions: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub raters: Vec<Feedback360Rater>,
}

/// Aggregated, anonymised summary of a single employee's results in a
/// cycle. `scoresByQuestion` is stored as JSON because the shape varies
/// (numeric averages, count buckets, free-text snippets).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Feedback360Summary {
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    pub cycle_id: ObjectId,
    pub employee_id: ObjectId,
    pub scores_by_question: serde_json::Value,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub narrative: Option<String>,
}

/* =============================================================== */
/* Recognition / Kudos                                             */
/* =============================================================== */

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecognitionKudo {
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    pub from_id: ObjectId,
    pub to_id: ObjectId,
    /// "great_work" | "team_player" | "innovation" | "customer_first"
    pub kind: String,
    pub points: u32,
    pub message: String,
    #[serde(default)]
    pub public: bool,
}

/* =============================================================== */
/* Surveys & Pulse                                                 */
/* =============================================================== */

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SurveyQuestion {
    pub id: ObjectId,
    pub prompt: String,
    /// "rating" | "text" | "choice"
    pub kind: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub options: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Survey {
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    pub name: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub questions: Vec<SurveyQuestion>,
    /// "all" | "team" | "department"
    pub audience: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub audience_value: Option<String>,
    #[serde(default)]
    pub anonymous: bool,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub scheduled_for: Option<DateTime<Utc>>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub closes_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub results_summary: serde_json::Value,
}

/* =============================================================== */
/* One-on-Ones                                                     */
/* =============================================================== */

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActionItem {
    pub text: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub owner_id: Option<ObjectId>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub due: Option<DateTime<Utc>>,
    #[serde(default)]
    pub done: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OneOnOne {
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    pub manager_id: ObjectId,
    pub employee_id: ObjectId,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub scheduled_at: DateTime<Utc>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub template_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub agenda: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub action_items: Vec<ActionItem>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    pub status: String,
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
    fn okr_round_trips_with_flattened_fragments() {
        let okr = Okr {
            identity: ident(),
            audit: audit(),
            objective: "Grow ARR".into(),
            key_results: vec![KeyResult {
                id: ObjectId::new(),
                label: "Close 50 deals".into(),
                target: 50.0,
                actual: Some(12.0),
                unit: Some("deals".into()),
                progress_pct: Some(24.0),
            }],
            owner_id: ObjectId::new(),
            period_from: Utc::now(),
            period_to: Utc::now(),
            weight_pct: Some(40.0),
            score: None,
        };

        let json = serde_json::to_value(&okr).unwrap();
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("keyResults").is_some());
        assert_eq!(
            json.get("objective").and_then(|v| v.as_str()),
            Some("Grow ARR")
        );
        let back: Okr = serde_json::from_value(json).unwrap();
        assert_eq!(back.objective, "Grow ARR");
    }
}
