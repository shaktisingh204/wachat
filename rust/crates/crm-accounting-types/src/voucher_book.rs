//! §4.2 Voucher Books.
//!
//! Mongo collection: `crm_voucher_books`. A voucher book is a numbered
//! series the workspace uses to issue accounting documents — sales
//! invoices, purchase bills, payment vouchers, journal entries, …
//! Each book owns its own auto-incrementing counter, prefix/suffix,
//! padding, and reset cadence so a tenant can run separate sequences
//! for, e.g., "INV-FY2025-0001" vs "INV-FY2026-0001".
//!
//! The struct flattens the `crm-core` cross-cutting fragments
//! (`Identity`, `Audit`) so the document root carries the §0
//! ownership / audit fields directly.
//!
//! ### Spec (verbatim, §4.2)
//! > Type
//! > (sales/purchase/payment/receipt/contra/journal/credit-note/debit-note),
//! > Name ★, Prefix, Suffix, Starting number, Padding, Reset frequency
//! > (none/yearly/monthly), Active?, Default for module?, Approval
//! > required?, Approvers[].

use bson::oid::ObjectId;
use crm_core::{Audit, Identity};
use serde::{Deserialize, Serialize};

/// Document family this voucher book issues. Each value maps to a
/// distinct accounting flow — invoice / bill / payment / receipt /
/// internal-cash-transfer / journal / credit-note / debit-note.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum VoucherBookType {
    #[default]
    Sales,
    Purchase,
    Payment,
    Receipt,
    Contra,
    Journal,
    CreditNote,
    DebitNote,
}

/// How often the auto-incrementing counter resets back to
/// `starting_number`. Tenants on the Indian fiscal year typically use
/// `Yearly` so series like "INV-FY2025-0001" / "INV-FY2026-0001"
/// renumber on April 1.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ResetFrequency {
    #[default]
    None,
    Yearly,
    Monthly,
}

/// Numbered voucher book.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VoucherBook {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /* ----- identity --------------------------------------------- */
    pub book_type: VoucherBookType,
    /// Required ★ display name (e.g. "Domestic Sales", "Petty Cash
    /// Receipts").
    pub name: String,

    /* ----- numbering knobs -------------------------------------- */
    /// Static prefix prepended to the issued number, e.g. "INV-".
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub prefix: Option<String>,
    /// Static suffix appended to the issued number, e.g. "/FY25".
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub suffix: Option<String>,
    /// First counter value emitted. Most tenants leave this at 1.
    pub starting_number: u32,
    /// Zero-pad width for the numeric portion. e.g. `padding = 5`
    /// renders counter `1` as `"00001"`. `0` disables padding.
    pub padding: u8,
    #[serde(default)]
    pub reset_frequency: ResetFrequency,

    /* ----- lifecycle + governance ------------------------------- */
    #[serde(default = "true_default", skip_serializing_if = "is_true")]
    pub active: bool,
    /// Marks this book as the default for its `book_type` in the
    /// workspace — pickers preselect it. At most one book per type
    /// should carry the flag (enforced at the action layer, not the
    /// DTO).
    #[serde(default, skip_serializing_if = "is_false")]
    pub default_for_module: bool,
    /// Whether vouchers issued in this book require approval before
    /// they hit the ledger.
    #[serde(default, skip_serializing_if = "is_false")]
    pub approval_required: bool,
    /// User ids that can approve vouchers in this book. Order is not
    /// significant; any one of them can approve unless the consuming
    /// flow imposes a sequence.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub approvers: Vec<ObjectId>,
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
    fn voucher_book_round_trips_with_flattened_fragments() {
        let book = VoucherBook {
            identity: ident(),
            audit: audit(),
            book_type: VoucherBookType::CreditNote,
            name: "Domestic Credit Notes".into(),
            prefix: Some("CN-".into()),
            suffix: Some("/FY25".into()),
            starting_number: 1,
            padding: 5,
            reset_frequency: ResetFrequency::Yearly,
            active: true,
            default_for_module: false,
            approval_required: true,
            approvers: vec![ObjectId::new(), ObjectId::new()],
        };

        let json = serde_json::to_value(&book).unwrap();

        // Identity + audit flattened to root.
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("updatedAt").is_some());
        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());

        // camelCase entity fields.
        assert!(json.get("bookType").is_some());
        assert!(json.get("startingNumber").is_some());
        assert!(json.get("resetFrequency").is_some());
        assert!(json.get("approvalRequired").is_some());
        assert!(json.get("approvers").is_some());

        // Multi-word enum variant snake_case.
        assert_eq!(json.get("bookType").unwrap().as_str(), Some("credit_note"));
        // Single-word enum variant lowercase.
        assert_eq!(json.get("resetFrequency").unwrap().as_str(), Some("yearly"),);

        // Default-false bools skipped, default-true skipped.
        assert!(json.get("defaultForModule").is_none());
        assert!(json.get("active").is_none());

        let back: VoucherBook = serde_json::from_value(json).unwrap();
        assert_eq!(back.name, "Domestic Credit Notes");
        assert_eq!(back.book_type, VoucherBookType::CreditNote);
        assert_eq!(back.reset_frequency, ResetFrequency::Yearly);
        assert_eq!(back.padding, 5);
        assert!(back.active, "default-true bool round-trips when skipped");
        assert!(!back.default_for_module);
        assert_eq!(back.approvers.len(), 2);
    }

    #[test]
    fn empty_optionals_skip_serializing() {
        let book = VoucherBook {
            identity: ident(),
            audit: audit(),
            book_type: VoucherBookType::Journal,
            name: "Manual Journals".into(),
            prefix: None,
            suffix: None,
            starting_number: 1,
            padding: 0,
            reset_frequency: ResetFrequency::None,
            active: true,
            default_for_module: false,
            approval_required: false,
            approvers: vec![],
        };
        let json = serde_json::to_value(&book).unwrap();
        assert!(json.get("prefix").is_none());
        assert!(json.get("suffix").is_none());
        assert!(json.get("approvers").is_none());
        assert!(json.get("approvalRequired").is_none());
        assert_eq!(json.get("bookType").unwrap().as_str(), Some("journal"));
        assert_eq!(json.get("resetFrequency").unwrap().as_str(), Some("none"));
    }
}
