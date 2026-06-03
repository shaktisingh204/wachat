//! §6.3 Reconciliation.
//!
//! Mongo collection: `crm_reconciliations`. One document per
//! (bank_account, period) reconciliation run. Captures the uploaded
//! statement reference, the match-rule configuration used, the auto-
//! and manual-match counts, any GL adjustments booked during the run,
//! and the closing-balance check + sign-off trail. Flattens the
//! cross-cutting `crm-core` fragments (`Identity`, `Audit`).

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Audit, Identity};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ReconciliationStatus {
    #[default]
    Draft,
    InProgress,
    SignedOff,
    Reopened,
}

/// One entry in the auto-match rule list. `field` selects which column
/// on the parsed statement row to compare against the candidate ledger
/// entry; `tolerance` is the allowed delta (currency units for amount,
/// days for date, edit-distance for reference).
///
/// Stored as a free-form string so the rule set can grow without a
/// schema change. Recognised values today: `"amount" | "reference" | "date"`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MatchRule {
    pub field: String,
    pub tolerance: f64,
}

/// A manual GL adjustment booked while reconciling — bank charges that
/// the books missed, interest credits, or one-off corrections. Each
/// adjustment posts to a ledger if `ledger_id` is supplied; otherwise
/// it is held as a pending entry until the accountant assigns one.
///
/// `kind` is free-form; recognised values:
/// `"bank_charge" | "interest" | "correction"`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Adjustment {
    pub kind: String,
    pub amount: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ledger_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Reconciliation {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /* ----- target account + period ------------------------------- */
    pub bank_account_id: ObjectId,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub period_from: DateTime<Utc>,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub period_to: DateTime<Utc>,

    /* ----- statement upload -------------------------------------- */
    /// SabFiles ref for the uploaded statement (CSV/MT940/OFX/Camt053).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub statement_file_id: Option<ObjectId>,

    /* ----- match config + results -------------------------------- */
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub match_rules: Vec<MatchRule>,
    /// Tolerance default applied when a rule does not specify its own
    /// (e.g. a global "any field within ±0.01" cushion).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tolerance: Option<f64>,
    #[serde(default)]
    pub auto_match_count: u32,
    #[serde(default)]
    pub manual_match_count: u32,

    /* ----- GL adjustments booked --------------------------------- */
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub adjustments: Vec<Adjustment>,

    /* ----- closing-balance check --------------------------------- */
    pub closing_balance_book: f64,
    pub closing_balance_bank: f64,
    /// `closing_balance_bank - closing_balance_book`. Stored explicitly
    /// (rather than derived) so reports don't have to recompute it and
    /// so a once-signed-off reconciliation is fixed even if either
    /// underlying balance later shifts.
    pub difference: f64,

    /* ----- sign-off trail ---------------------------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub signed_off_by: Option<ObjectId>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub signed_off_at: Option<DateTime<Utc>>,

    /* ----- workflow ---------------------------------------------- */
    #[serde(default)]
    pub status: ReconciliationStatus,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> Reconciliation {
        Reconciliation {
            identity: Identity {
                id: ObjectId::new(),
                project_id: ObjectId::new(),
                user_id: ObjectId::new(),
                tenant_id: None,
            },
            audit: Audit::new(None),
            bank_account_id: ObjectId::new(),
            period_from: Utc::now(),
            period_to: Utc::now(),
            statement_file_id: Some(ObjectId::new()),
            match_rules: vec![
                MatchRule {
                    field: "amount".into(),
                    tolerance: 0.01,
                },
                MatchRule {
                    field: "reference".into(),
                    tolerance: 2.0,
                },
                MatchRule {
                    field: "date".into(),
                    tolerance: 1.0,
                },
            ],
            tolerance: Some(0.01),
            auto_match_count: 184,
            manual_match_count: 7,
            adjustments: vec![
                Adjustment {
                    kind: "bank_charge".into(),
                    amount: -250.0,
                    ledger_id: Some(ObjectId::new()),
                    note: Some("Quarterly account-maintenance fee".into()),
                },
                Adjustment {
                    kind: "interest".into(),
                    amount: 1_842.55,
                    ledger_id: None,
                    note: None,
                },
            ],
            closing_balance_book: 1_250_000.00,
            closing_balance_bank: 1_251_592.55,
            difference: 1_592.55,
            signed_off_by: Some(ObjectId::new()),
            signed_off_at: Some(Utc::now()),
            status: ReconciliationStatus::SignedOff,
        }
    }

    #[test]
    fn round_trips_with_flattened_fragments() {
        let r = sample();
        let json = serde_json::to_value(&r).unwrap();

        // Flattened crm-core fragments.
        assert!(json.get("identity").is_none(), "Identity must flatten");
        assert!(json.get("audit").is_none(), "Audit must flatten");
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("updatedAt").is_some());

        // camelCase entity fields.
        assert!(json.get("bankAccountId").is_some());
        assert!(json.get("periodFrom").is_some());
        assert!(json.get("periodTo").is_some());
        assert!(json.get("statementFileId").is_some());
        assert!(json.get("matchRules").is_some());
        assert!(json.get("autoMatchCount").is_some());
        assert!(json.get("manualMatchCount").is_some());
        assert!(json.get("closingBalanceBook").is_some());
        assert!(json.get("closingBalanceBank").is_some());
        assert!(json.get("signedOffBy").is_some());
        assert!(json.get("signedOffAt").is_some());

        // snake_case multi-word enum check.
        assert_eq!(
            serde_json::to_string(&ReconciliationStatus::SignedOff).unwrap(),
            "\"signed_off\""
        );
        assert_eq!(
            serde_json::to_string(&ReconciliationStatus::InProgress).unwrap(),
            "\"in_progress\""
        );

        // Round-trip back.
        let s = serde_json::to_string(&r).unwrap();
        let back: Reconciliation = serde_json::from_str(&s).unwrap();
        assert_eq!(back.bank_account_id, r.bank_account_id);
        assert_eq!(back.auto_match_count, r.auto_match_count);
        assert_eq!(back.manual_match_count, r.manual_match_count);
        assert_eq!(back.adjustments.len(), r.adjustments.len());
        assert_eq!(back.difference, r.difference);
        assert_eq!(back.status, r.status);
    }
}
