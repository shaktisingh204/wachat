//! Tiny internal helper for writing append-only events to the
//! `sabchat_audit_log` collection.
//!
//! Every mutating handler in [`crate::handlers`] writes one event so
//! reporting and the activity feed can replay the timeline. The
//! handlers build the document inline (via `bson::doc!`) and hand it
//! off here for the single Mongo write. We deliberately do **not**
//! type-check the document shape — the audit log is intentionally
//! schemaless, and the canonical structure lives in
//! [`sabchat_types::SabChatAuditEvent`].

use bson::Document;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;

/// Mongo collection name for the audit log. Centralised here so every
/// caller writes to the same place.
pub(crate) const AUDIT_COLL: &str = "sabchat_audit_log";

/// Append a single audit event. The document must already include
/// `_id`, `tenantId`, `action`, `createdAt`, and the actor fields — the
/// caller owns the schema.
///
/// We swallow nothing: a failed audit write surfaces as
/// [`ApiError::Internal`] so the calling handler returns 500. That is
/// intentional — the audit log is part of the contract; silently
/// dropping events would compromise reporting.
pub(crate) async fn write_audit(mongo: &MongoHandle, event: Document) -> Result<()> {
    let coll = mongo.collection::<Document>(AUDIT_COLL);
    coll.insert_one(event).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_audit_log.insert_one"))
    })?;
    Ok(())
}
