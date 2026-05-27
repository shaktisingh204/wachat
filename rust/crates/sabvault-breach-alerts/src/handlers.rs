//! SabVault breach-alert cache handlers.
//!
//! The actual breach lookup (HIBP / pwnedpasswords) is performed CLIENT-SIDE
//! using k-anonymity so the cleartext credential never leaves the browser.
//! This crate just records the resulting `{ clean | breached | unknown }`
//! verdict per secret, and propagates `breached: bool` onto the parent
//! `sabvault_secrets` row so the health dashboard can filter cheaply.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_common::{
    audit::{audit_for_create, write_audit},
    pagination::{clamp_limit, skip_for},
    tenant::user_oid,
};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{ListQuery, ListResponse, UpsertBreachInput, UpsertBreachResponse};
use crate::types::{BreachStatus, SabvaultBreachAlert};

pub const BREACH_COLL: &str = "sabvault_breach_alerts";
const SECRETS_COLL: &str = "sabvault_secrets";
const ENTITY_KIND: &str = "sabvault_breach_alert";

fn status_str(s: &BreachStatus) -> &'static str {
    match s {
        BreachStatus::Clean => "clean",
        BreachStatus::Breached => "breached",
        BreachStatus::Unknown => "unknown",
    }
}

async fn assert_secret_owner(
    mongo: &MongoHandle,
    user_id: ObjectId,
    secret_oid: ObjectId,
) -> Result<()> {
    let coll = mongo.collection::<Document>(SECRETS_COLL);
    let found = coll
        .find_one(doc! { "_id": secret_oid, "userId": user_id })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("breach.owner_check"))
        })?;
    if found.is_none() {
        return Err(ApiError::Forbidden(
            "only the secret owner may record a breach result".to_owned(),
        ));
    }
    Ok(())
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_breaches(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = doc! { "userId": user_id };
    if let Some(s) = q.secret_id.as_deref().filter(|s| !s.is_empty()) {
        if let Ok(oid) = ObjectId::parse_str(s) {
            filter.insert("secretId", oid);
        }
    }
    if let Some(s) = q.status {
        filter.insert("status", status_str(&s));
    }

    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "lastCheckedAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();

    let coll = mongo.collection::<SabvaultBreachAlert>(BREACH_COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabvault_breach_alerts.find"))
        })?;
    let mut rows: Vec<SabvaultBreachAlert> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabvault_breach_alerts.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn get_breach_for_secret(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(secret_id): Path<String>,
) -> Result<Json<SabvaultBreachAlert>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&secret_id)?;
    let coll = mongo.collection::<SabvaultBreachAlert>(BREACH_COLL);
    let row = coll
        .find_one(doc! { "userId": user_id, "secretId": oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabvault_breach_alerts.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabvault_breach_alert".to_owned()))?;
    Ok(Json(row))
}

/// Upsert — one row per `(userId, secretId)`. Also propagates `breached`
/// onto the parent secret for cheap health-dashboard filtering.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn upsert_breach(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<UpsertBreachInput>,
) -> Result<Json<UpsertBreachResponse>> {
    let user_id = user_oid(&user)?;
    let secret_oid = oid_from_str(&input.secret_id)?;
    assert_secret_owner(&mongo, user_id, secret_oid).await?;

    let now = BsonDateTime::from_chrono(Utc::now());
    let status_s = status_str(&input.status);

    let mut set = doc! {
        "userId": user_id,
        "secretId": secret_oid,
        "status": status_s,
        "lastCheckedAt": now,
    };
    if let Some(v) = input.source.clone() {
        set.insert("source", v);
    }
    if let Some(v) = input.breach_source_url.clone() {
        set.insert("breachSourceUrl", v);
    }
    if let Some(v) = input.breach_count {
        set.insert("breachCount", v as i64);
    }
    if let Some(v) = input.note.clone() {
        set.insert("note", v);
    }

    let coll = mongo.collection::<Document>(BREACH_COLL);
    use mongodb::options::UpdateOptions;
    let update_opts = UpdateOptions::builder().upsert(true).build();
    coll.update_one(
        doc! { "userId": user_id, "secretId": secret_oid },
        doc! { "$set": set },
    )
    .with_options(update_opts)
    .await
    .map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabvault_breach_alerts.upsert"))
    })?;

    // Propagate to parent secret.
    let secrets = mongo.collection::<Document>(SECRETS_COLL);
    secrets
        .update_one(
            doc! { "_id": secret_oid, "userId": user_id },
            doc! { "$set": {
                "breached": matches!(input.status, BreachStatus::Breached),
                "updatedAt": now,
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabvault_breach_alerts.propagate"),
            )
        })?;

    // Re-read for response.
    let typed = mongo.collection::<SabvaultBreachAlert>(BREACH_COLL);
    let row = typed
        .find_one(doc! { "userId": user_id, "secretId": secret_oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabvault_breach_alerts.refetch"))
        })?
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("upsert vanished")))?;

    let id = row
        .id
        .as_ref()
        .map(|o| o.to_hex())
        .unwrap_or_default();

    if let Some(event) = audit_for_create(
        &user,
        ENTITY_KIND,
        row.id.unwrap_or_else(ObjectId::new),
        Some(bson::to_document(&row).unwrap_or_default()),
    ) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(UpsertBreachResponse { id, entity: row }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn status_strs() {
        assert_eq!(status_str(&BreachStatus::Clean), "clean");
        assert_eq!(status_str(&BreachStatus::Breached), "breached");
        assert_eq!(status_str(&BreachStatus::Unknown), "unknown");
    }
}
