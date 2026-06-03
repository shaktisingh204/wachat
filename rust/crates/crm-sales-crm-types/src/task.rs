//! §5.4 Tasks.
//!
//! Mongo collection: `crm_tasks`. A task is a unit of work assigned to a
//! user — a call to make, an email to send, a meeting to attend, a
//! generic todo, or a follow-up. It can be linked to any other CRM
//! entity (lead / deal / client / ticket / invoice) through a tagged
//! `LinkedEntity` discriminator so the timeline UI can roll tasks up
//! under their parent without a per-link join.
//!
//! The struct flattens `Identity`, `Audit` and `Assignment` so
//! ownership / audit / assignedTo / teamId fields land at the document
//! root (parity with the §0 conventions).

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Assignment, Attachment, Audit, Identity, Priority, Status};
use crm_sales_types::RecurringConfig;
use serde::{Deserialize, Serialize};

/// Kind-of-work discriminator. Drives icon / quick-action affordances in
/// the task list UI; per the §5.4 spec the vocabulary is closed.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TaskType {
    Call,
    Email,
    Meeting,
    #[default]
    Todo,
    FollowUp,
}

/// Channel a reminder fires through. Free-form string today (the engine
/// validates against a known list — `"email" | "push" | "whatsapp"`) so
/// new channels can land without a DTO churn.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Reminder {
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub at: DateTime<Utc>,
    /// `"email"` | `"push"` | `"whatsapp"` | …
    pub channel: String,
}

/// Parent CRM entity this task is attached to. Tagged so JSON readers
/// can branch on `kind` without inspecting which optional id field is
/// populated — and so the engine can build a single index over
/// `linkedEntity.id` regardless of the kind.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", content = "id", rename_all = "lowercase")]
pub enum LinkedEntity {
    Lead(ObjectId),
    Deal(ObjectId),
    Client(ObjectId),
    Ticket(ObjectId),
    Invoice(ObjectId),
}

/// Single checklist row. `id` is stable across edits so the front-end
/// can update a single row without re-sending the whole list.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChecklistItem {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    pub text: String,
    #[serde(default)]
    pub done: bool,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub completed_at: Option<DateTime<Utc>>,
}

/// Free-form outcome capture written when a task is closed. `kind` is a
/// short verb the UI maps to a chip ("completed" / "skipped" /
/// "rescheduled" / "no_show" / …); `note` is the optional free-text
/// follow-up captured in the close dialog.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Outcome {
    pub kind: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
}

/// CRM Task. Stored in `crm_tasks`.
///
/// `assignee_id` and `due_date` are required (everything else flows
/// around them). `status` is a free-form `Status` newtype because task
/// states vary by tenant — the default workflow is
/// `pending → in_progress → done` but tenants can layer
/// `waiting_on_customer` / `blocked` / etc.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,
    #[serde(flatten)]
    pub assignment: Assignment,

    /* ----- core fields ------------------------------------------- */
    pub title: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default)]
    pub task_type: TaskType,

    /* ----- workflow --------------------------------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<Status>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub priority: Option<Priority>,

    /* ----- ownership + scheduling -------------------------------- */
    /// Required executor. Distinct from the optional
    /// `assignment.assigned_to` (which mirrors the universal §0
    /// convention) — task semantics demand a single concrete owner, so
    /// this field is non-optional.
    pub assignee_id: ObjectId,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub due_date: DateTime<Utc>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub reminders: Vec<Reminder>,

    /* ----- relationship + body ----------------------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub linked_entity: Option<LinkedEntity>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub checklist: Vec<ChecklistItem>,

    /* ----- recurring config + outcome ---------------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub recurring: Option<RecurringConfig>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub outcome: Option<Outcome>,

    /* ----- attachments ------------------------------------------ */
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub attachments: Vec<Attachment>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    fn sample_task() -> Task {
        Task {
            identity: Identity {
                id: ObjectId::new(),
                project_id: ObjectId::new(),
                user_id: ObjectId::new(),
                tenant_id: None,
            },
            audit: Audit::new(None),
            assignment: Assignment::default(),
            title: "Call Acme about renewal".into(),
            description: Some("Confirm seat count and check pricing tier.".into()),
            task_type: TaskType::Call,
            status: Some(Status::new("pending")),
            priority: Some(Priority::High),
            assignee_id: ObjectId::new(),
            due_date: Utc::now(),
            reminders: vec![Reminder {
                at: Utc::now(),
                channel: "email".into(),
            }],
            linked_entity: Some(LinkedEntity::Deal(ObjectId::new())),
            checklist: vec![ChecklistItem {
                id: ObjectId::new(),
                text: "Pull last invoice".into(),
                done: true,
                completed_at: Some(Utc::now()),
            }],
            recurring: None,
            outcome: None,
            attachments: vec![],
        }
    }

    #[test]
    fn round_trips_with_flattened_fragments() {
        let t = sample_task();
        let json = serde_json::to_value(&t).unwrap();

        // Cross-cutting fragments flatten to root.
        assert!(json.get("identity").is_none(), "Identity must flatten");
        assert!(json.get("audit").is_none(), "Audit must flatten");
        assert!(json.get("assignment").is_none(), "Assignment must flatten");
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("updatedAt").is_some());

        // Required task fields at root in camelCase.
        assert!(json.get("title").is_some());
        assert!(json.get("assigneeId").is_some());
        assert!(json.get("dueDate").is_some());

        // TaskType serializes snake_case (single-word "call" still lowercase).
        assert_eq!(json.get("taskType").and_then(|v| v.as_str()), Some("call"));

        // Priority serializes lowercase (from crm_core).
        assert_eq!(json.get("priority").and_then(|v| v.as_str()), Some("high"));

        // Status is a transparent string newtype.
        assert_eq!(json.get("status").and_then(|v| v.as_str()), Some("pending"));

        // Tagged LinkedEntity: kind + id, lowercase variant.
        let le = json.get("linkedEntity").unwrap();
        assert_eq!(le.get("kind").and_then(|v| v.as_str()), Some("deal"));
        assert!(le.get("id").is_some());

        // Round-trip back.
        let s = serde_json::to_string(&t).unwrap();
        let back: Task = serde_json::from_str(&s).unwrap();
        assert_eq!(back.title, t.title);
        assert_eq!(back.task_type, t.task_type);
        assert_eq!(back.assignee_id, t.assignee_id);
        assert_eq!(back.checklist.len(), t.checklist.len());
        assert_eq!(back.reminders[0].channel, t.reminders[0].channel);
    }

    #[test]
    fn task_type_follow_up_serializes_snake_case() {
        let s = serde_json::to_string(&TaskType::FollowUp).unwrap();
        assert_eq!(s, "\"follow_up\"");
    }
}
