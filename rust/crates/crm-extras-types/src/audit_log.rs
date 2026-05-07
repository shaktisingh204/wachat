//! §12.21 Audit Log.
//!
//! Mongo collection: `crm_audit_log` (the global, immutable trail).
//! Per-entity timelines are stored as embedded `Vec<EntityTimelineEntry>`
//! on the host document — `EntityTimelineEntry` is provided here as
//! the canonical embedded shape so every entity that opts into a
//! timeline serialises the same way.
//!
//! Important naming note: `AuditEntry` flattens `Identity` so the audit
//! row carries its own `_id`, `projectId`, and (the tenant-root)
//! `userId` like every other doc. The `user_id` field directly on
//! `AuditEntry` is the **actor** — the human or system principal that
//! performed the action. The two coexist deliberately: you query the
//! collection by tenant `userId` (from `Identity`), then read the
//! actor `userId` to know who did it.
//!
//! Spec verbatim: Per-entity timeline (created, edited fields with
//! diff, status changes, comments, attachments added, emails sent,
//! calls logged, e-signs, payments). Global audit (user, IP, geo,
//! action, target, before/after, reason).

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Audit, Identity};
use serde::{Deserialize, Serialize};

/// One field-level diff inside an `update`. Stored as raw JSON on both
/// sides so the audit row is faithful to the wire shape — including
/// nested objects / arrays — without forcing a typed schema per
/// entity.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FieldDiff {
    pub field: String,
    pub before: serde_json::Value,
    pub after: serde_json::Value,
}

/// Action verb the audit row records. Multi-word variants serialise in
/// `snake_case` (`status_change`, `attachment_add`, `email_sent`,
/// `call_logged`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AuditAction {
    #[default]
    Create,
    Update,
    Delete,
    Restore,
    StatusChange,
    Comment,
    AttachmentAdd,
    EmailSent,
    CallLogged,
    Esign,
    Payment,
    Login,
    Logout,
    Export,
    Import,
    Other,
}

/// Global audit row — one event per write. `target_kind` + `target_id`
/// point at the entity the action was applied to (e.g. `"invoice"` +
/// the invoice's `_id`); `diffs` is the field-by-field before/after
/// for `Update` / `StatusChange` actions.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuditEntry {
    /* ----- crm-core fragments (flattened) ------------------------ */
    /// NOTE: `identity.user_id` here is the **tenant root** (the CRM
    /// owner's id), not the actor — the actor lives in `user_id`
    /// directly on this struct. Confusing-but-deliberate: matches the
    /// project-wide convention that every doc carries the tenant tuple.
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /* ----- actor + request envelope ------------------------------ */
    /// The actor — the user (or `None` for system jobs) that performed
    /// the action. Renamed from `user_id` to avoid the JSON-key
    /// collision with `Identity::user_id` (the tenant root) which
    /// flattens to the same `userId` slot.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub actor_id: Option<ObjectId>,
    /// Request IP (v4 / v6 / private). Persisted as a string so all
    /// forms round-trip without coercion.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ip: Option<String>,
    /// Resolved geo (e.g. `"IN-MH"`, `"US-CA"`). Free-form because the
    /// upstream IP-to-geo provider can return different granularities.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub geo: Option<String>,

    /* ----- the event --------------------------------------------- */
    pub action: AuditAction,
    /// What kind of entity was touched (e.g. `"invoice"`, `"client"`,
    /// `"workflow_run"`).
    pub target_kind: String,
    /// The id of that entity. `None` covers actions with no concrete
    /// target (e.g. `Login` / `Export` of a list view).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub target_id: Option<ObjectId>,

    /* ----- payload ----------------------------------------------- */
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub diffs: Vec<FieldDiff>,
    /// Operator-supplied reason — required for some sensitive actions
    /// (e.g. `Delete`, `StatusChange` overriding workflow).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,

    /* ----- when + correlation ------------------------------------ */
    /// Wall-clock time the event occurred. Distinct from
    /// `audit.created_at` (which is when the audit row itself was
    /// written) — for replayed / backfilled events the two diverge.
    pub at: DateTime<Utc>,
    /// Correlation token from the originating server-action call so a
    /// single user click that mutates several docs can be traced as one
    /// transaction.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub request_id: Option<String>,
}

/// Embedded entry on a host entity's `timeline: Vec<EntityTimelineEntry>`.
/// Not a top-level document — provided here so every entity that opts
/// into a per-entity timeline uses the same serialisation shape.
///
/// `kind` is one of `"created"`, `"edited"`, `"status_change"`,
/// `"comment"`, `"email"`, `"call"`, `"esign"`, `"payment"`. Free-form
/// string so new event types can be added without a schema migration;
/// the canonical set above is enforced by the writer.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EntityTimelineEntry {
    pub kind: String,
    pub at: DateTime<Utc>,
    /// Actor that produced the entry. `None` for system writes.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub by: Option<ObjectId>,
    /// One-line human-readable summary the timeline UI renders without
    /// having to inspect `payload`.
    pub summary: String,
    /// Event-specific structured payload. Field-level diffs for
    /// `edited`, message metadata for `email` / `call`, signed-by for
    /// `esign`, etc.
    #[serde(default)]
    pub payload: serde_json::Value,
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use serde_json::json;

    fn id() -> Identity {
        Identity {
            id: ObjectId::new(),
            project_id: ObjectId::new(),
            user_id: ObjectId::new(),
            tenant_id: None,
        }
    }

    #[test]
    fn audit_entry_round_trips_with_flattened_fragments() {
        let now = Utc::now();
        let actor = ObjectId::new();
        let target = ObjectId::new();

        let e = AuditEntry {
            identity: id(),
            audit: Audit::new(Some(actor)),
            actor_id: Some(actor),
            ip: Some("203.0.113.42".into()),
            geo: Some("IN-MH".into()),
            action: AuditAction::StatusChange,
            target_kind: "invoice".into(),
            target_id: Some(target),
            diffs: vec![FieldDiff {
                field: "status".into(),
                before: json!("draft"),
                after: json!("sent"),
            }],
            reason: Some("Customer approved by email.".into()),
            at: now,
            request_id: Some("req_01HX".into()),
        };

        let json_v = serde_json::to_value(&e).unwrap();
        // Flattened fragments at root.
        assert!(json_v.get("identity").is_none());
        assert!(json_v.get("audit").is_none());
        assert!(json_v.get("_id").is_some());
        assert!(json_v.get("projectId").is_some());
        assert!(json_v.get("createdAt").is_some());
        // camelCase entity fields.
        assert!(json_v.get("targetKind").is_some());
        assert!(json_v.get("targetId").is_some());
        assert!(json_v.get("requestId").is_some());
        // Action snake_case.
        assert_eq!(
            json_v.get("action").and_then(|v| v.as_str()),
            Some("status_change")
        );
        // Diff shape.
        let diff = json_v
            .get("diffs")
            .and_then(|v| v.as_array())
            .and_then(|a| a.first())
            .unwrap();
        assert_eq!(diff.get("field").and_then(|v| v.as_str()), Some("status"));
        assert_eq!(diff.get("before").and_then(|v| v.as_str()), Some("draft"));
        assert_eq!(diff.get("after").and_then(|v| v.as_str()), Some("sent"));

        let back: AuditEntry = serde_json::from_value(json_v).unwrap();
        assert!(matches!(back.action, AuditAction::StatusChange));
        assert_eq!(back.target_kind, "invoice");
        assert_eq!(back.diffs.len(), 1);
        assert_eq!(back.actor_id, Some(actor));
    }

    #[test]
    fn entity_timeline_entry_round_trips() {
        let entry = EntityTimelineEntry {
            kind: "status_change".into(),
            at: Utc::now(),
            by: Some(ObjectId::new()),
            summary: "Moved invoice from Draft to Sent".into(),
            payload: json!({ "from": "draft", "to": "sent" }),
        };

        let json_v = serde_json::to_value(&entry).unwrap();
        assert_eq!(
            json_v.get("kind").and_then(|v| v.as_str()),
            Some("status_change")
        );
        assert!(json_v.get("at").is_some());
        assert!(json_v.get("by").is_some());
        assert!(json_v.get("summary").is_some());
        assert!(json_v.get("payload").is_some());

        let back: EntityTimelineEntry = serde_json::from_value(json_v).unwrap();
        assert_eq!(back.kind, "status_change");
        assert_eq!(back.summary, "Moved invoice from Draft to Sent");
        assert_eq!(
            back.payload.get("to").and_then(|v| v.as_str()),
            Some("sent")
        );
    }
}
