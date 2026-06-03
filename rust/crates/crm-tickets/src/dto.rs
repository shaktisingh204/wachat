//! Wire-format request DTOs for the §12.8 ticket endpoints.
//!
//! The **response** type for every read/write endpoint is the canonical
//! [`crm_extras_types::Ticket`] — we deliberately do not redeclare it
//! here. The shapes below describe only what callers send IN
//! (create-input, update-input, list-query); they are intentionally
//! narrower than the full Ticket model so the API surface stays
//! controlled.
//!
//! All structs use `#[serde(rename_all = "camelCase")]` so JSON
//! requests round-trip with the TS clients.

use serde::{Deserialize, Serialize};

/// Default page size if the caller doesn't send `limit`.
pub const DEFAULT_LIMIT: i64 = 20;

/// Hard ceiling on a single page. Mirrors the §0 convention used across
/// the Rust BFF (clamped to keep large-result-set DoS attempts bounded).
pub const MAX_LIMIT: i64 = 100;

/// `GET /v1/crm/tickets` query string.
///
/// `q` is a free-text substring searched (case-insensitive) across
/// `subject` and `category`. The structured filters
/// (`status` / `severity` / `assigneeId` / `requesterId`) are exact
/// match — typed enums for status/severity, hex-string OIDs for the
/// principals.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    /// 1-indexed page (matches TS). Defaults to `1`.
    #[serde(default)]
    pub page: Option<u32>,
    /// Page size. Defaults to [`DEFAULT_LIMIT`], clamped to
    /// [`MAX_LIMIT`].
    #[serde(default)]
    pub limit: Option<u32>,
    /// Free-text search (case-insensitive substring across `subject`
    /// and `category`).
    #[serde(default)]
    pub q: Option<String>,
    /// Restrict to a single workflow status (`open`, `pending`,
    /// `on_hold`, `resolved`, `closed`, `reopened`).
    #[serde(default)]
    pub status: Option<String>,
    /// Restrict to a single severity bucket (`sev1` .. `sev4`).
    #[serde(default)]
    pub severity: Option<String>,
    /// Restrict to tickets assigned to a specific user (24-char hex).
    #[serde(default)]
    pub assignee_id: Option<String>,
    /// Restrict to tickets opened by a specific requester (24-char
    /// hex).
    #[serde(default)]
    pub requester_id: Option<String>,
}

/// `POST /v1/crm/tickets` body. The endpoint accepts a curated subset
/// of the full [`crm_extras_types::Ticket`] fields — enough to drive
/// the existing "Create Ticket" UI without exposing the heavier
/// merge-log / child-ticket / satisfaction-survey surface (those are
/// populated by domain workflows rather than direct user entry).
///
/// **Required:** `subject`, `requesterId`, `channel`, `severity`.
///
/// **Optional:** `productId`, `category`, `priority`, `dueBy`,
/// `assigneeId`, `status`, `linkedDealId`, `linkedInvoiceId`,
/// `parentTicketId`, `internalNotes`, `attachments`.
///
/// **Deferred:** SLA-driven `dueBy` computation — caller can supply
/// `dueBy` directly today; once the §12.8 SLA evaluator lands, the
/// handler will populate `dueBy` server-side and reject explicit
/// overrides.
///
/// **Not exposed:** `slaId` (computed by the SLA matcher),
/// `satisfactionRating` (set by the closeout survey),
/// `childTicketIds` / `mergeLog` (managed by the split / merge
/// endpoints).
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTicketInput {
    /* ----- identity ----- */
    /// Optional override of the project scope. When absent the create
    /// handler stamps a freshly minted `ObjectId` so the document is at
    /// least syntactically valid; production callers SHOULD send the
    /// real projectId so cross-project queries stay accurate.
    #[serde(default)]
    pub project_id: Option<String>,

    /* ----- request body (★ required) ----- */
    pub subject: String,
    /// 24-char hex of the requester (typically a CRM client/contact).
    pub requester_id: String,
    /// How the ticket entered the system — `email` / `web` / `whatsapp`
    /// / `chat` / `phone` / `portal`. Required: every ticket has a
    /// channel of origin.
    pub channel: String,
    /// Customer-facing impact bucket — `sev1` (highest) … `sev4`
    /// (lowest). Required so triage queues stay sortable.
    pub severity: String,

    /* ----- classification (optional) ----- */
    /// Product / service the ticket is about.
    #[serde(default)]
    pub product_id: Option<String>,
    #[serde(default)]
    pub category: Option<String>,
    /// Work-queue priority — `low` / `medium` / `high` / `critical`.
    /// Independent of `severity` (severity = how broken the system is;
    /// priority = how urgently we work it).
    #[serde(default)]
    pub priority: Option<String>,

    /* ----- SLA + scheduling (optional) ----- */
    /// ISO-8601 datetime. Today the caller may supply this directly;
    /// once the SLA matcher ships it will be computed server-side.
    #[serde(default)]
    pub due_by: Option<chrono::DateTime<chrono::Utc>>,

    /* ----- ownership + workflow (optional) ----- */
    /// 24-char hex of the assignee (a CRM agent).
    #[serde(default)]
    pub assignee_id: Option<String>,
    /// Workflow state — `open` / `pending` / `on_hold` / `resolved` /
    /// `closed` / `reopened`. Defaults to `open` when absent.
    #[serde(default)]
    pub status: Option<String>,

    /* ----- cross-links (optional) ----- */
    #[serde(default)]
    pub linked_deal_id: Option<String>,
    #[serde(default)]
    pub linked_invoice_id: Option<String>,

    /* ----- hierarchy (optional) ----- */
    /// 24-char hex of a parent / master ticket if this one was split
    /// off it.
    #[serde(default)]
    pub parent_ticket_id: Option<String>,

    /* ----- body (optional) ----- */
    /// Internal-only notes (not surfaced to the requester). Stored as
    /// opaque JSON — the canonical [`crm_core::Note`] shape is used at
    /// the type layer; we accept whatever the TS client sends.
    #[serde(default)]
    pub internal_notes: Option<serde_json::Value>,
    /// Attachment manifests (SabFiles refs / R2 URLs / size / mime).
    /// Stored as opaque JSON.
    #[serde(default)]
    pub attachments: Option<serde_json::Value>,
}

/// `PATCH /v1/crm/tickets/:ticketId` body. Every field is optional;
/// only the fields explicitly sent are modified on the document. The
/// handler always refreshes `updatedAt` regardless of which fields are
/// set.
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTicketInput {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subject: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub requester_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub channel: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub severity: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub product_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub priority: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub due_by: Option<chrono::DateTime<chrono::Utc>>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub assignee_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub linked_deal_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub linked_invoice_id: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent_ticket_id: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub internal_notes: Option<serde_json::Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub attachments: Option<serde_json::Value>,
}

impl UpdateTicketInput {
    /// `true` when no field is set — the handler short-circuits with a
    /// `BadRequest` to avoid pointless `updatedAt` churn.
    pub fn is_empty(&self) -> bool {
        self.subject.is_none()
            && self.requester_id.is_none()
            && self.channel.is_none()
            && self.severity.is_none()
            && self.product_id.is_none()
            && self.category.is_none()
            && self.priority.is_none()
            && self.due_by.is_none()
            && self.assignee_id.is_none()
            && self.status.is_none()
            && self.linked_deal_id.is_none()
            && self.linked_invoice_id.is_none()
            && self.parent_ticket_id.is_none()
            && self.internal_notes.is_none()
            && self.attachments.is_none()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_input_round_trips_camel_case() {
        let json = serde_json::json!({
            "subject": "Login broken",
            "requesterId": "507f1f77bcf86cd799439011",
            "channel": "whatsapp",
            "severity": "sev2",
            "category": "auth",
            "priority": "high",
            "linkedDealId": "507f1f77bcf86cd799439012",
        });
        let input: CreateTicketInput = serde_json::from_value(json).unwrap();
        assert_eq!(input.subject, "Login broken");
        assert_eq!(input.requester_id, "507f1f77bcf86cd799439011");
        assert_eq!(input.channel, "whatsapp");
        assert_eq!(input.severity, "sev2");
        assert_eq!(input.category.as_deref(), Some("auth"));
        assert_eq!(input.priority.as_deref(), Some("high"));
        assert_eq!(
            input.linked_deal_id.as_deref(),
            Some("507f1f77bcf86cd799439012")
        );
    }

    #[test]
    fn update_input_is_empty_detects_all_unset() {
        let empty = UpdateTicketInput::default();
        assert!(empty.is_empty());

        let with_field = UpdateTicketInput {
            status: Some("resolved".into()),
            ..Default::default()
        };
        assert!(!with_field.is_empty());
    }

    #[test]
    fn list_query_defaults_are_none() {
        let q: ListQuery = serde_json::from_value(serde_json::json!({})).unwrap();
        assert!(q.page.is_none());
        assert!(q.limit.is_none());
        assert!(q.q.is_none());
        assert!(q.status.is_none());
        assert!(q.severity.is_none());
        assert!(q.assignee_id.is_none());
        assert!(q.requester_id.is_none());
    }

    #[test]
    fn list_query_camel_case_filters() {
        let q: ListQuery = serde_json::from_value(serde_json::json!({
            "status": "open",
            "severity": "sev1",
            "assigneeId": "507f1f77bcf86cd799439011",
            "requesterId": "507f1f77bcf86cd799439012",
        }))
        .unwrap();
        assert_eq!(q.status.as_deref(), Some("open"));
        assert_eq!(q.severity.as_deref(), Some("sev1"));
        assert_eq!(q.assignee_id.as_deref(), Some("507f1f77bcf86cd799439011"));
        assert_eq!(q.requester_id.as_deref(), Some("507f1f77bcf86cd799439012"));
    }
}
