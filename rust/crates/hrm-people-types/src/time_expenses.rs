//! §10 Time & Expenses — Timesheets, Travel Requests, and Expense
//! Claims. Each top-level entity flattens `crm-core`
//! `Identity` + `Audit`.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Audit, Identity};
use serde::{Deserialize, Serialize};

/* =============================================================== */
/* Timesheets                                                      */
/* =============================================================== */

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimesheetDay {
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub date: DateTime<Utc>,
    pub hours: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimesheetEntry {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub project_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub task_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub days: Vec<TimesheetDay>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TimesheetStatus {
    #[default]
    Draft,
    Submitted,
    Approved,
    Rejected,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Timesheet {
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    pub employee_id: ObjectId,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub week_start: DateTime<Utc>,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub week_end: DateTime<Utc>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub entries: Vec<TimesheetEntry>,
    pub total_hours: f32,
    #[serde(default)]
    pub status: TimesheetStatus,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub approver_id: Option<ObjectId>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub decided_at: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub comment: Option<String>,
}

/* =============================================================== */
/* Travel Requests                                                 */
/* =============================================================== */

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TravelMode {
    #[default]
    Air,
    Train,
    Road,
    Sea,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TravelStatus {
    #[default]
    Draft,
    Submitted,
    Approved,
    Rejected,
    Booked,
    Completed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TravelRequest {
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    pub employee_id: ObjectId,
    pub purpose: String,
    #[serde(default)]
    pub mode: TravelMode,
    pub from_location: String,
    pub to_location: String,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub depart_on: DateTime<Utc>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub return_on: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub advance_amount: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,
    #[serde(default)]
    pub status: TravelStatus,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub approver_id: Option<ObjectId>,
}

/* =============================================================== */
/* Expense Claims                                                  */
/* =============================================================== */

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExpenseClaimLine {
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub date: DateTime<Utc>,
    pub category: String,
    pub amount: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub receipt_file_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub project_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ExpenseClaimStatus {
    #[default]
    Draft,
    Submitted,
    Approved,
    Rejected,
    Reimbursed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExpenseClaim {
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    pub employee_id: ObjectId,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub lines: Vec<ExpenseClaimLine>,
    pub total: f64,
    pub currency: String,
    #[serde(default)]
    pub status: ExpenseClaimStatus,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub approver_id: Option<ObjectId>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub reimbursed_at: Option<DateTime<Utc>>,
    /// Bank / payroll txn id once the claim is paid out.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reimbursement_txn_id: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ident() -> Identity {
        Identity {
            id: ObjectId::new(),
            project_id: ObjectId::new(),
            user_id: ObjectId::new(),
            tenant_id: None,
        }
    }

    fn audit() -> Audit {
        Audit {
            created_at: Utc::now(),
            updated_at: Utc::now(),
            created_by: None,
            updated_by: None,
        }
    }

    #[test]
    fn expense_claim_round_trips_with_flattened_fragments() {
        let claim = ExpenseClaim {
            identity: ident(),
            audit: audit(),
            employee_id: ObjectId::new(),
            lines: vec![ExpenseClaimLine {
                date: Utc::now(),
                category: "meals".into(),
                amount: 1500.0,
                receipt_file_id: Some(ObjectId::new()),
                project_id: None,
                note: Some("Client lunch".into()),
            }],
            total: 1500.0,
            currency: "INR".into(),
            status: ExpenseClaimStatus::Submitted,
            approver_id: Some(ObjectId::new()),
            reimbursed_at: None,
            reimbursement_txn_id: None,
        };

        let json = serde_json::to_value(&claim).unwrap();
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("employeeId").is_some());
        assert_eq!(
            json.get("status").and_then(|v| v.as_str()),
            Some("submitted")
        );
        let back: ExpenseClaim = serde_json::from_value(json).unwrap();
        assert_eq!(back.currency, "INR");
        assert_eq!(back.status, ExpenseClaimStatus::Submitted);
    }
}
