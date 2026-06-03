//! §12.26 Background Jobs.
//!
//! Mongo collection: `crm_background_jobs`. PM2 worker queues already
//! exist on the platform; this is the user-facing schedule + audit trail
//! exposed through the UI: job kind, schedule (one-shot / cron / event),
//! payload, retries, last/next run, log entries.
//!
//! The struct flattens the `crm-core` `Identity` + `Audit` fragments so
//! the document root carries §0 ownership and audit fields directly.

use chrono::{DateTime, Utc};
use crm_core::{Audit, Identity};

#[cfg(test)]
use bson::oid::ObjectId;
use serde::{Deserialize, Serialize};

/// When the worker should run the job. Tagged so the discriminant
/// (`kind`) and schedule fields are siblings on the JSON document.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum JobSchedule {
    /// Fire exactly once at `at`.
    Once { at: DateTime<Utc> },
    /// Recurring cron schedule. `timezone` is an IANA tz id (e.g.
    /// `"Asia/Kolkata"`); `None` = UTC.
    Cron {
        expr: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        timezone: Option<String>,
    },
    /// Triggered when a domain event fires (`"client.created"`,
    /// `"invoice.paid"`, …).
    OnEvent { event: String },
}

/// Lifecycle state of a job run.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum JobStatus {
    #[default]
    Queued,
    Running,
    Succeeded,
    Failed,
    Cancelled,
}

/// One line in the job log. `payload` is optional structured detail
/// (request ids, error chains, …) the worker can attach to a log line.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JobLogEntry {
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub at: DateTime<Utc>,
    /// `"info" | "warn" | "error" | "debug"`.
    pub level: String,
    pub message: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub payload: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackgroundJob {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /// Job kind (`"broadcast"`, `"payroll_run"`, `"reminder"`,
    /// `"report_export"`, …). Free-form so projects can add their own
    /// without a schema bump.
    pub kind: String,
    pub schedule: JobSchedule,
    /// Job-specific payload. Stored as raw JSON.
    #[serde(default)]
    pub payload: serde_json::Value,
    #[serde(default)]
    pub retry_count: u32,
    #[serde(default)]
    pub max_retries: u32,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub last_run_at: Option<DateTime<Utc>>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub next_run_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub status: JobStatus,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub logs: Vec<JobLogEntry>,
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
    fn background_job_round_trips_with_flattened_fragments() {
        let job = BackgroundJob {
            identity: identity(),
            audit: audit(),
            kind: "broadcast".to_string(),
            schedule: JobSchedule::Cron {
                expr: "0 9 * * *".to_string(),
                timezone: Some("Asia/Kolkata".to_string()),
            },
            payload: serde_json::json!({ "campaignId": "abc" }),
            retry_count: 0,
            max_retries: 3,
            last_run_at: None,
            next_run_at: Some(Utc::now()),
            status: JobStatus::Queued,
            logs: vec![JobLogEntry {
                at: Utc::now(),
                level: "info".to_string(),
                message: "scheduled".to_string(),
                payload: None,
            }],
        };

        let json = serde_json::to_value(&job).unwrap();
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());
        assert_eq!(json.get("status").unwrap(), "queued");
        assert!(json.get("nextRunAt").is_some());

        let sched = json.get("schedule").unwrap();
        assert_eq!(sched.get("kind").unwrap(), "cron");
        assert_eq!(sched.get("expr").unwrap(), "0 9 * * *");

        let back: BackgroundJob = serde_json::from_value(json).unwrap();
        assert_eq!(back.kind, "broadcast");
        assert!(matches!(back.status, JobStatus::Queued));
        match back.schedule {
            JobSchedule::Cron { expr, timezone } => {
                assert_eq!(expr, "0 9 * * *");
                assert_eq!(timezone.as_deref(), Some("Asia/Kolkata"));
            }
            _ => panic!("schedule did not round-trip as Cron"),
        }
    }
}
