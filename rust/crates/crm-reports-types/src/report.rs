//! §7 Unified Reports system (CRM + HRM cross-cutting).
//!
//! One report engine drives every saved/scheduled report across the
//! CRM, finance, sales, projects, tickets, and HRM modules. The shape
//! is intentionally generic:
//!
//! * `ReportKind`     — the catalogue of supported reports.
//! * `ReportFilters`  — common envelope (from/to/group-by + per-kind
//!                      `custom` JSON bag) so we don't bloat the type
//!                      with every report's bespoke filter set.
//! * `ReportSchedule` — one-time vs cron with timezone + next_run.
//! * `ReportRecipient`— tagged enum: User(ObjectId) | Email | Webhook.
//! * `ReportDefinition` — saved/named report config (Identity + Audit
//!                        flattened so it lives as a tenant-owned doc).
//! * `ReportRequest`  — fire-and-forget one-shot generation envelope.
//! * `ReportResult`   — generation outcome (file id in SabFiles +
//!                      summary + row count or error).

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Audit, Identity};
use serde::{Deserialize, Serialize};

/// Catalogue of every report the unified engine knows how to render.
/// Snake-case on the wire so multi-word kinds round-trip cleanly with
/// the TS API surface.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ReportKind {
    /* ----- GST / India statutory --------------------------------- */
    Gstr1,
    Gstr2b,
    Gstr3b,
    /* ----- AR / AP / cash ---------------------------------------- */
    InvoiceAging,
    PaymentReport,
    ExpenseReport,
    IncomeReport,
    ProfitAndLoss,
    TaxReport,
    /* ----- sales analytics --------------------------------------- */
    TopClients,
    TopProducts,
    SalesDeals,
    LeadsConversion,
    /* ----- people / HRM ------------------------------------------ */
    BirthdayAnniversary,
    AgentPerformance,
    /* ----- projects / tasks / tickets ---------------------------- */
    ProjectStatus,
    LateReport,
    OverdueTasks,
    TaskReport,
    TicketReport,
    /* ----- attendance / leave ------------------------------------ */
    AttendanceReport,
    LeaveReport,
    LeaveBalanceReport,
    /* ----- accounting books / payroll registers ------------------ */
    BalanceSheet,
    TrialBalance,
    DayBook,
    CashFlow,
    PfRegister,
    EsiRegister,
    PtRegister,
    TdsRegister,
    Form24Q,
    Form12Ba,
    Form16,
    BankDisbursement,
}

/// Output formats the renderer can produce. Lowercase on the wire so a
/// front-end can drop the value straight into a Content-Type / file
/// extension switch.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ReportFormat {
    #[default]
    Pdf,
    Xlsx,
    Csv,
    Json,
}

/// Common filter envelope. Kind-specific filters land in `custom` as
/// an opaque JSON bag (e.g. `{ "fyYear": "2024-25" }` for GST kinds,
/// `{ "stage": "won" }` for SalesDeals) so we don't have to model
/// every report's bespoke filters in Rust.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportFilters {
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub from: Option<DateTime<Utc>>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub to: Option<DateTime<Utc>>,
    /// e.g. "day" | "week" | "month" | "agent" | "client" | "branch".
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub group_by: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub branch_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub project_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub owner_id: Option<ObjectId>,
    /// Opaque per-kind filter bag. Empty `{}` by default.
    #[serde(default)]
    pub custom: serde_json::Value,
}

/// Cadence for a saved schedule. `OneTime` means render on-demand
/// (still a saved/named definition, but no cron), `Cron` runs the
/// `cron` expression in `timezone`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ReportCadence {
    #[default]
    OneTime,
    Cron,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportSchedule {
    #[serde(default)]
    pub cadence: ReportCadence,
    /// Standard 5-field cron (or 6-field with seconds; engine decides).
    /// Only meaningful when `cadence == Cron`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cron: Option<String>,
    /// IANA tz name (e.g. "Asia/Kolkata"). Defaults to project tz when
    /// unset.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub timezone: Option<String>,
    /// Next computed run. Maintained by the scheduler, not the user.
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub next_run: Option<DateTime<Utc>>,
    pub active: bool,
}

/// Where the rendered file/summary is delivered. Externally tagged on
/// `kind` so the wire shape is `{ "kind": "user", "value": "<oid>" }`
/// / `{ "kind": "email", "value": "ops@x.com" }` /
/// `{ "kind": "webhook", "value": "https://..." }`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", content = "value", rename_all = "snake_case")]
pub enum ReportRecipient {
    /// In-app user — delivered to inbox + email-on-file.
    User(ObjectId),
    /// Bare email address (external recipient).
    Email(String),
    /// HTTPS webhook URL — the engine POSTs the result envelope.
    Webhook(String),
}

/// Saved, tenant-owned report config. Flattens `Identity` + `Audit`
/// so the document root carries §0 ownership / audit fields directly.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportDefinition {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /* ----- definition body --------------------------------------- */
    pub kind: ReportKind,
    pub name: String,
    #[serde(default)]
    pub filters: ReportFilters,
    #[serde(default)]
    pub format: ReportFormat,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub schedule: Option<ReportSchedule>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub recipients: Vec<ReportRecipient>,
    /// Last successful render timestamp. `None` until the first run.
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub last_run_at: Option<DateTime<Utc>>,
}

/// One-shot generation request. No Identity/Audit — the caller's auth
/// context is supplied at the API layer; this is just the envelope of
/// "what to render, in what shape".
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportRequest {
    pub kind: ReportKind,
    #[serde(default)]
    pub filters: ReportFilters,
    #[serde(default)]
    pub format: ReportFormat,
}

/// Outcome of a render. `file_id` points at the SabFiles document
/// holding the rendered artifact (PDF/XLSX/CSV/JSON). `summary` is a
/// kind-specific JSON blob for inline preview without re-downloading
/// the file. `error` is set instead of `file_id` when the engine
/// failed.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportResult {
    pub kind: ReportKind,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub generated_at: DateTime<Utc>,
    /// SabFiles id — the rendered artifact lives in the user's library
    /// per project policy; we never expose a free-text URL.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub file_id: Option<ObjectId>,
    #[serde(default)]
    pub summary: serde_json::Value,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub row_count: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    fn mk_identity() -> Identity {
        Identity {
            id: ObjectId::new(),
            project_id: ObjectId::new(),
            user_id: ObjectId::new(),
            tenant_id: None,
        }
    }

    fn mk_audit() -> Audit {
        let now = Utc::now();
        Audit {
            created_at: now,
            updated_at: now,
            created_by: None,
            updated_by: None,
        }
    }

    #[test]
    fn report_definition_round_trips_with_flattened_fragments() {
        let def = ReportDefinition {
            identity: mk_identity(),
            audit: mk_audit(),
            kind: ReportKind::ProfitAndLoss,
            name: "FY24-25 P&L (monthly)".to_string(),
            filters: ReportFilters {
                from: Some(Utc::now()),
                to: Some(Utc::now()),
                group_by: Some("month".to_string()),
                branch_id: Some(ObjectId::new()),
                project_id: None,
                owner_id: None,
                custom: serde_json::json!({ "fyYear": "2024-25" }),
            },
            format: ReportFormat::Xlsx,
            schedule: Some(ReportSchedule {
                cadence: ReportCadence::Cron,
                cron: Some("0 6 1 * *".to_string()),
                timezone: Some("Asia/Kolkata".to_string()),
                next_run: Some(Utc::now()),
                active: true,
            }),
            recipients: vec![
                ReportRecipient::Email("ops@example.com".to_string()),
                ReportRecipient::User(ObjectId::new()),
            ],
            last_run_at: None,
        };

        let json = serde_json::to_value(&def).expect("serialize");

        // §0 fragments flattened to root
        assert!(json.get("_id").is_some(), "_id at root");
        assert!(json.get("projectId").is_some(), "projectId at root");
        assert!(json.get("userId").is_some(), "userId at root");
        assert!(json.get("createdAt").is_some(), "createdAt at root");
        assert!(json.get("updatedAt").is_some(), "updatedAt at root");
        // No nested fragment keys
        assert!(json.get("identity").is_none(), "identity not nested");
        assert!(json.get("audit").is_none(), "audit not nested");

        // camelCase / enum casing
        assert_eq!(
            json.get("kind").and_then(|v| v.as_str()),
            Some("profit_and_loss")
        );
        assert_eq!(json.get("format").and_then(|v| v.as_str()), Some("xlsx"));
        let sched = json.get("schedule").expect("schedule");
        assert_eq!(sched.get("cadence").and_then(|v| v.as_str()), Some("cron"));
        assert!(sched.get("nextRun").is_some(), "schedule.nextRun camelCase");

        // Round-trip
        let back: ReportDefinition = serde_json::from_value(json).expect("deserialize");
        assert_eq!(back.kind, ReportKind::ProfitAndLoss);
        assert!(matches!(back.format, ReportFormat::Xlsx));
        assert_eq!(back.recipients.len(), 2);
    }

    #[test]
    fn report_recipient_tagged_enum_round_trips() {
        let oid = ObjectId::new();
        let recipients = vec![
            ReportRecipient::User(oid),
            ReportRecipient::Email("a@b.com".to_string()),
            ReportRecipient::Webhook("https://hooks.example.com/x".to_string()),
        ];

        let json = serde_json::to_value(&recipients).expect("serialize");
        let arr = json.as_array().expect("array");
        assert_eq!(arr.len(), 3);

        // tag = "kind", content = "value", snake_case
        assert_eq!(arr[0].get("kind").and_then(|v| v.as_str()), Some("user"));
        assert!(arr[0].get("value").is_some(), "user has value");
        assert_eq!(arr[1].get("kind").and_then(|v| v.as_str()), Some("email"));
        assert_eq!(
            arr[1].get("value").and_then(|v| v.as_str()),
            Some("a@b.com")
        );
        assert_eq!(arr[2].get("kind").and_then(|v| v.as_str()), Some("webhook"));
        assert_eq!(
            arr[2].get("value").and_then(|v| v.as_str()),
            Some("https://hooks.example.com/x")
        );

        // Round-trip
        let back: Vec<ReportRecipient> = serde_json::from_value(json).expect("deserialize");
        assert_eq!(back.len(), 3);
        match &back[0] {
            ReportRecipient::User(id) => assert_eq!(*id, oid),
            _ => panic!("expected User variant"),
        }
        match &back[2] {
            ReportRecipient::Webhook(url) => {
                assert_eq!(url, "https://hooks.example.com/x")
            }
            _ => panic!("expected Webhook variant"),
        }
    }
}
