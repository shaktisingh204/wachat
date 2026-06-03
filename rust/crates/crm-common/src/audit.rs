//! CRM audit-event shape + best-effort writer.
//!
//! Targets the `crm_audit_log` collection — the same destination as the TS
//! writer at `src/lib/audit-log.ts`. The field shape mirrors the TS
//! `writeAuditEntry` insert so Rust-side mutations are read-compatible
//! with the existing §12.21 audit-log page.
//!
//! "Best-effort" = an audit write failure NEVER unwinds the user's mutation.
//! Callers should still `.await` the write so they get a tracing log on
//! failure.

use bson::{Document, doc, oid::ObjectId};
use chrono::{DateTime, Utc};
use sabnode_auth::AuthUser;
use sabnode_db::mongo::MongoHandle;
use serde::{Deserialize, Serialize};
use tracing::warn;

const AUDIT_COLL: &str = "crm_audit_log";

/// Single audit event row. Field names match what the TS read-side at
/// `src/app/dashboard/crm/audit-log/page.tsx` already expects.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEvent {
    /// Tenant root — usually the AuthUser.user_id ObjectId.
    #[serde(rename = "userId")]
    pub tenant_user_id: ObjectId,
    /// Actor performing the action. In single-user tenants this matches
    /// `tenant_user_id`.
    #[serde(rename = "actorId")]
    pub actor_id: ObjectId,
    /// Verb (`create`, `update`, `delete`, `archive`, `convert`, …).
    pub action: String,
    /// What entity was acted on (`invoice`, `lead`, `quotation`, …).
    #[serde(rename = "entityKind")]
    pub entity_kind: String,
    /// `_id` of the entity, hex string.
    #[serde(rename = "entityId")]
    pub entity_id: String,
    /// One-line context (PR ref, "status flipped to paid", etc.).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    /// Free-form before/after diff. Caller decides structure.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub diff: Option<Document>,
    /// Wall-clock timestamp.
    #[serde(
        rename = "createdAt",
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime"
    )]
    pub created_at: DateTime<Utc>,
}

fn parse_actor(actor: &AuthUser) -> Option<ObjectId> {
    ObjectId::parse_str(&actor.user_id).ok()
}

/// Build an `AuditEvent` for a freshly-created entity.
pub fn audit_for_create(
    actor: &AuthUser,
    entity_kind: &str,
    entity_id: ObjectId,
    after: Option<Document>,
) -> Option<AuditEvent> {
    let oid = parse_actor(actor)?;
    Some(AuditEvent {
        tenant_user_id: oid,
        actor_id: oid,
        action: "create".to_owned(),
        entity_kind: entity_kind.to_owned(),
        entity_id: entity_id.to_hex(),
        reason: None,
        diff: after.map(|after| doc! { "entity": { "after": after } }),
        created_at: Utc::now(),
    })
}

/// Build an `AuditEvent` for an in-place update.
pub fn audit_for_update(
    actor: &AuthUser,
    entity_kind: &str,
    entity_id: ObjectId,
    before: Option<Document>,
    after: Option<Document>,
) -> Option<AuditEvent> {
    let oid = parse_actor(actor)?;
    let diff = if before.is_some() || after.is_some() {
        Some(doc! { "entity": { "before": before, "after": after } })
    } else {
        None
    };
    Some(AuditEvent {
        tenant_user_id: oid,
        actor_id: oid,
        action: "update".to_owned(),
        entity_kind: entity_kind.to_owned(),
        entity_id: entity_id.to_hex(),
        reason: None,
        diff,
        created_at: Utc::now(),
    })
}

/// Build an `AuditEvent` for a delete.
pub fn audit_for_delete(
    actor: &AuthUser,
    entity_kind: &str,
    entity_id: ObjectId,
) -> Option<AuditEvent> {
    let oid = parse_actor(actor)?;
    Some(AuditEvent {
        tenant_user_id: oid,
        actor_id: oid,
        action: "delete".to_owned(),
        entity_kind: entity_kind.to_owned(),
        entity_id: entity_id.to_hex(),
        reason: None,
        diff: None,
        created_at: Utc::now(),
    })
}

/// Best-effort insert into `crm_audit_log`. Failures are logged via
/// `tracing::warn!` but never bubble — callers can `.await` without try/catch.
pub async fn write_audit(mongo: &MongoHandle, event: AuditEvent) {
    let coll = mongo
        .client
        .database(&mongo.db_name)
        .collection::<AuditEvent>(AUDIT_COLL);
    if let Err(e) = coll.insert_one(&event).await {
        warn!(
            entity = %event.entity_kind,
            action = %event.action,
            error = %e,
            "crm_audit_log insert failed (best-effort)",
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_actor(id_hex: &str) -> AuthUser {
        AuthUser {
            user_id: id_hex.to_owned(),
            tenant_id: id_hex.to_owned(),
            roles: vec![],
        }
    }

    #[test]
    fn create_event_carries_action() {
        let oid = ObjectId::new();
        let actor = make_actor(&oid.to_hex());
        let entity_id = ObjectId::new();
        let e = audit_for_create(&actor, "invoice", entity_id, None).expect("ok");
        assert_eq!(e.action, "create");
        assert_eq!(e.entity_kind, "invoice");
        assert_eq!(e.entity_id, entity_id.to_hex());
    }

    #[test]
    fn update_event_includes_diff() {
        let oid = ObjectId::new();
        let actor = make_actor(&oid.to_hex());
        let entity_id = ObjectId::new();
        let before = doc! { "status": "draft" };
        let after = doc! { "status": "sent" };
        let e =
            audit_for_update(&actor, "invoice", entity_id, Some(before), Some(after)).expect("ok");
        assert_eq!(e.action, "update");
        assert!(e.diff.is_some());
    }

    #[test]
    fn delete_event_no_diff() {
        let oid = ObjectId::new();
        let actor = make_actor(&oid.to_hex());
        let entity_id = ObjectId::new();
        let e = audit_for_delete(&actor, "invoice", entity_id).expect("ok");
        assert_eq!(e.action, "delete");
        assert!(e.diff.is_none());
    }

    #[test]
    fn invalid_actor_yields_none() {
        let actor = make_actor("not-an-oid");
        let entity_id = ObjectId::new();
        assert!(audit_for_create(&actor, "invoice", entity_id, None).is_none());
    }
}
