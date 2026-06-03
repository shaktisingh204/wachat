//! §10 Onboarding cluster.
//!
//! Once a candidate is hired, an onboarding checklist + welcome kit +
//! probation tracker are spun up. The org chart and directory settings
//! are tenant-level singletons that govern how the people directory is
//! visualised. Every top-level entity flattens the standard `crm-core`
//! fragments (`Identity`, `Audit`).

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Audit, Identity};
use serde::{Deserialize, Serialize};

/* ============================================================ *
 * 1. Onboarding                                                *
 * ============================================================ */

/// One row in an employee's onboarding checklist (laptop issued, ID
/// card printed, BGV initiated, …).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OnboardingChecklistItem {
    /// Stable id so UI re-orders + status updates can target a single row.
    pub id: ObjectId,
    pub label: String,
    /// Owner of the task (HR partner, IT helpdesk, manager, …).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub owner_id: Option<ObjectId>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub due_date: Option<DateTime<Utc>>,
    pub done: bool,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub done_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Onboarding {
    /* ----- crm-core fragments (flattened) ------------------- */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    pub employee_id: ObjectId,

    /// HR owner driving the onboarding.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub owner_id: Option<ObjectId>,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub items: Vec<OnboardingChecklistItem>,

    /// 0.0 – 100.0. Recomputed whenever an item flips `done`.
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

/* ============================================================ *
 * 2. Welcome Kit                                               *
 * ============================================================ */

/// One physical/digital item handed out as part of the welcome kit.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WelcomeKitItem {
    pub name: String,
    /// Optional inventory SKU for trackable items.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sku: Option<String>,
    pub assigned: bool,
    pub delivered: bool,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub delivered_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WelcomeKit {
    /* ----- crm-core fragments (flattened) ------------------- */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    pub employee_id: ObjectId,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub items: Vec<WelcomeKitItem>,
    /// `"draft" | "assigned" | "delivered"`.
    pub status: String,
}

/* ============================================================ *
 * 3. Probation Tracker                                         *
 * ============================================================ */

/// One milestone inside a probation period (30-day check-in,
/// mid-probation review, …).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProbationMilestone {
    pub label: String,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub due: DateTime<Utc>,
    pub met: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ProbationDecision {
    Confirm,
    Extend,
    Terminate,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProbationTracker {
    /* ----- crm-core fragments (flattened) ------------------- */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    pub employee_id: ObjectId,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub start: DateTime<Utc>,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub end: DateTime<Utc>,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub milestones: Vec<ProbationMilestone>,

    /// Scheduled review meeting timestamp.
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub review_at: Option<DateTime<Utc>>,

    /// Final outcome — `None` until decided.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub decision: Option<ProbationDecision>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub decided_at: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub decided_by: Option<ObjectId>,
}

/* ============================================================ *
 * 4. Org Chart Settings                                        *
 * ============================================================ */

/// Tenant-level visualizer settings for the org-chart page.
/// One document per tenant.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OrgChartSettings {
    /* ----- crm-core fragments (flattened) ------------------- */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /// `"tree" | "radial"`.
    pub layout: String,

    /// Anchor node for the chart. `None` = derive from reporting graph.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub root_employee_id: Option<ObjectId>,

    pub show_dotted_lines: bool,
    pub show_open_positions: bool,
}

/* ============================================================ *
 * 5. Directory Settings                                        *
 * ============================================================ */

/// Tenant-level config for the people directory page.
/// One document per tenant.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectorySettings {
    /* ----- crm-core fragments (flattened) ------------------- */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /// Default filter chips applied when the directory loads. Opaque
    /// JSON so the front-end's filter shape can evolve without DTO churn.
    pub default_filters: serde_json::Value,

    /// Visibility tiers a viewer may select — `"self" | "team" | "company"`.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub allowed_visibility_levels: Vec<String>,

    pub show_birthdays: bool,
    pub show_anniversaries: bool,
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
    fn onboarding_round_trips_with_flattened_fragments() {
        let item_id = ObjectId::new();
        let now = Utc::now();

        let onboarding = Onboarding {
            identity: ident(),
            audit: audit(),
            employee_id: ObjectId::new(),
            owner_id: Some(ObjectId::new()),
            items: vec![
                OnboardingChecklistItem {
                    id: item_id,
                    label: "Issue laptop".to_string(),
                    owner_id: Some(ObjectId::new()),
                    due_date: Some(now),
                    done: true,
                    done_at: Some(now),
                },
                OnboardingChecklistItem {
                    id: ObjectId::new(),
                    label: "Background verification".to_string(),
                    owner_id: None,
                    due_date: None,
                    done: false,
                    done_at: None,
                },
            ],
            completion_pct: 50.0,
            started_at: now,
            completed_at: None,
        };

        let json = serde_json::to_value(&onboarding).unwrap();

        // Flattened fragments at root.
        assert!(json.get("_id").is_some(), "_id must be at root");
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());

        // camelCase entity fields.
        assert!(json.get("employeeId").is_some());
        assert!(json.get("ownerId").is_some());
        assert!(json.get("completionPct").is_some());
        assert!(json.get("startedAt").is_some());

        // Sub-doc camelCase.
        let items = json.get("items").and_then(|v| v.as_array()).unwrap();
        assert_eq!(items.len(), 2);
        assert!(items[0].get("dueDate").is_some());
        assert!(items[0].get("doneAt").is_some());

        let back: Onboarding = serde_json::from_value(json).unwrap();
        assert_eq!(back.items.len(), 2);
        assert_eq!(back.items[0].id, item_id);
        assert!(back.items[0].done);
        assert_eq!(back.completion_pct, 50.0);
    }

    #[test]
    fn probation_tracker_decision_serializes_lowercase() {
        let now = Utc::now();
        let decider = ObjectId::new();

        let tracker = ProbationTracker {
            identity: ident(),
            audit: audit(),
            employee_id: ObjectId::new(),
            start: now,
            end: now,
            milestones: vec![ProbationMilestone {
                label: "30-day review".to_string(),
                due: now,
                met: true,
                note: Some("All targets met.".to_string()),
            }],
            review_at: Some(now),
            decision: Some(ProbationDecision::Confirm),
            decided_at: Some(now),
            decided_by: Some(decider),
        };

        let json = serde_json::to_value(&tracker).unwrap();

        // Flattened fragments at root.
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());

        // camelCase entity fields.
        assert!(json.get("employeeId").is_some());
        assert!(json.get("reviewAt").is_some());
        assert!(json.get("decidedBy").is_some());

        // Enum lowercase.
        assert_eq!(
            json.get("decision").and_then(|v| v.as_str()),
            Some("confirm")
        );

        let back: ProbationTracker = serde_json::from_value(json).unwrap();
        assert_eq!(back.decision, Some(ProbationDecision::Confirm));
        assert_eq!(back.milestones.len(), 1);
        assert!(back.milestones[0].met);
        assert_eq!(back.decided_by, Some(decider));
    }

    #[test]
    fn welcome_kit_round_trips_camel_case() {
        let kit = WelcomeKit {
            identity: ident(),
            audit: audit(),
            employee_id: ObjectId::new(),
            items: vec![WelcomeKitItem {
                name: "T-shirt".to_string(),
                sku: Some("MERCH-TEE-L".to_string()),
                assigned: true,
                delivered: false,
                delivered_at: None,
            }],
            status: "assigned".to_string(),
        };

        let json = serde_json::to_value(&kit).unwrap();
        assert!(json.get("employeeId").is_some());
        let items = json.get("items").and_then(|v| v.as_array()).unwrap();
        assert!(items[0].get("deliveredAt").is_none());
        assert_eq!(
            items[0].get("delivered").and_then(|v| v.as_bool()),
            Some(false)
        );

        let back: WelcomeKit = serde_json::from_value(json).unwrap();
        assert_eq!(back.status, "assigned");
        assert_eq!(back.items[0].sku.as_deref(), Some("MERCH-TEE-L"));
    }
}
