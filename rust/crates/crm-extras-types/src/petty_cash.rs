//! §12.15 Petty Cash.
//!
//! Two top-level entities live in this module:
//! - `PettyCashFloat` (Mongo collection `crm_petty_cash_floats`) — a
//!   running cash float held against a branch or an employee, with the
//!   custodian responsible for it.
//! - `PettyCashVoucher` (Mongo collection `crm_petty_cash_vouchers`) —
//!   one debit / credit / IOU event against a float, optionally with a
//!   denomination breakdown for the daily cash count.
//!
//! Each struct flattens the `crm-core` cross-cutting fragments
//! (`Identity`, `Audit`) so the document root carries the §0 ownership
//! and audit fields directly.
//!
//! Spec verbatim: Petty cash float per branch/employee, top-up,
//! expense voucher, denomination count, daily reconciliation, IOU
//! register.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Attachment, Audit, Identity};
use serde::{Deserialize, Serialize};

/* ============================================================== */
/*  Float                                                          */
/* ============================================================== */

/// Who the float is held for. Tagged so the discriminant (`kind`) and
/// the referenced id (`id`) are siblings on the JSON document, keeping
/// Mongo aggregations and indexes simple.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", content = "id", rename_all = "snake_case")]
pub enum PettyCashScope {
    Branch(ObjectId),
    Employee(ObjectId),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PettyCashFloat {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /* ----- scope + balance -------------------------------------- */
    pub scope: PettyCashScope,
    pub balance: f64,
    pub currency: String,

    /// Employee who physically holds and is responsible for the cash.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub custodian_employee_id: Option<ObjectId>,

    /* ----- lifecycle stamps ------------------------------------- */
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub last_topup_at: Option<DateTime<Utc>>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub last_reconciled_at: Option<DateTime<Utc>>,

    /// Closed floats are kept (not deleted) so historic vouchers stay
    /// resolvable.
    #[serde(default)]
    pub active: bool,
}

/* ============================================================== */
/*  Voucher                                                        */
/* ============================================================== */

/// One row of the daily cash count. `value=500.0, count=10` means ten
/// ₹500 notes. `f64` for value so foreign-currency notes / coins (e.g.
/// `0.25` for a US quarter) fit without a separate type.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Denomination {
    pub value: f64,
    pub count: u32,
}

/// A single posting against a `PettyCashFloat`.
///
/// `kind` is free-form so projects can extend with niche flows
/// (`"loss"`, `"transfer"`) without a schema bump. The integrator's
/// server actions accept `"topup" | "expense" | "iou_advance" |
/// "iou_return" | "reconciliation"`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PettyCashVoucher {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /* ----- references ------------------------------------------- */
    pub float_id: ObjectId,

    /* ----- entry body ------------------------------------------- */
    /// Voucher kind. See module docs for the canonical set.
    pub kind: String,
    pub amount: f64,

    /// Optional cash count attached to the voucher — usually present on
    /// `topup` and `reconciliation` entries.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub denominations: Vec<Denomination>,

    /// Expense GL account the spend posts to (only meaningful on
    /// `expense` vouchers).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expense_account_id: Option<ObjectId>,

    /// IOU recipient — populated when `kind` is `iou_advance` or
    /// `iou_return`. The pair forms the row in the IOU register.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub employee_id: Option<ObjectId>,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub attachments: Vec<Attachment>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,

    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub voucher_date: DateTime<Utc>,
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
    fn petty_cash_float_round_trips_with_flattened_fragments() {
        let branch_id = ObjectId::new();
        let float = PettyCashFloat {
            identity: identity(),
            audit: audit(),
            scope: PettyCashScope::Branch(branch_id),
            balance: 12_500.0,
            currency: "INR".to_string(),
            custodian_employee_id: Some(ObjectId::new()),
            last_topup_at: Some(Utc::now()),
            last_reconciled_at: None,
            active: true,
        };

        let json = serde_json::to_value(&float).unwrap();

        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());

        // Tagged-enum scope shape.
        let scope_json = json.get("scope").unwrap();
        assert_eq!(scope_json.get("kind").unwrap(), "branch");
        assert!(scope_json.get("id").is_some());

        assert!(json.get("custodianEmployeeId").is_some());
        assert!(json.get("lastTopupAt").is_some());

        let back: PettyCashFloat = serde_json::from_value(json).unwrap();
        assert_eq!(back.balance, 12_500.0);
        assert!(back.active);
        match back.scope {
            PettyCashScope::Branch(id) => assert_eq!(id, branch_id),
            _ => panic!("scope did not round-trip as Branch"),
        }
    }

    #[test]
    fn petty_cash_voucher_round_trips_with_flattened_fragments() {
        let voucher = PettyCashVoucher {
            identity: identity(),
            audit: audit(),
            float_id: ObjectId::new(),
            kind: "expense".to_string(),
            amount: 850.0,
            denominations: vec![
                Denomination {
                    value: 500.0,
                    count: 1,
                },
                Denomination {
                    value: 100.0,
                    count: 3,
                },
                Denomination {
                    value: 50.0,
                    count: 1,
                },
            ],
            expense_account_id: Some(ObjectId::new()),
            employee_id: None,
            attachments: vec![],
            note: Some("Office snacks".to_string()),
            voucher_date: Utc::now(),
        };

        let json = serde_json::to_value(&voucher).unwrap();

        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());

        assert!(json.get("floatId").is_some());
        assert!(json.get("voucherDate").is_some());
        assert!(json.get("expenseAccountId").is_some());
        assert_eq!(json.get("kind").unwrap(), "expense");

        let back: PettyCashVoucher = serde_json::from_value(json).unwrap();
        assert_eq!(back.kind, "expense");
        assert_eq!(back.amount, 850.0);
        assert_eq!(back.denominations.len(), 3);
        assert_eq!(back.denominations[0].count, 1);
    }
}
