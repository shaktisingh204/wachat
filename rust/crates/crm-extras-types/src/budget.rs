//! §12.14 Budgets.
//!
//! Mongo collection: `crm_budgets`. A budget pins a planned spend or
//! revenue figure against an account / department / project / cost
//! centre for a given period, with thresholded alerts that fire as the
//! actual creeps toward the plan. The struct flattens the `crm-core`
//! cross-cutting fragments (`Identity`, `Audit`) so the document root
//! carries the §0 ownership and audit fields directly.
//!
//! Spec verbatim: Budget head (account/department/project/cost-center),
//! period, plan amount, actual [computed], variance [computed], alerts
//! at %, owner, approver, scenario (best/base/worst).

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Audit, Identity};
use serde::{Deserialize, Serialize};

/// What the budget is allocated against. Tagged so the discriminant
/// (`kind`) and the referenced id (`id`) are siblings on the JSON
/// document — keeps Mongo aggregations clean. `CostCenter` carries a
/// free-form string because cost centres are not modelled as their own
/// collection today.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", content = "id", rename_all = "snake_case")]
pub enum BudgetHead {
    Account(ObjectId),
    Department(ObjectId),
    Project(ObjectId),
    CostCenter(String),
}

/// Planning scenario the budget applies to. Lets finance maintain
/// parallel "best / base / worst" plans for the same head + period.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum BudgetScenario {
    Best,
    #[default]
    Base,
    Worst,
}

/// One alert rung. The reconciliation worker fires `channel` to
/// `recipients` once the actual exceeds `threshold_pct` of the plan;
/// `fired_at` is stamped to debounce repeat sends.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BudgetAlert {
    /// Threshold expressed as a percentage of the plan (e.g. `80.0`
    /// means "fire when actual hits 80% of plan").
    pub threshold_pct: f32,
    /// Free-form channel id (`"email"`, `"whatsapp"`, `"in_app"`, …).
    pub channel: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub recipients: Vec<ObjectId>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub fired_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Budget {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /* ----- header ------------------------------------------------ */
    pub name: String,
    pub head: BudgetHead,

    /* ----- period ------------------------------------------------ */
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub period_from: DateTime<Utc>,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub period_to: DateTime<Utc>,

    /* ----- amounts ----------------------------------------------- */
    pub plan_amount: f64,
    /// [computed] Sum of postings against `head` within the period.
    /// Server-side only; clients should treat as read-only.
    #[serde(default)]
    pub actual_amount: f64,
    /// [computed] `plan_amount - actual_amount`. Server-side only.
    #[serde(default)]
    pub variance: f64,
    pub currency: String,

    /* ----- alerting ---------------------------------------------- */
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub alerts: Vec<BudgetAlert>,

    /* ----- workflow ---------------------------------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub owner_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub approver_id: Option<ObjectId>,
    #[serde(default)]
    pub scenario: BudgetScenario,
    /// Free-form lifecycle status — typically `"draft"`, `"approved"`
    /// or `"closed"`. Free text so projects can extend with their own
    /// review states without a schema bump.
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
    fn budget_round_trips_with_flattened_fragments() {
        let dept_id = ObjectId::new();
        let budget = Budget {
            identity: identity(),
            audit: audit(),
            name: "Marketing FY26".to_string(),
            head: BudgetHead::Department(dept_id),
            period_from: Utc::now(),
            period_to: Utc::now(),
            plan_amount: 5_000_000.0,
            actual_amount: 1_240_000.0,
            variance: 3_760_000.0,
            currency: "INR".to_string(),
            alerts: vec![BudgetAlert {
                threshold_pct: 80.0,
                channel: "email".to_string(),
                recipients: vec![ObjectId::new()],
                fired_at: None,
            }],
            owner_id: Some(ObjectId::new()),
            approver_id: Some(ObjectId::new()),
            scenario: BudgetScenario::Base,
            status: "approved".to_string(),
        };

        let json = serde_json::to_value(&budget).unwrap();

        // Flattened crm-core fragments at the document root.
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("updatedAt").is_some());
        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());

        // Entity-specific camelCase fields.
        assert!(json.get("planAmount").is_some());
        assert!(json.get("actualAmount").is_some());
        assert!(json.get("periodFrom").is_some());

        // Tagged-enum head shape.
        let head_json = json.get("head").unwrap();
        assert_eq!(head_json.get("kind").unwrap(), "department");
        assert!(head_json.get("id").is_some());

        // Scenario is lowercase.
        assert_eq!(json.get("scenario").unwrap(), "base");

        let back: Budget = serde_json::from_value(json).unwrap();
        assert_eq!(back.name, "Marketing FY26");
        assert!(matches!(back.scenario, BudgetScenario::Base));
        match back.head {
            BudgetHead::Department(id) => assert_eq!(id, dept_id),
            _ => panic!("head did not round-trip as Department"),
        }
    }
}
