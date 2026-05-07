//! §4.1 Account Groups / Chart of Accounts.
//!
//! Mongo collection: `crm_chart_of_accounts`. Models a single ledger
//! account in the workspace's chart of accounts. Accounts form a tree
//! via `parent_group_id` (self-reference) so the canonical "Group →
//! Sub-group → Ledger" hierarchy is expressible without a separate
//! group collection — a non-leaf account simply has children.
//!
//! The struct flattens the `crm-core` cross-cutting fragments
//! (`Identity`, `Audit`) so the document root carries the §0
//! ownership / audit fields directly.
//!
//! ### Spec (verbatim, §4.1)
//! > Code, Name ★, Parent group, Nature
//! > (assets/liabilities/equity/income/expense), Sub-nature, Affects
//! > gross profit?, Tax behavior, Currency, Opening balance + as-of
//! > date, Active?, Description.
//!
//! ### Modeling notes
//! - `sub_nature` and `tax_behavior` are free-form strings — every
//!   tenant has its own taxonomy ("current_asset" / "fixed_asset" /
//!   "operating_expense" / "taxable" / "exempt" / "zero_rated" / …)
//!   and we don't want a crate edit each time a country's tax regime
//!   adds a category.
//! - `OpeningBalanceEntry` is duplicated locally rather than reused
//!   from `crm-sales-types::OpeningBalance` because this crate does
//!   not (and should not) depend on the sales crate. The shape is
//!   identical so on-disk JSON is compatible.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Audit, Identity};
use serde::{Deserialize, Serialize};

/// Top-level classification of an account. Drives which financial
/// statement the account rolls up into.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AccountNature {
    #[default]
    Assets,
    Liabilities,
    Equity,
    Income,
    Expense,
}

/// Opening-balance pair (amount + as-of date). When migrating an
/// existing book in, this seeds the ledger so reports start from a
/// known baseline. Shape mirrors `crm-sales-types::OpeningBalance`
/// for cross-module consistency, kept local to avoid an inter-crate
/// dependency.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpeningBalanceEntry {
    pub amount: f64,
    pub as_of: DateTime<Utc>,
}

/// One ledger account in the chart of accounts.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Account {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /* ----- identity --------------------------------------------- */
    /// Tenant-assigned account code (e.g. "1100", "4000-A"). Free-form
    /// because numbering schemes vary by jurisdiction and accounting
    /// software the tenant migrated from.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
    /// Required ★ display name.
    pub name: String,
    /// Parent account in the chart-of-accounts tree. `None` → top
    /// level under the nature (e.g. "Current Assets" sitting directly
    /// under Assets).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent_group_id: Option<ObjectId>,

    /* ----- classification --------------------------------------- */
    pub nature: AccountNature,
    /// Free-form sub-classification — "current_asset", "fixed_asset",
    /// "long_term_liability", "operating_expense", "non_operating",
    /// etc. Kept as a string so every jurisdiction's vocabulary fits
    /// without a crate edit.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sub_nature: Option<String>,
    /// Whether transactions on this account contribute to gross
    /// profit. Typically true for direct income / COGS accounts and
    /// false for SG&A / financing accounts.
    #[serde(default, skip_serializing_if = "is_false")]
    pub affects_gross_profit: bool,
    /// Tax behavior tag — "taxable", "exempt", "zero_rated",
    /// "reverse_charge", … Free-form to track regional regimes.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tax_behavior: Option<String>,

    /* ----- money settings --------------------------------------- */
    /// ISO-4217 currency code the account is denominated in.
    pub currency: String,
    /// Optional opening balance + as-of date. Used when migrating an
    /// existing book in.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub opening_balance: Option<OpeningBalanceEntry>,

    /* ----- lifecycle + body ------------------------------------- */
    /// Whether the account is currently postable. Inactive accounts
    /// stay visible in reports but are hidden from voucher pickers.
    #[serde(default = "true_default", skip_serializing_if = "is_true")]
    pub active: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

fn is_false(b: &bool) -> bool {
    !*b
}

fn is_true(b: &bool) -> bool {
    *b
}

fn true_default() -> bool {
    true
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use crm_core::{Audit, Identity};

    fn ident() -> Identity {
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
    fn account_round_trips_with_flattened_fragments() {
        let acct = Account {
            identity: ident(),
            audit: audit(),
            code: Some("1100".into()),
            name: "Cash on Hand".into(),
            parent_group_id: Some(ObjectId::new()),
            nature: AccountNature::Assets,
            sub_nature: Some("current_asset".into()),
            affects_gross_profit: false,
            tax_behavior: Some("exempt".into()),
            currency: "INR".into(),
            opening_balance: Some(OpeningBalanceEntry {
                amount: 25_000.50,
                as_of: Utc::now(),
            }),
            active: true,
            description: Some("Petty cash drawer".into()),
        };

        let json = serde_json::to_value(&acct).unwrap();

        // Identity flattened.
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        // Audit flattened.
        assert!(json.get("createdAt").is_some());
        assert!(json.get("updatedAt").is_some());
        // No nested wrapper objects.
        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());
        // camelCase entity fields.
        assert!(json.get("parentGroupId").is_some());
        assert!(json.get("subNature").is_some());
        assert!(json.get("taxBehavior").is_some());
        assert!(json.get("openingBalance").is_some());
        // Default-false bool skipped.
        assert!(json.get("affectsGrossProfit").is_none());
        // Default-true `active` skipped.
        assert!(json.get("active").is_none());
        // Enum serializes lowercase.
        assert_eq!(json.get("nature").unwrap().as_str(), Some("assets"));
        // Opening balance shape.
        let ob = json.get("openingBalance").unwrap();
        assert!(ob.get("amount").is_some());
        assert!(ob.get("asOf").is_some());

        let back: Account = serde_json::from_value(json).unwrap();
        assert_eq!(back.name, "Cash on Hand");
        assert_eq!(back.nature, AccountNature::Assets);
        assert_eq!(back.currency, "INR");
        assert!(back.active, "default-true bool round-trips when skipped");
    }

    #[test]
    fn affects_gross_profit_serializes_when_true() {
        let acct = Account {
            identity: ident(),
            audit: audit(),
            code: None,
            name: "Sales".into(),
            parent_group_id: None,
            nature: AccountNature::Income,
            sub_nature: None,
            affects_gross_profit: true,
            tax_behavior: None,
            currency: "USD".into(),
            opening_balance: None,
            active: true,
            description: None,
        };
        let json = serde_json::to_value(&acct).unwrap();
        assert_eq!(
            json.get("affectsGrossProfit").and_then(|v| v.as_bool()),
            Some(true),
        );
        assert_eq!(json.get("nature").unwrap().as_str(), Some("income"));
    }
}
