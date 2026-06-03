//! §9.9 Statutory Compliance — DTOs.
//!
//! Five separate Mongo collections, one per statutory artifact:
//!   - `crm_compliance_pf`        — `PfRecord`
//!   - `crm_compliance_esi`       — `EsiRecord`
//!   - `crm_compliance_pt`        — `PtRecord`
//!   - `crm_compliance_tds`       — `TdsRecord`
//!   - `crm_compliance_form16`    — `Form16`
//!
//! All five flatten the `crm-core` cross-cutting `Identity` + `Audit`
//! fragments at the document root.
//!
//! Spec (§9.9 verbatim):
//! > PF: UAN, PF no., employer/employee %, wage ceiling, PF challan upload.
//! > ESI: ESI no., employer/employee %, wage ceiling, ESI challan.
//! > PT: state, slabs, monthly amount, challan.
//! > TDS: section (192/194C/194J/...), PAN, deductee type, gross,
//! >      deduction, challan, certificate.
//! > Form 16: AY, employer TAN, Part A (TDS summary), Part B (income
//! >      computation), digital signature, dispatch log.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Audit, Identity};
use serde::{Deserialize, Serialize};

/* ===================== PF ===================== */

/// Provident Fund monthly record. One row per (employee, period).
/// `challan_file_id` references a SabFiles upload of the bank/EPFO
/// challan PDF; `challan_no` is the EPFO-issued reference once filed.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PfRecord {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    pub employee_id: ObjectId,

    /// Universal Account Number (12-digit EPFO id).
    pub uan: String,
    /// Establishment-issued PF account number.
    pub pf_no: String,

    /// Employer contribution percentage of wage (e.g. 12.0).
    pub employer_pct: f32,
    /// Employee contribution percentage of wage.
    pub employee_pct: f32,

    /// Statutory wage ceiling (e.g. 15_000.0 INR/month).
    pub wage_ceiling: f64,

    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub period_from: DateTime<Utc>,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub period_to: DateTime<Utc>,

    /// SabFiles upload of the challan PDF.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub challan_file_id: Option<ObjectId>,
    /// EPFO-issued challan reference number (TRRN).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub challan_no: Option<String>,

    /// Free-form lifecycle: `"pending"` | `"filed"`.
    pub status: String,
}

/* ===================== ESI ===================== */

/// Employees' State Insurance monthly record.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EsiRecord {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    pub employee_id: ObjectId,

    /// 17-digit ESIC insurance number.
    pub esi_no: String,

    pub employer_pct: f32,
    pub employee_pct: f32,

    /// Statutory wage ceiling for ESI eligibility.
    pub wage_ceiling: f64,

    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub period_from: DateTime<Utc>,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub period_to: DateTime<Utc>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub challan_file_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub challan_no: Option<String>,

    /// `"pending"` | `"filed"`.
    pub status: String,
}

/* ===================== PT ===================== */

/// One row of the state's Professional Tax slab table. `up_to = None`
/// represents the open-ended (highest) bracket — i.e. "above the last
/// numeric bound, monthly_amount applies".
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PtSlab {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub up_to: Option<f64>,
    pub monthly_amount: f64,
}

/// Professional Tax monthly record. `state` keys the slab table because
/// PT is state-specific in India (Maharashtra, Karnataka, WB, ...).
/// `monthly_amount` is the resolved deduction for this employee in this
/// period, derived from `slabs` at calc time.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PtRecord {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    pub employee_id: ObjectId,

    /// Two-letter state code or full state name (free-form, tenant-set).
    pub state: String,

    /// Snapshot of the slab table that produced `monthly_amount` —
    /// captured per-record so historical recompute is reproducible.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub slabs: Vec<PtSlab>,

    pub monthly_amount: f64,

    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub period_from: DateTime<Utc>,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub period_to: DateTime<Utc>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub challan_file_id: Option<ObjectId>,

    /// `"pending"` | `"filed"`.
    pub status: String,
}

/* ===================== TDS ===================== */

/// Tax Deducted at Source. May target an employee (section 192 — salary)
/// or a vendor (194C contractor, 194J professional, ...). Exactly one of
/// `employee_id` / `vendor_id` is populated for any given record.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TdsRecord {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub employee_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub vendor_id: Option<ObjectId>,

    /// Income Tax Act section: `"192"` | `"194C"` | `"194J"` | ...
    pub section: String,

    /// Permanent Account Number of the deductee.
    pub pan: String,

    /// `"individual"` | `"company"` | `"hindu_undivided_family"` |
    /// `"firm"` | `"trust"`.
    pub deductee_type: String,

    pub gross_amount: f64,
    pub deduction_amount: f64,

    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub period_from: DateTime<Utc>,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub period_to: DateTime<Utc>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub challan_file_id: Option<ObjectId>,
    /// SabFiles upload of the Form 16A / 16B certificate PDF.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub certificate_file_id: Option<ObjectId>,

    /// `"pending"` | `"filed"`.
    pub status: String,
}

/* ===================== Form 16 ===================== */

/// Form 16 Part A — TDS summary block (quarterly TDS deposited
/// against the employee's PAN). The IRP/TRACES schema is opaque and
/// IRP-mandated; we keep it as `serde_json::Value` so future format
/// tweaks don't churn the Rust DTO.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Form16PartA {
    pub tds_summary: serde_json::Value,
}

/// Form 16 Part B — full income computation (gross salary, exemptions,
/// chapter VI-A deductions, taxable income, tax liability). Stored
/// opaque for the same reason as Part A.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Form16PartB {
    pub income_computation: serde_json::Value,
}

/// Audit record of every dispatch attempt — email send, portal download,
/// re-issue. One row appended per attempt.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Form16Dispatch {
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub at: DateTime<Utc>,
    /// `"email"` | `"download"`.
    pub channel: String,
    /// Email address or user identifier the dispatch went to.
    pub recipient: String,
    pub status: String,
}

/// Form 16 — annual TDS-on-salary certificate. One per (employee,
/// assessment_year). `assessment_year` follows the AY convention
/// ("2026-27" = FY 2025-26 income).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Form16 {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    pub employee_id: ObjectId,

    /// e.g. "2026-27".
    pub assessment_year: String,
    /// Tax Deduction & Collection Account Number of the employer.
    pub employer_tan: String,

    pub part_a: Form16PartA,
    pub part_b: Form16PartB,

    /// SabFiles upload of the digitally-signed PDF (CA / DSC signed).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub digital_signature_file_id: Option<ObjectId>,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub dispatch_log: Vec<Form16Dispatch>,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_identity() -> Identity {
        Identity {
            id: ObjectId::new(),
            project_id: ObjectId::new(),
            user_id: ObjectId::new(),
            tenant_id: None,
        }
    }

    #[test]
    fn pf_record_round_trips_with_flattened_fragments() {
        let pf = PfRecord {
            identity: sample_identity(),
            audit: Audit::new(None),
            employee_id: ObjectId::new(),
            uan: "100123456789".into(),
            pf_no: "MH/BAN/12345/000/0001234".into(),
            employer_pct: 12.0,
            employee_pct: 12.0,
            wage_ceiling: 15_000.0,
            period_from: Utc::now(),
            period_to: Utc::now(),
            challan_file_id: Some(ObjectId::new()),
            challan_no: Some("TRRN-9988".into()),
            status: "filed".into(),
        };

        let json = serde_json::to_value(&pf).unwrap();
        assert!(json.get("identity").is_none(), "Identity must flatten");
        assert!(json.get("audit").is_none(), "Audit must flatten");
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("employeeId").is_some());
        assert!(json.get("uan").is_some());
        assert!(json.get("pfNo").is_some());
        assert!(json.get("employerPct").is_some());
        assert!(json.get("wageCeiling").is_some());
        assert!(json.get("challanNo").is_some());
        assert_eq!(json.get("status").and_then(|v| v.as_str()), Some("filed"));

        let back: PfRecord = serde_json::from_value(json).unwrap();
        assert_eq!(back.uan, "100123456789");
        assert_eq!(back.employer_pct, 12.0);
    }

    #[test]
    fn esi_record_round_trips_with_flattened_fragments() {
        let esi = EsiRecord {
            identity: sample_identity(),
            audit: Audit::new(None),
            employee_id: ObjectId::new(),
            esi_no: "31001234567890123".into(),
            employer_pct: 3.25,
            employee_pct: 0.75,
            wage_ceiling: 21_000.0,
            period_from: Utc::now(),
            period_to: Utc::now(),
            challan_file_id: None,
            challan_no: None,
            status: "pending".into(),
        };

        let json = serde_json::to_value(&esi).unwrap();
        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());
        assert!(json.get("_id").is_some());
        assert!(json.get("esiNo").is_some());
        assert!(json.get("employerPct").is_some());
        assert!(json.get("wageCeiling").is_some());
        assert!(json.get("challanFileId").is_none(), "None should skip");
        assert!(json.get("challanNo").is_none(), "None should skip");

        let back: EsiRecord = serde_json::from_value(json).unwrap();
        assert_eq!(back.esi_no, "31001234567890123");
        assert_eq!(back.status, "pending");
    }

    #[test]
    fn pt_record_round_trips_with_flattened_fragments() {
        let pt = PtRecord {
            identity: sample_identity(),
            audit: Audit::new(None),
            employee_id: ObjectId::new(),
            state: "Maharashtra".into(),
            slabs: vec![
                PtSlab {
                    up_to: Some(7_500.0),
                    monthly_amount: 0.0,
                },
                PtSlab {
                    up_to: Some(10_000.0),
                    monthly_amount: 175.0,
                },
                PtSlab {
                    up_to: None,
                    monthly_amount: 200.0,
                },
            ],
            monthly_amount: 200.0,
            period_from: Utc::now(),
            period_to: Utc::now(),
            challan_file_id: Some(ObjectId::new()),
            status: "filed".into(),
        };

        let json = serde_json::to_value(&pt).unwrap();
        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());
        assert!(json.get("_id").is_some());
        assert!(json.get("state").is_some());
        assert!(json.get("monthlyAmount").is_some());
        let slabs = json.get("slabs").unwrap().as_array().unwrap();
        assert_eq!(slabs.len(), 3);
        // Open-ended bracket: `upTo` must be absent (None skip-serializes).
        assert!(slabs[2].get("upTo").is_none());

        let back: PtRecord = serde_json::from_value(json).unwrap();
        assert_eq!(back.state, "Maharashtra");
        assert_eq!(back.slabs.len(), 3);
        assert_eq!(back.slabs[2].up_to, None);
    }

    #[test]
    fn tds_record_round_trips_with_flattened_fragments() {
        let tds = TdsRecord {
            identity: sample_identity(),
            audit: Audit::new(None),
            employee_id: None,
            vendor_id: Some(ObjectId::new()),
            section: "194J".into(),
            pan: "ABCDE1234F".into(),
            deductee_type: "individual".into(),
            gross_amount: 100_000.0,
            deduction_amount: 10_000.0,
            period_from: Utc::now(),
            period_to: Utc::now(),
            challan_file_id: Some(ObjectId::new()),
            certificate_file_id: Some(ObjectId::new()),
            status: "filed".into(),
        };

        let json = serde_json::to_value(&tds).unwrap();
        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());
        assert!(json.get("_id").is_some());
        assert!(json.get("employeeId").is_none(), "None should skip");
        assert!(json.get("vendorId").is_some());
        assert!(json.get("section").is_some());
        assert!(json.get("pan").is_some());
        assert!(json.get("deducteeType").is_some());
        assert!(json.get("grossAmount").is_some());
        assert!(json.get("deductionAmount").is_some());
        assert!(json.get("certificateFileId").is_some());

        let back: TdsRecord = serde_json::from_value(json).unwrap();
        assert_eq!(back.section, "194J");
        assert_eq!(back.pan, "ABCDE1234F");
        assert_eq!(back.deductee_type, "individual");
        assert!(back.employee_id.is_none());
    }

    #[test]
    fn form16_round_trips_with_flattened_fragments() {
        let form = Form16 {
            identity: sample_identity(),
            audit: Audit::new(None),
            employee_id: ObjectId::new(),
            assessment_year: "2026-27".into(),
            employer_tan: "BLRA12345B".into(),
            part_a: Form16PartA {
                tds_summary: serde_json::json!({ "q1": 12500, "q2": 12500 }),
            },
            part_b: Form16PartB {
                income_computation: serde_json::json!({
                    "gross_salary": 1_200_000,
                    "taxable_income": 950_000,
                }),
            },
            digital_signature_file_id: Some(ObjectId::new()),
            dispatch_log: vec![Form16Dispatch {
                at: Utc::now(),
                channel: "email".into(),
                recipient: "alice@example.com".into(),
                status: "sent".into(),
            }],
        };

        let json = serde_json::to_value(&form).unwrap();
        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());
        assert!(json.get("_id").is_some());
        assert!(json.get("assessmentYear").is_some());
        assert!(json.get("employerTan").is_some());
        assert!(json.get("partA").is_some());
        assert!(json.get("partB").is_some());
        assert!(json.get("digitalSignatureFileId").is_some());
        let log = json.get("dispatchLog").unwrap().as_array().unwrap();
        assert_eq!(log.len(), 1);
        assert_eq!(
            log[0].get("channel").and_then(|v| v.as_str()),
            Some("email")
        );

        let back: Form16 = serde_json::from_value(json).unwrap();
        assert_eq!(back.assessment_year, "2026-27");
        assert_eq!(back.dispatch_log.len(), 1);
        assert_eq!(back.dispatch_log[0].recipient, "alice@example.com");
    }
}
