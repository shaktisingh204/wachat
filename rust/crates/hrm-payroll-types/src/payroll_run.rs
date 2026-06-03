//! §9.6 Payroll Run.
//!
//! Mongo collection: `crm_payroll_runs`. A payroll run is the per-period
//! batch that resolves each employee's salary structure into concrete
//! earning / deduction / reimbursement amounts, computes gross / net /
//! CTC totals, and produces a bank file (NEFT / IMPS / RTGS / UPI bulk)
//! for disbursal. Runs flow through draft → processing → approved →
//! disbursed → closed; each transition can require multi-step approval.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Audit, Identity};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PayrollRunStatus {
    #[default]
    Draft,
    Processing,
    Approved,
    Disbursed,
    Closed,
}

/// Bank-file format used to disburse net pay. UPI bulk is supported by
/// some payment partners for sub-2L employee transfers.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BankFileFormat {
    Neft,
    Imps,
    Rtgs,
    UpiBulk,
}

/// One earning row for an employee within a run. `code` is free-text but
/// the engine canonicalizes well-known codes:
/// `"BASIC" | "HRA" | "BONUS" | "OT" | "INCENTIVE" | "ARREARS" |
///  "CONVEYANCE" | "SPECIAL"`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EarningLine {
    pub code: String,
    pub label: String,
    pub amount: f64,
}

/// One deduction row for an employee. Canonical codes:
/// `"PF" | "ESI" | "PT" | "TDS" | "LOAN" | "LOP"`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeductionLine {
    pub code: String,
    pub label: String,
    pub amount: f64,
}

/// Reimbursement row. `claim_id` links back to the §9.x reimbursement
/// claim that was approved into this run.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReimbursementLine {
    pub category: String,
    pub amount: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub claim_id: Option<ObjectId>,
}

/// One employee's resolved figures for the run.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmployeeRunRow {
    pub employee_id: ObjectId,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub earnings: Vec<EarningLine>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub deductions: Vec<DeductionLine>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub reimbursements: Vec<ReimbursementLine>,
    /// Sum of earnings (pre-deduction).
    pub gross: f64,
    /// `gross - sum(deductions) + sum(reimbursements)`.
    pub net: f64,
    /// Cost-to-company including employer-side statutory contributions.
    pub ctc: f64,
}

/// Run-level rollup. Maintained denormalized so list views never
/// re-aggregate across the `employees` array.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PayrollTotals {
    pub gross: f64,
    pub net: f64,
    pub ctc: f64,
    pub employee_count: u32,
}

/// One step in the run's approval chain. Free-text `status` is one of
/// `"pending" | "approved" | "rejected"`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApprovalStep {
    pub approver_id: ObjectId,
    pub status: String,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub decided_at: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub comment: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PayrollRun {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /* ----- period + dates ---------------------------------------- */
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub period_from: DateTime<Utc>,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub period_to: DateTime<Utc>,
    /// Date the bank file is scheduled / executed against.
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub pay_date: Option<DateTime<Utc>>,
    /// After this date, employees can no longer change attendance /
    /// reimbursement inputs that affect the run.
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub lock_date: Option<DateTime<Utc>>,

    /* ----- per-employee figures + rollup ------------------------- */
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub employees: Vec<EmployeeRunRow>,
    #[serde(default)]
    pub totals: PayrollTotals,

    /* ----- bank file --------------------------------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bank_file_format: Option<BankFileFormat>,
    /// SabFile id of the rendered bank file once generated.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bank_file_id: Option<ObjectId>,

    /* ----- workflow ---------------------------------------------- */
    #[serde(default)]
    pub status: PayrollRunStatus,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub approvals: Vec<ApprovalStep>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trips_with_flattened_fragments() {
        let emp = ObjectId::new();
        let run = PayrollRun {
            identity: Identity {
                id: ObjectId::new(),
                project_id: ObjectId::new(),
                user_id: ObjectId::new(),
                tenant_id: None,
            },
            audit: Audit::new(None),
            period_from: Utc::now(),
            period_to: Utc::now(),
            pay_date: Some(Utc::now()),
            lock_date: None,
            employees: vec![EmployeeRunRow {
                employee_id: emp,
                earnings: vec![
                    EarningLine {
                        code: "BASIC".to_string(),
                        label: "Basic".to_string(),
                        amount: 40000.0,
                    },
                    EarningLine {
                        code: "HRA".to_string(),
                        label: "House Rent Allowance".to_string(),
                        amount: 20000.0,
                    },
                ],
                deductions: vec![DeductionLine {
                    code: "PF".to_string(),
                    label: "Provident Fund".to_string(),
                    amount: 1800.0,
                }],
                reimbursements: vec![ReimbursementLine {
                    category: "Internet".to_string(),
                    amount: 1500.0,
                    claim_id: Some(ObjectId::new()),
                }],
                gross: 60000.0,
                net: 59700.0,
                ctc: 65000.0,
            }],
            totals: PayrollTotals {
                gross: 60000.0,
                net: 59700.0,
                ctc: 65000.0,
                employee_count: 1,
            },
            bank_file_format: Some(BankFileFormat::UpiBulk),
            bank_file_id: None,
            status: PayrollRunStatus::Approved,
            approvals: vec![ApprovalStep {
                approver_id: ObjectId::new(),
                status: "approved".to_string(),
                decided_at: Some(Utc::now()),
                comment: Some("LGTM".to_string()),
            }],
        };

        let json = serde_json::to_value(&run).unwrap();

        // §0 fragments flatten to root.
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());

        // camelCase entity fields.
        assert!(json.get("periodFrom").is_some());
        assert!(json.get("periodTo").is_some());
        assert!(json.get("payDate").is_some());
        assert!(json.get("bankFileFormat").is_some());

        // Enum casing.
        assert_eq!(json["status"], "approved");
        assert_eq!(json["bankFileFormat"], "upi_bulk");

        // Nested camelCase.
        let row = &json["employees"][0];
        assert!(row.get("employeeId").is_some());
        assert_eq!(row["earnings"][0]["code"], "BASIC");

        // Round-trip back.
        let back: PayrollRun = serde_json::from_value(json).unwrap();
        assert_eq!(back.totals.employee_count, 1);
        assert_eq!(back.employees.len(), 1);
        assert!(matches!(back.status, PayrollRunStatus::Approved));
        assert!(matches!(
            back.bank_file_format,
            Some(BankFileFormat::UpiBulk)
        ));
        assert_eq!(back.employees[0].employee_id, emp);
    }
}
