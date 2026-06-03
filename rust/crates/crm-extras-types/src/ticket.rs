//! §12.8 Tickets / Help Desk / SLA.
//!
//! Mongo collections: `crm_tickets` and `crm_slas`. Both DTOs flatten the
//! `crm-core` cross-cutting fragments (`Identity`, `Audit`, plus
//! `Assignment` for `Ticket`) so the document root carries §0 ownership /
//! audit / assignment fields directly.
//!
//! `Ticket` covers help-desk records: subject, requester, channel,
//! product / category / priority / severity, due-by (computed off the
//! linked `Sla`), assignee, status, satisfaction rating, internal notes,
//! attachments, deal / invoice cross-links, parent-child + merge log.
//!
//! `Sla` carries the policy that sets `dueBy` on tickets it matches:
//! conditions (opaque match rules), first-response and resolution targets
//! in minutes, business-hour windows, and an escalation matrix.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Assignment, Attachment, Audit, Identity, Note, Priority};
use serde::{Deserialize, Serialize};

/// How the ticket entered the system. Mirrors the channel pickers
/// surfaced in the help-desk UI.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TicketChannel {
    #[default]
    Email,
    Web,
    Whatsapp,
    Chat,
    Phone,
    Portal,
}

/// Ticket workflow state. `OnHold` and `Reopened` use snake_case so the
/// JSON shape matches the existing TS vocabulary (`on_hold`, `reopened`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TicketStatus {
    #[default]
    Open,
    Pending,
    OnHold,
    Resolved,
    Closed,
    Reopened,
}

/// Severity bucket — independent of `Priority`. Severity is the customer-
/// facing impact (how broken the system is); priority is the work-queue
/// ordering. Tickets carry both.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TicketSeverity {
    Sev1,
    Sev2,
    #[default]
    Sev3,
    Sev4,
}

/// Audit record for a merge: when `merged_from` was folded into this
/// ticket, who did it. The originating ticket is closed and points at
/// the survivor via its own `parent_ticket_id`; this log captures the
/// reverse for forensics.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MergeLogEntry {
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub at: DateTime<Utc>,
    pub merged_from: ObjectId,
    pub by: ObjectId,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Ticket {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,
    #[serde(flatten)]
    pub assignment: Assignment,

    /* ----- request body ------------------------------------------ */
    pub subject: String,
    pub requester_id: ObjectId,
    #[serde(default)]
    pub channel: TicketChannel,

    /* ----- classification ---------------------------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub product_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub priority: Option<Priority>,
    #[serde(default)]
    pub severity: TicketSeverity,

    /* ----- SLA + scheduling -------------------------------------- */
    /// Computed off the linked `Sla` at write-time. Nullable until the
    /// SLA evaluator fires.
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub due_by: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sla_id: Option<ObjectId>,

    /* ----- ownership + workflow ---------------------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub assignee_id: Option<ObjectId>,
    #[serde(default)]
    pub status: TicketStatus,

    /* ----- closeout ---------------------------------------------- */
    /// 1-5 CSAT rating once the requester responds to the satisfaction
    /// survey. Nullable until the survey fires (or is skipped).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub satisfaction_rating: Option<u8>,

    /* ----- body ---------------------------------------------------*/
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub internal_notes: Vec<Note>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub attachments: Vec<Attachment>,

    /* ----- cross-links -------------------------------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub linked_deal_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub linked_invoice_id: Option<ObjectId>,

    /* ----- hierarchy + merges ------------------------------------ */
    /// If this ticket was split from a master, `parent_ticket_id` points
    /// at the master. If this ticket *is* a master, the merged duplicates
    /// will additionally appear in `merge_log`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent_ticket_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub child_ticket_ids: Vec<ObjectId>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub merge_log: Vec<MergeLogEntry>,
}

/* =============================================================== */
/* SLA                                                              */
/* =============================================================== */

/// One business-hours window. `day` is a `u8` 0..=6 (Sunday=0, matching
/// JS `Date.getDay()`). `start_minute` / `end_minute` are minutes since
/// local midnight (`0..=1440`). The SLA carries multiple windows so
/// "Mon-Fri 9:00-18:00 + Sat 9:00-13:00" is a single Sla doc with three
/// `BusinessHourWindow` rows.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BusinessHourWindow {
    pub day: u8,
    pub start_minute: u16,
    pub end_minute: u16,
}

/// One row of the escalation matrix. Triggered when a ticket has been
/// open `after_minutes` past the relevant SLA boundary without progress.
/// Either a specific user or a role takes over (`escalate_to_user_id`
/// xor `escalate_to_role`); `action` is the verb the runner executes
/// (`"notify"` / `"reassign"` / `"page"`).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EscalationStep {
    pub after_minutes: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub escalate_to_user_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub escalate_to_role: Option<String>,
    pub action: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Sla {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /* ----- definition -------------------------------------------- */
    pub name: String,

    /// Opaque match rules (priority/severity/product/channel filters,
    /// account tier, etc.). Stored as JSON so the SLA evaluator can
    /// evolve its DSL without churning this DTO.
    pub conditions: serde_json::Value,

    /* ----- targets ----------------------------------------------- */
    pub first_response_target_minutes: u32,
    pub resolution_target_minutes: u32,

    /* ----- working hours + escalation ---------------------------- */
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub business_hours: Vec<BusinessHourWindow>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub escalation_matrix: Vec<EscalationStep>,

    /* ----- toggle ------------------------------------------------ */
    #[serde(default)]
    pub active: bool,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crm_core::Audit as CoreAudit;

    fn ident() -> Identity {
        Identity {
            id: ObjectId::new(),
            project_id: ObjectId::new(),
            user_id: ObjectId::new(),
            tenant_id: None,
        }
    }

    #[test]
    fn ticket_round_trips_with_flattened_fragments() {
        let t = Ticket {
            identity: ident(),
            audit: CoreAudit::new(None),
            assignment: Assignment::default(),
            subject: "Login broken".to_string(),
            requester_id: ObjectId::new(),
            channel: TicketChannel::Whatsapp,
            product_id: None,
            category: Some("auth".to_string()),
            priority: Some(Priority::High),
            severity: TicketSeverity::Sev2,
            due_by: Some(Utc::now()),
            sla_id: None,
            assignee_id: None,
            status: TicketStatus::OnHold,
            satisfaction_rating: Some(4),
            internal_notes: vec![],
            attachments: vec![],
            linked_deal_id: None,
            linked_invoice_id: None,
            parent_ticket_id: None,
            child_ticket_ids: vec![],
            merge_log: vec![],
        };

        let json = serde_json::to_value(&t).unwrap();

        // Flattened fragments live at the document root.
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        assert!(json.get("createdAt").is_some());
        // No nested fragment keys.
        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());
        assert!(json.get("assignment").is_none());

        // camelCase + lowercase enums.
        assert_eq!(
            json.get("channel").and_then(|v| v.as_str()),
            Some("whatsapp")
        );
        assert_eq!(json.get("severity").and_then(|v| v.as_str()), Some("sev2"));
        // snake_case multi-word status.
        assert_eq!(json.get("status").and_then(|v| v.as_str()), Some("on_hold"));
        assert_eq!(
            json.get("subject").and_then(|v| v.as_str()),
            Some("Login broken")
        );

        let back: Ticket = serde_json::from_value(json).unwrap();
        assert_eq!(back.subject, "Login broken");
        assert!(matches!(back.severity, TicketSeverity::Sev2));
        assert!(matches!(back.status, TicketStatus::OnHold));
    }

    #[test]
    fn sla_round_trips_with_flattened_fragments() {
        let s = Sla {
            identity: ident(),
            audit: CoreAudit::new(None),
            name: "Gold tier".to_string(),
            conditions: serde_json::json!({ "priority": "high" }),
            first_response_target_minutes: 30,
            resolution_target_minutes: 240,
            business_hours: vec![BusinessHourWindow {
                day: 1,
                start_minute: 540,
                end_minute: 1080,
            }],
            escalation_matrix: vec![EscalationStep {
                after_minutes: 60,
                escalate_to_user_id: Some(ObjectId::new()),
                escalate_to_role: None,
                action: "notify".to_string(),
            }],
            active: true,
        };

        let json = serde_json::to_value(&s).unwrap();
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());

        assert_eq!(
            json.get("firstResponseTargetMinutes")
                .and_then(|v| v.as_u64()),
            Some(30)
        );
        assert_eq!(json.get("active").and_then(|v| v.as_bool()), Some(true));
        let bh = json
            .get("businessHours")
            .and_then(|v| v.as_array())
            .unwrap();
        assert_eq!(bh[0].get("startMinute").and_then(|v| v.as_u64()), Some(540));

        let back: Sla = serde_json::from_value(json).unwrap();
        assert_eq!(back.name, "Gold tier");
        assert_eq!(back.escalation_matrix.len(), 1);
        assert_eq!(back.escalation_matrix[0].action, "notify");
    }
}
