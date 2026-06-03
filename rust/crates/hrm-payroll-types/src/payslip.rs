//! §9.8 Payslips.
//!
//! Mongo collection: `crm_payslips`. Auto-generated per employee per
//! payroll run. The payslip is a frozen, render-ready snapshot — it
//! captures everything the PDF needs (header, employee snapshot,
//! earning / deduction tables, YTD totals, attendance summary, leave
//! balance, bank info, signature, watermark) so re-rendering an old
//! payslip never requires walking back through the live HRM tables.
//!
//! Earning / deduction / reimbursement line types are redeclared here
//! (rather than imported from `payroll_run`) on purpose: the payslip's
//! frozen snapshot may legitimately drift from the live run row shape
//! over time without breaking historical PDFs.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Audit, Identity};
use serde::{Deserialize, Serialize};

/// Earning line on a payslip. Same shape as the run-side row but
/// redeclared so the payslip stays self-contained.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EarningLine {
    pub code: String,
    pub label: String,
    pub amount: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeductionLine {
    pub code: String,
    pub label: String,
    pub amount: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReimbursementLine {
    pub category: String,
    pub amount: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub claim_id: Option<ObjectId>,
}

/// PDF header — company branding + period label.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PayslipHeader {
    pub company_name: String,
    /// SabFile id of the company logo to embed.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub company_logo_file_id: Option<ObjectId>,
    /// Display string for the period (e.g. "April 2026").
    pub period_label: String,
}

/// Frozen employee details at the moment the payslip was generated.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PayslipEmployee {
    pub employee_id: ObjectId,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub designation: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub department: Option<String>,
    /// Public-facing employee code (e.g. "EMP-0042").
    pub employment_id: String,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub joining_date: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pan: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub uan: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub esic: Option<String>,
}

/// Year-to-date rollup across the financial year of the period.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PayslipYtd {
    pub gross: f64,
    pub net: f64,
    pub tax_paid: f64,
}

/// Days breakdown that drives proration. Stored as `f32` since
/// half-day attendance is allowed.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PayslipAttendanceSummary {
    pub working_days: f32,
    pub present: f32,
    pub leaves: f32,
    pub holidays: f32,
    /// Loss-of-pay days.
    pub lop: f32,
}

/// Frozen bank-account snapshot. Account number is masked at write-time
/// so an exposed payslip JSON never leaks the full number.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PayslipBankInfo {
    pub bank_name: String,
    pub account_no_masked: String,
    pub ifsc: String,
    pub name_on_account: String,
}

/// Audit row for each download of the rendered PDF — useful for
/// compliance + sharing forensics.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadedEntry {
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub at: DateTime<Utc>,
    pub by: ObjectId,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ip: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Payslip {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /* ----- back-refs --------------------------------------------- */
    pub run_id: ObjectId,
    pub employee_id: ObjectId,

    /* ----- period ------------------------------------------------ */
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub period_from: DateTime<Utc>,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub period_to: DateTime<Utc>,

    /* ----- frozen snapshots -------------------------------------- */
    pub header: PayslipHeader,
    pub employee_snapshot: PayslipEmployee,

    /* ----- money tables ------------------------------------------ */
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub earnings: Vec<EarningLine>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub deductions: Vec<DeductionLine>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub reimbursements: Vec<ReimbursementLine>,

    /* ----- net pay (mirrored from run row) ----------------------- */
    pub net_pay: f64,
    /// Indian-format spelled-out amount, e.g.
    /// "Fifty Nine Thousand Seven Hundred Rupees Only".
    pub net_pay_in_words: String,

    /* ----- supporting context ------------------------------------ */
    #[serde(default)]
    pub ytd: PayslipYtd,
    #[serde(default)]
    pub attendance_summary: PayslipAttendanceSummary,
    /// Opaque map of leave-type-code -> remaining balance. Stored as
    /// JSON so leave-policy changes don't break older payslips.
    #[serde(default, skip_serializing_if = "serde_json::Value::is_null")]
    pub leave_balance_snapshot: serde_json::Value,
    pub bank_info_snapshot: PayslipBankInfo,

    /* ----- render assets ----------------------------------------- */
    /// SabFile id for the authorised-signatory image.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub signature_file_id: Option<ObjectId>,
    /// SabFile id for an optional watermark (e.g. "DUPLICATE").
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub watermark_file_id: Option<ObjectId>,

    /* ----- workflow + delivery ----------------------------------- */
    #[serde(default, skip_serializing_if = "is_false")]
    pub locked: bool,
    #[serde(default, skip_serializing_if = "is_false")]
    pub sent: bool,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub sent_at: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub downloaded_log: Vec<DownloadedEntry>,
}

fn is_false(b: &bool) -> bool {
    !*b
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trips_with_flattened_fragments() {
        let emp = ObjectId::new();
        let run = ObjectId::new();
        let p = Payslip {
            identity: Identity {
                id: ObjectId::new(),
                project_id: ObjectId::new(),
                user_id: ObjectId::new(),
                tenant_id: None,
            },
            audit: Audit::new(None),
            run_id: run,
            employee_id: emp,
            period_from: Utc::now(),
            period_to: Utc::now(),
            header: PayslipHeader {
                company_name: "SabNode Pvt Ltd".to_string(),
                company_logo_file_id: Some(ObjectId::new()),
                period_label: "April 2026".to_string(),
            },
            employee_snapshot: PayslipEmployee {
                employee_id: emp,
                name: "Asha Patel".to_string(),
                designation: Some("Senior Engineer".to_string()),
                department: Some("Engineering".to_string()),
                employment_id: "EMP-0042".to_string(),
                joining_date: Some(Utc::now()),
                pan: Some("ABCDE1234F".to_string()),
                uan: Some("100234567890".to_string()),
                esic: None,
            },
            earnings: vec![EarningLine {
                code: "BASIC".to_string(),
                label: "Basic".to_string(),
                amount: 40000.0,
            }],
            deductions: vec![DeductionLine {
                code: "PF".to_string(),
                label: "Provident Fund".to_string(),
                amount: 1800.0,
            }],
            reimbursements: vec![],
            net_pay: 38200.0,
            net_pay_in_words: "Thirty Eight Thousand Two Hundred Rupees Only".to_string(),
            ytd: PayslipYtd {
                gross: 40000.0,
                net: 38200.0,
                tax_paid: 0.0,
            },
            attendance_summary: PayslipAttendanceSummary {
                working_days: 22.0,
                present: 22.0,
                leaves: 0.0,
                holidays: 8.0,
                lop: 0.0,
            },
            leave_balance_snapshot: serde_json::json!({
                "casual": 6.0,
                "sick": 4.0,
                "earned": 12.5
            }),
            bank_info_snapshot: PayslipBankInfo {
                bank_name: "HDFC Bank".to_string(),
                account_no_masked: "XXXXXX1234".to_string(),
                ifsc: "HDFC0000123".to_string(),
                name_on_account: "Asha Patel".to_string(),
            },
            signature_file_id: Some(ObjectId::new()),
            watermark_file_id: None,
            locked: true,
            sent: true,
            sent_at: Some(Utc::now()),
            downloaded_log: vec![DownloadedEntry {
                at: Utc::now(),
                by: emp,
                ip: Some("203.0.113.7".to_string()),
            }],
        };

        let json = serde_json::to_value(&p).unwrap();

        // §0 fragments flatten to root.
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());

        // camelCase entity fields.
        assert!(json.get("runId").is_some());
        assert!(json.get("employeeId").is_some());
        assert!(json.get("periodFrom").is_some());
        assert!(json.get("netPay").is_some());
        assert!(json.get("netPayInWords").is_some());
        assert!(json.get("attendanceSummary").is_some());
        assert!(json.get("bankInfoSnapshot").is_some());
        assert!(json.get("downloadedLog").is_some());

        // Nested camelCase + opaque snapshot.
        assert_eq!(json["header"]["companyName"], "SabNode Pvt Ltd");
        assert_eq!(json["bankInfoSnapshot"]["accountNoMasked"], "XXXXXX1234");
        assert_eq!(json["leaveBalanceSnapshot"]["casual"], 6.0);

        // Round-trip back.
        let back: Payslip = serde_json::from_value(json).unwrap();
        assert_eq!(back.run_id, run);
        assert_eq!(back.employee_id, emp);
        assert!(back.locked);
        assert!(back.sent);
        assert_eq!(back.earnings.len(), 1);
        assert_eq!(back.bank_info_snapshot.ifsc, "HDFC0000123");
    }
}
