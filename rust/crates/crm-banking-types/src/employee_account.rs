//! §6.2 Employee Bank Accounts.
//!
//! Same shape as §6.1 `BankAccount` but linked to an `employee_id` and
//! carrying a `is_salary_disbursement_default` flag. The collection-level
//! choice (single `crm_payment_accounts` collection with a discriminator
//! vs. a dedicated `crm_employee_bank_accounts` collection) is deferred
//! to the consumer crate — at the DTO layer this is simply a sibling
//! struct that redeclares all fields rather than composing on top of
//! `BankAccount`.
//!
//! Enums + the auto-fetch helper are reused from `bank_account` to keep
//! "an account is an account" semantics consistent across the module.

use super::bank_account::{AccountType, AutoFetchConfig, StatementFormat};
use bson::oid::ObjectId;
use crm_core::{Audit, Identity};
use crm_sales_types::OpeningBalance;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmployeeBankAccount {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /* ----- HR linkage -------------------------------------------- */
    /// FK into the employees collection. Mandatory — an employee bank
    /// account doesn't exist without an owning employee.
    pub employee_id: ObjectId,
    /// When `true`, payroll picks this account as the salary credit
    /// destination if the employee has multiple registered accounts.
    #[serde(default, skip_serializing_if = "is_false")]
    pub is_salary_disbursement_default: bool,

    /* ----- required identifiers ---------------------------------- */
    pub account_name: String,
    pub bank_name: String,
    pub account_no: String,
    pub ifsc: String,

    /* ----- optional bank coordinates ----------------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub branch: Option<String>,
    #[serde(default)]
    pub account_type: AccountType,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,

    /* ----- ledger seed ------------------------------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub opening_balance: Option<OpeningBalance>,
    /// FK into the chart-of-accounts ledger this account posts to.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub gl_ledger_id: Option<ObjectId>,

    /* ----- statement + auto-fetch -------------------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub statement_format: Option<StatementFormat>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub auto_fetch: Option<AutoFetchConfig>,

    /* ----- flags ------------------------------------------------- */
    #[serde(default = "default_true", skip_serializing_if = "is_true")]
    pub is_active: bool,
    #[serde(default, skip_serializing_if = "is_false")]
    pub is_default: bool,

    /* ----- alternate rails --------------------------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub upi_vpa: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub swift: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub iban: Option<String>,
}

fn is_false(b: &bool) -> bool {
    !*b
}

fn is_true(b: &bool) -> bool {
    *b
}

fn default_true() -> bool {
    true
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    fn sample() -> EmployeeBankAccount {
        EmployeeBankAccount {
            identity: Identity {
                id: ObjectId::new(),
                project_id: ObjectId::new(),
                user_id: ObjectId::new(),
                tenant_id: None,
            },
            audit: Audit::new(None),
            employee_id: ObjectId::new(),
            is_salary_disbursement_default: true,
            account_name: "Asha Iyer Salary".into(),
            bank_name: "ICICI Bank".into(),
            account_no: "001401234567".into(),
            ifsc: "ICIC0000014".into(),
            branch: Some("Koramangala".into()),
            account_type: AccountType::Savings,
            currency: Some("INR".into()),
            opening_balance: Some(OpeningBalance {
                amount: 0.0,
                as_of: Utc::now(),
            }),
            gl_ledger_id: None,
            statement_format: Some(StatementFormat::Ofx),
            auto_fetch: None,
            is_active: true,
            is_default: false,
            upi_vpa: Some("asha@icici".into()),
            swift: None,
            iban: None,
        }
    }

    #[test]
    fn round_trips_with_flattened_fragments() {
        let a = sample();
        let json = serde_json::to_value(&a).unwrap();

        // Flattened crm-core fragments.
        assert!(json.get("identity").is_none(), "Identity must flatten");
        assert!(json.get("audit").is_none(), "Audit must flatten");
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("updatedAt").is_some());

        // camelCase entity fields.
        assert!(json.get("employeeId").is_some());
        assert!(json.get("isSalaryDisbursementDefault").is_some());
        assert!(json.get("accountName").is_some());
        assert!(json.get("bankName").is_some());
        assert!(json.get("accountNo").is_some());
        assert!(json.get("ifsc").is_some());
        assert!(json.get("accountType").is_some());
        assert!(json.get("statementFormat").is_some());

        // Round-trip back.
        let s = serde_json::to_string(&a).unwrap();
        let back: EmployeeBankAccount = serde_json::from_str(&s).unwrap();
        assert_eq!(back.employee_id, a.employee_id);
        assert_eq!(
            back.is_salary_disbursement_default,
            a.is_salary_disbursement_default
        );
        assert_eq!(back.account_no, a.account_no);
        assert_eq!(back.account_type, a.account_type);
    }
}
