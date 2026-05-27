//! SabVault audit-log handlers.
//!
//! `GET /` — list (tenant-scoped: actor OR secret owner).
//! `POST /` — append a single access event (used by the UI to log
//! reveal/copy/view client-side).

use axum::{
    Json,
    extract::{Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_common::{
    pagination::{clamp_limit, skip_for},
    tenant::user_oid,
};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{ListQuery, ListResponse, LogAccessInput, LogAccessResponse};
use crate::types::{AuditAction, SabvaultAuditEntry};

pub const AUDIT_COLL: &str = "sabvault_audit";
const SECRETS_COLL: &str = "sabvault_secrets";

fn action_str(a: &AuditAction) -> &'static str {
    match a {
        AuditAction::View => "view",
        AuditAction::Copy => "copy",
        AuditAction::Reveal => "reveal",
        AuditAction::Edit => "edit",
        AuditAction::Share => "share",
        AuditAction::Revoke => "revoke",
        AuditAction::Create => "create",
        AuditAction::Delete => "delete",
        AuditAction::UnlockFail => "unlock_fail",
        AuditAction::UnlockOk => "unlock_ok",
    }
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_audit(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;

    // Tenant scope: caller sees rows where they're the secret owner OR the actor.
    let mut filter = doc! {
        "$or": [
            { "userId": user_id },
            { "actorUserId": user_id },
        ]
    };
    if let Some(s) = q.secret_id.as_deref().filter(|s| !s.is_empty()) {
        if let Ok(oid) = ObjectId::parse_str(s) {
            filter.insert("secretId", oid);
        }
    }
    if let Some(a) = q.actor_user_id.as_deref().filter(|s| !s.is_empty()) {
        if let Ok(oid) = ObjectId::parse_str(a) {
            filter.insert("actorUserId", oid);
        }
    }
    if let Some(a) = q.action {
        filter.insert("action", action_str(&a));
    }
    if q.from.is_some() || q.to.is_some() {
        let mut range = Document::new();
        if let Some(f) = q.from {
            range.insert("$gte", BsonDateTime::from_chrono(f));
        }
        if let Some(t) = q.to {
            range.insert("$lt", BsonDateTime::from_chrono(t));
        }
        filter.insert("ts", range);
    }

    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "ts": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();

    let coll = mongo.collection::<SabvaultAuditEntry>(AUDIT_COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabvault_audit.find")))?;
    let mut rows: Vec<SabvaultAuditEntry> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabvault_audit.collect"))
    })?;
    let has_more = rows.len() as i64 > limit;
    if has_more {
        rows.truncate(limit as usize);
    }
    Ok(Json(ListResponse {
        items: rows,
        page: q.page.unwrap_or(0),
        limit: limit as u32,
        has_more,
    }))
}

/// Append a single access event. The `userId` on the row is the secret's
/// owner (looked up from `sabvault_secrets`) — that's what we tenant-scope
/// list reads against. If no secret is referenced, we use the actor's id.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn log_access(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<LogAccessInput>,
) -> Result<Json<LogAccessResponse>> {
    let actor_id = user_oid(&user)?;

    let (secret_oid, owner_id) = if let Some(s) = input.secret_id.as_deref().filter(|s| !s.is_empty()) {
        let oid = oid_from_str(s)?;
        // Resolve the secret's owner so the audit row is filed under their tenant.
        let secrets = mongo.collection::<Document>(SECRETS_COLL);
        let row = secrets
            .find_one(doc! { "_id": oid })
            .await
            .map_err(|e| {
                ApiError::Internal(anyhow::Error::new(e).context("audit.secret_lookup"))
            })?
            .ok_or_else(|| ApiError::NotFound("sabvault_secret".to_owned()))?;
        let owner = row
            .get_object_id("userId")
            .map_err(|_| ApiError::Internal(anyhow::anyhow!("secret missing userId")))?;
        (Some(oid), owner)
    } else {
        (None, actor_id)
    };

    let meta_doc = match input.meta {
        Some(v) => match bson::to_bson(&v) {
            Ok(bson::Bson::Document(d)) => Some(d),
            _ => None,
        },
        None => None,
    };

    let entry = SabvaultAuditEntry {
        id: None,
        user_id: owner_id,
        secret_id: secret_oid,
        actor_user_id: actor_id,
        action: input.action,
        ip: input.ip,
        user_agent: input.user_agent,
        meta: meta_doc,
        ts: BsonDateTime::from_chrono(Utc::now()),
    };

    let coll = mongo.collection::<SabvaultAuditEntry>(AUDIT_COLL);
    let inserted = coll.insert_one(&entry).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabvault_audit.insert"))
    })?;
    let id = inserted
        .inserted_id
        .as_object_id()
        .map(|o| o.to_hex())
        .unwrap_or_default();
    Ok(Json(LogAccessResponse { id }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn action_strs() {
        assert_eq!(action_str(&AuditAction::View), "view");
        assert_eq!(action_str(&AuditAction::UnlockFail), "unlock_fail");
        assert_eq!(action_str(&AuditAction::Reveal), "reveal");
    }
}
