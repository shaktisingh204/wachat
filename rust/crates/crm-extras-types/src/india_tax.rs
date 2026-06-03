//! §12.27 India Tax (GST + e-invoice + e-way bill + ITC + RCM + MSME).
//!
//! Mongo collections: `crm_hsn_sac`, `crm_gst_slabs`,
//! `crm_einvoice_credentials`, `crm_eway_credentials`, `crm_gstr_returns`,
//! `crm_itc_ledger`, `crm_rcm_register`, `crm_msme_alerts`. Covers the
//! HSN/SAC master, GST rate slabs, IRP / EWB credentials, GSTR
//! generation + reconciliation, the input-tax-credit ledger, the
//! reverse-charge register and the MSME 45-day overdue alert log.
//!
//! Every struct flattens the `crm-core` `Identity` + `Audit` fragments
//! so the document root carries §0 ownership and audit fields directly.
//! Credential fields end in `_ref` because they store secret-store
//! lookup keys, never raw secrets.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Audit, Identity};
use serde::{Deserialize, Serialize};

/// Whether an HSN/SAC code classifies a good (HSN) or a service (SAC).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum HsnSacKind {
    #[default]
    Hsn,
    Sac,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HsnSacEntry {
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    pub code: String,
    pub kind: HsnSacKind,
    pub description: String,
    pub gst_rate_pct: f32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cess_pct: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GstSlab {
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    pub rate_pct: f32,
    pub description: String,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub effective_from: DateTime<Utc>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub effective_until: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EInvoiceCredentials {
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    pub gstin: String,
    /// Secret-store key for the IRP username. Never stores the literal.
    pub username_ref: String,
    /// Secret-store key for the IRP password.
    pub password_ref: String,
    pub irp_url: String,
    /// `"sandbox" | "production"`.
    pub environment: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EwayBillCredentials {
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    pub gstin: String,
    pub username_ref: String,
    pub password_ref: String,
    pub ewb_url: String,
    pub environment: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GstrReturn {
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /// `"gstr1" | "gstr2b" | "gstr3b" | "gstr9"`.
    pub kind: String,
    /// Period in `YYYY-MM` form (annual returns use `YYYY`).
    pub period: String,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub generated_at: DateTime<Utc>,
    /// SabFiles id of the generated JSON / PDF.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub file_id: Option<ObjectId>,
    /// `"draft" | "filed" | "reconciled"`.
    pub status: String,
    /// Period-level summary (taxable value, IGST, CGST, SGST, cess, …).
    #[serde(default)]
    pub summary: serde_json::Value,
    /// Reconciliation deltas vs books (matched / mismatched / missing).
    #[serde(default)]
    pub reconciliation: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ItcLedgerEntry {
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    pub period: String,
    pub igst: f64,
    pub cgst: f64,
    pub sgst: f64,
    pub cess: f64,
    /// Source document kind (`"bill"`, `"debit_note"`, …).
    pub source_doc_kind: String,
    pub source_doc_id: ObjectId,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub posted_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RcmRegisterEntry {
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    pub period: String,
    pub vendor_id: ObjectId,
    pub taxable_value: f64,
    pub igst: f64,
    pub cgst: f64,
    pub sgst: f64,
    /// `"liable" | "paid" | "itc_claimed"`.
    pub status: String,
}

/// MSME 45-day rule alert — a reminder/escalation when a payment to a
/// registered MSME vendor crosses the statutory 45-day window.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MsmeAlert {
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    pub vendor_id: ObjectId,
    pub bill_id: ObjectId,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub due_date: DateTime<Utc>,
    pub days_overdue: u32,
    /// `"warning" | "escalated" | "resolved"`.
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
    fn hsn_sac_entry_round_trips_with_flattened_fragments() {
        let entry = HsnSacEntry {
            identity: identity(),
            audit: audit(),
            code: "998314".to_string(),
            kind: HsnSacKind::Sac,
            description: "IT consulting".to_string(),
            gst_rate_pct: 18.0,
            cess_pct: None,
        };
        let json = serde_json::to_value(&entry).unwrap();
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());
        assert_eq!(json.get("kind").unwrap(), "sac");
        assert!(json.get("gstRatePct").is_some());

        let back: HsnSacEntry = serde_json::from_value(json).unwrap();
        assert_eq!(back.code, "998314");
        assert!(matches!(back.kind, HsnSacKind::Sac));
    }

    #[test]
    fn gstr_return_round_trips() {
        let ret = GstrReturn {
            identity: identity(),
            audit: audit(),
            kind: "gstr1".to_string(),
            period: "2026-04".to_string(),
            generated_at: Utc::now(),
            file_id: None,
            status: "draft".to_string(),
            summary: serde_json::json!({ "taxableValue": 1_000_000.0 }),
            reconciliation: serde_json::json!({ "matched": 12 }),
        };
        let json = serde_json::to_value(&ret).unwrap();
        assert_eq!(json.get("period").unwrap(), "2026-04");
        assert!(json.get("generatedAt").is_some());

        let back: GstrReturn = serde_json::from_value(json).unwrap();
        assert_eq!(back.status, "draft");
    }

    #[test]
    fn msme_alert_round_trips() {
        let alert = MsmeAlert {
            identity: identity(),
            audit: audit(),
            vendor_id: ObjectId::new(),
            bill_id: ObjectId::new(),
            due_date: Utc::now(),
            days_overdue: 7,
            status: "warning".to_string(),
        };
        let json = serde_json::to_value(&alert).unwrap();
        assert!(json.get("daysOverdue").is_some());
        assert!(json.get("vendorId").is_some());

        let back: MsmeAlert = serde_json::from_value(json).unwrap();
        assert_eq!(back.days_overdue, 7);
    }
}
