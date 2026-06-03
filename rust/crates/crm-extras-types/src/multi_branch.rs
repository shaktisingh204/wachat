//! §12.18 Multi-branch / Cost Centers.
//!
//! Three top-level DTOs:
//!
//! - [`Branch`] — a physical or logical business unit with its own
//!   address, GSTIN, manager and AR/AP opening balance. Stored in
//!   `crm_branches`.
//! - [`CostCenter`] — a budget-bucket node in the cost-center tree
//!   (parent / child via `parent_id`). Stored in `crm_cost_centers`.
//! - [`Project`] — the authoritative project DTO used by billing /
//!   timesheets / budgets. Stored in `crm_projects`. Note: the legacy
//!   `lookup-registry` `project` entity may still describe the older
//!   shape — this struct supersedes it for the new modules.
//!
//! All three flatten the `crm-core` cross-cutting fragments (`Identity`,
//! `Audit`).
//!
//! Spec verbatim: Branch (code, name, address, GSTIN, manager, opening
//! balance), Cost center (code, name, parent, default ledger, budget),
//! Project (code, name, customer, budget, billable?, members[]).

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Audit, Identity};
use crm_sales_types::{Address, OpeningBalance};
use serde::{Deserialize, Serialize};

/* ============================================================
 * Branch
 * ============================================================ */

/// A business unit (head office, regional office, retail outlet …).
/// `code` is the short human-typeable identifier used in document
/// numbering (e.g. `BLR-01`); `name` is the display label.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Branch {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /// Short human-typeable identifier (used in doc numbering, search).
    pub code: String,
    /// Display label.
    pub name: String,

    /// Postal address. Reuses the shared sales `Address` so a branch
    /// can be used directly as a `place_of_supply` in invoices.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub address: Option<Address>,

    /// India GSTIN. Stored at branch level because GST registration is
    /// per state — a multi-state tenant has one GSTIN per branch.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub gstin: Option<String>,

    /// FK into `users` collection — the branch manager / cost-center
    /// approver.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub manager_id: Option<ObjectId>,

    /// Opening balance (amount + as-of date) seeded when the branch is
    /// migrated in from a previous accounting system.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub opening_balance: Option<OpeningBalance>,

    /// ISO 4217 default currency for this branch. Falls back to the
    /// tenant's base currency when `None`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,

    /// Whether the branch is currently operational. Disabled branches
    /// must not appear in pickers but remain queryable for historical
    /// reporting.
    pub active: bool,
}

/* ============================================================
 * CostCenter
 * ============================================================ */

/// Budget-bucket node in the cost-center tree. Parent / child links
/// via `parent_id`; the root node has `parent_id = None`. `default_ledger_id`
/// is the GL account this center posts to when no override is given.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CostCenter {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /// Short human-typeable identifier (e.g. `MKTG-DIGITAL`).
    pub code: String,
    /// Display label.
    pub name: String,

    /// Parent cost center; `None` for the root.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent_id: Option<ObjectId>,

    /// Default GL account this center posts to.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_ledger_id: Option<ObjectId>,

    /// FK into `crm_budgets` (the budget envelope for this center).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub budget_id: Option<ObjectId>,

    /// Disabled centers are hidden from pickers but remain in reports.
    pub active: bool,
}

/* ============================================================
 * Project
 * ============================================================ */

/// Authoritative project DTO. Holds the customer link, members,
/// billable flag and budget. Timesheets, expense claims and recurring
/// invoices reference projects by `_id`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /// Short human-typeable identifier (e.g. `ACME-2026`).
    pub code: String,
    /// Display label.
    pub name: String,

    /// FK into `crm_accounts` (the customer the project is billed to).
    /// Internal projects (e.g. R&D) leave this `None`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub customer_id: Option<ObjectId>,

    /// Total budget envelope (in `currency`). `None` = no cap.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub budget: Option<f64>,
    /// ISO 4217 currency the budget is expressed in. Falls back to the
    /// branch / tenant base currency when `None`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,

    /// Whether time logged on this project bills the customer.
    /// Internal projects flip this to `false`.
    pub billable: bool,

    /// FKs into `users` — every team member with access to log time
    /// against this project.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub member_ids: Vec<ObjectId>,

    /// FK into `users` — the project manager / approver.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub manager_id: Option<ObjectId>,

    /// Project window. Reports use these for percent-complete /
    /// burn-down charts.
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub start: Option<DateTime<Utc>>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub end: Option<DateTime<Utc>>,

    /// Lifecycle status. Free-form to absorb tenant-specific states
    /// without a schema migration.
    /// Canonical values: `"active"`, `"on_hold"`, `"completed"`,
    /// `"cancelled"`.
    pub status: String,
}

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

    #[test]
    fn branch_round_trips_with_flattened_fragments() {
        let now = Utc::now();
        let b = Branch {
            identity: ident(),
            audit: Audit::new(None),
            code: "BLR-01".into(),
            name: "Bangalore HQ".into(),
            address: Some(Address {
                line1: Some("Indiranagar".into()),
                city: Some("Bengaluru".into()),
                state: Some("KA".into()),
                country: Some("IN".into()),
                pincode: Some("560038".into()),
                ..Default::default()
            }),
            gstin: Some("29ABCDE1234F1Z5".into()),
            manager_id: Some(ObjectId::new()),
            opening_balance: Some(OpeningBalance {
                amount: 0.0,
                as_of: now,
            }),
            currency: Some("INR".into()),
            active: true,
        };

        let json = serde_json::to_value(&b).unwrap();

        assert!(json.get("identity").is_none(), "Identity must flatten");
        assert!(json.get("audit").is_none(), "Audit must flatten");
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("openingBalance").is_some());
        assert!(json.get("managerId").is_some());

        let back: Branch = serde_json::from_value(json).unwrap();
        assert_eq!(back.code, "BLR-01");
        assert_eq!(back.gstin.as_deref(), Some("29ABCDE1234F1Z5"));
        assert!(back.active);
    }

    #[test]
    fn cost_center_round_trips_with_flattened_fragments() {
        let cc = CostCenter {
            identity: ident(),
            audit: Audit::new(None),
            code: "MKTG-DIGITAL".into(),
            name: "Marketing — Digital".into(),
            parent_id: Some(ObjectId::new()),
            default_ledger_id: Some(ObjectId::new()),
            budget_id: Some(ObjectId::new()),
            active: true,
        };

        let json = serde_json::to_value(&cc).unwrap();

        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());
        assert!(json.get("_id").is_some());
        assert!(json.get("parentId").is_some());
        assert!(json.get("defaultLedgerId").is_some());
        assert!(json.get("budgetId").is_some());

        let back: CostCenter = serde_json::from_value(json).unwrap();
        assert_eq!(back.code, "MKTG-DIGITAL");
        assert!(back.active);
    }

    #[test]
    fn project_round_trips_with_flattened_fragments() {
        let now = Utc::now();
        let m1 = ObjectId::new();
        let m2 = ObjectId::new();
        let p = Project {
            identity: ident(),
            audit: Audit::new(None),
            code: "ACME-2026".into(),
            name: "Acme website rebuild".into(),
            customer_id: Some(ObjectId::new()),
            budget: Some(150_000.0),
            currency: Some("USD".into()),
            billable: true,
            member_ids: vec![m1, m2],
            manager_id: Some(ObjectId::new()),
            start: Some(now),
            end: Some(now),
            status: "active".into(),
        };

        let json = serde_json::to_value(&p).unwrap();

        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());
        assert!(json.get("_id").is_some());
        assert!(json.get("customerId").is_some());
        assert!(json.get("memberIds").is_some());
        assert!(json.get("managerId").is_some());
        assert_eq!(json.get("billable").and_then(|v| v.as_bool()), Some(true));
        assert_eq!(json.get("status").and_then(|v| v.as_str()), Some("active"));

        let back: Project = serde_json::from_value(json).unwrap();
        assert_eq!(back.code, "ACME-2026");
        assert_eq!(back.member_ids.len(), 2);
        assert!(back.billable);
        assert_eq!(back.status, "active");
    }
}
