//! §6.1 Bank Accounts.
//!
//! Mongo collection: `crm_payment_accounts`. This is the authoritative
//! account ledger that every receipt / payment / transfer / reconciliation
//! references via `bank_account_id`. The struct flattens the cross-cutting
//! `crm-core` fragments (`Identity`, `Audit`) so the document root carries
//! the §0 ownership / audit fields directly.
//!
//! Per spec: Account name, Bank name, Account no., IFSC are required;
//! Branch, Account type, Currency, Opening balance + as-of, GL ledger,
//! Statement format, Auto-fetch, Active?, Default?, UPI VPA, SWIFT,
//! IBAN are optional.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Audit, Identity};
use crm_sales_types::OpeningBalance;
use serde::{Deserialize, Serialize};

/// Account type enum. Stored snake_case for clarity (`overdraft`,
/// `cash_credit`) rather than the bank-shorthand "od"/"cc" so reports
/// and filters read naturally.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AccountType {
    #[default]
    Savings,
    Current,
    Overdraft,
    CashCredit,
}

/// Statement file format the bank delivers (or that auto-fetch produces).
/// Used by the reconciliation parser to pick a decoder.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum StatementFormat {
    #[default]
    Csv,
    Mt940,
    Ofx,
    Camt053,
}

/// Auto-fetch / open-banking config. `credentials_ref` is an opaque
/// pointer into the secret store — the actual API keys never live in
/// this document.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutoFetchConfig {
    /// Provider key: `"yodlee" | "plaid" | "finicity" | "manual"`.
    pub provider: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub credentials_ref: Option<String>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub last_synced_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BankAccount {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

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
    /// FK into the chart-of-accounts ledger this bank account posts to.
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

    fn sample() -> BankAccount {
        BankAccount {
            identity: Identity {
                id: ObjectId::new(),
                project_id: ObjectId::new(),
                user_id: ObjectId::new(),
                tenant_id: None,
            },
            audit: Audit::new(None),
            account_name: "Operations - HDFC".into(),
            bank_name: "HDFC Bank".into(),
            account_no: "50100123456789".into(),
            ifsc: "HDFC0000123".into(),
            branch: Some("Indiranagar".into()),
            account_type: AccountType::Current,
            currency: Some("INR".into()),
            opening_balance: Some(OpeningBalance {
                amount: 250_000.0,
                as_of: Utc::now(),
            }),
            gl_ledger_id: Some(ObjectId::new()),
            statement_format: Some(StatementFormat::Csv),
            auto_fetch: Some(AutoFetchConfig {
                provider: "plaid".into(),
                credentials_ref: Some("vault://banking/plaid/acct-1".into()),
                last_synced_at: Some(Utc::now()),
            }),
            is_active: true,
            is_default: true,
            upi_vpa: Some("ops@hdfcbank".into()),
            swift: Some("HDFCINBB".into()),
            iban: None,
        }
    }

    #[test]
    fn round_trips_with_flattened_fragments() {
        let a = sample();
        let json = serde_json::to_value(&a).unwrap();

        // Identity + Audit must flatten to root.
        assert!(json.get("identity").is_none(), "Identity must flatten");
        assert!(json.get("audit").is_none(), "Audit must flatten");
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("updatedAt").is_some());

        // camelCase entity fields.
        assert!(json.get("accountName").is_some());
        assert!(json.get("bankName").is_some());
        assert!(json.get("accountNo").is_some());
        assert!(json.get("ifsc").is_some());
        assert!(json.get("accountType").is_some());
        assert!(json.get("openingBalance").is_some());
        assert!(json.get("glLedgerId").is_some());
        assert!(json.get("statementFormat").is_some());
        assert!(json.get("autoFetch").is_some());
        assert!(json.get("upiVpa").is_some());

        // snake_case multi-word enum check.
        assert_eq!(
            serde_json::to_string(&AccountType::CashCredit).unwrap(),
            "\"cash_credit\""
        );
        assert_eq!(
            serde_json::to_string(&AccountType::Overdraft).unwrap(),
            "\"overdraft\""
        );
        // lowercase enum check.
        assert_eq!(
            serde_json::to_string(&StatementFormat::Mt940).unwrap(),
            "\"mt940\""
        );

        // Round-trip back.
        let s = serde_json::to_string(&a).unwrap();
        let back: BankAccount = serde_json::from_str(&s).unwrap();
        assert_eq!(back.account_name, a.account_name);
        assert_eq!(back.ifsc, a.ifsc);
        assert_eq!(back.account_type, a.account_type);
        assert_eq!(back.is_default, a.is_default);
    }
}
