//! §12.16 Loans & Advances.
//!
//! Mongo collection: `crm_loans`. A loan can be issued to an employee
//! (salary advance), a customer (financing) or a vendor (advance
//! payment); the same shape covers all three flavours via `loan_type`.
//! The struct flattens the `crm-core` cross-cutting fragments
//! (`Identity`, `Audit`) so the document root carries the §0 ownership
//! and audit fields directly.
//!
//! Spec verbatim: Type (employee salary advance / customer loan /
//! vendor advance), principal, interest rate, tenure, EMI schedule
//! [computed], prepayment rules, NPA flag, guarantor, documents,
//! repayment auto-deduct from payroll?

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Audit, Identity};
use serde::{Deserialize, Serialize};

/// What the loan represents on the books. Multi-word variants serialize
/// as snake_case (`employee_advance`) per the §0 enum convention.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LoanType {
    #[default]
    EmployeeAdvance,
    CustomerLoan,
    VendorAdvance,
}

/// Lifecycle of the loan. `Defaulted` flips on once a missed-EMI
/// threshold is crossed (typically 90 days past due — see `npa_flag`).
/// `Restructured` covers a renegotiated repayment plan.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LoanStatus {
    #[default]
    Draft,
    Active,
    Closed,
    Defaulted,
    Restructured,
}

/// One row of the amortisation schedule. The schedule is generated up
/// front when the loan moves to `Active`; `paid` / `paid_at` flip as
/// the repayment worker reconciles each EMI.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmiScheduleItem {
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub due: DateTime<Utc>,
    pub principal: f64,
    pub interest: f64,
    /// Outstanding principal after this EMI is applied.
    pub balance_after: f64,
    #[serde(default)]
    pub paid: bool,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub paid_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Loan {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /* ----- counterparty + terms --------------------------------- */
    pub loan_type: LoanType,
    /// Employee, customer or vendor id depending on `loan_type`. The
    /// referenced collection is implied by the type — the integrator's
    /// server actions resolve it.
    pub party_id: ObjectId,

    pub principal: f64,
    pub currency: String,
    /// Annualised interest rate as a percentage (e.g. `12.5` for
    /// 12.5%).
    pub interest_rate_pct: f32,
    pub tenure_months: u32,

    /* ----- amortisation ----------------------------------------- */
    /// [computed] Generated up front when the loan activates; rows are
    /// updated in place as repayments come in.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub emi_schedule: Vec<EmiScheduleItem>,

    /* ----- prepayment ------------------------------------------- */
    #[serde(default)]
    pub prepayment_allowed: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub prepayment_penalty_pct: Option<f32>,

    /* ----- risk + collateral ------------------------------------ */
    /// Non-Performing Asset flag. Flipped by the dunning worker once
    /// the missed-EMI threshold is crossed.
    #[serde(default)]
    pub npa_flag: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub guarantor_id: Option<ObjectId>,

    /// SabFile ids for KYC docs, signed agreement, collateral proof,
    /// etc. Per the project's "every file lives in SabFiles" policy
    /// these are FK ids — never raw URLs.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub document_file_ids: Vec<ObjectId>,

    /* ----- repayment automation --------------------------------- */
    /// Only meaningful for `EmployeeAdvance`. When `true` the payroll
    /// run docks the next EMI from the employee's pay; otherwise the
    /// employee remits manually.
    #[serde(default)]
    pub repayment_auto_deduct: bool,

    /* ----- lifecycle -------------------------------------------- */
    #[serde(default)]
    pub status: LoanStatus,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub disbursed_at: Option<DateTime<Utc>>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub closed_at: Option<DateTime<Utc>>,
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
    fn loan_round_trips_with_flattened_fragments() {
        let party_id = ObjectId::new();
        let loan = Loan {
            identity: identity(),
            audit: audit(),
            loan_type: LoanType::EmployeeAdvance,
            party_id,
            principal: 100_000.0,
            currency: "INR".to_string(),
            interest_rate_pct: 9.5,
            tenure_months: 12,
            emi_schedule: vec![EmiScheduleItem {
                due: Utc::now(),
                principal: 8_000.0,
                interest: 791.67,
                balance_after: 92_000.0,
                paid: false,
                paid_at: None,
            }],
            prepayment_allowed: true,
            prepayment_penalty_pct: Some(2.0),
            npa_flag: false,
            guarantor_id: Some(ObjectId::new()),
            document_file_ids: vec![ObjectId::new(), ObjectId::new()],
            repayment_auto_deduct: true,
            status: LoanStatus::Active,
            disbursed_at: Some(Utc::now()),
            closed_at: None,
        };

        let json = serde_json::to_value(&loan).unwrap();

        // Flattened crm-core fragments at the document root.
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("updatedAt").is_some());
        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());

        // Entity-specific camelCase fields.
        assert!(json.get("loanType").is_some());
        assert!(json.get("partyId").is_some());
        assert!(json.get("interestRatePct").is_some());
        assert!(json.get("tenureMonths").is_some());
        assert!(json.get("emiSchedule").is_some());
        assert!(json.get("documentFileIds").is_some());
        assert!(json.get("repaymentAutoDeduct").is_some());

        // Multi-word LoanType serializes as snake_case.
        assert_eq!(json.get("loanType").unwrap(), "employee_advance");
        // Single-word LoanStatus is lowercase.
        assert_eq!(json.get("status").unwrap(), "active");

        let back: Loan = serde_json::from_value(json).unwrap();
        assert_eq!(back.party_id, party_id);
        assert!(matches!(back.loan_type, LoanType::EmployeeAdvance));
        assert!(matches!(back.status, LoanStatus::Active));
        assert_eq!(back.tenure_months, 12);
        assert_eq!(back.emi_schedule.len(), 1);
        assert!(back.repayment_auto_deduct);
    }
}
