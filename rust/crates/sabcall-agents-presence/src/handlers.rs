//! HTTP handlers for agent presence.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, doc, oid::ObjectId};
use chrono::Utc;
use crm_common::tenant::user_oid;
use futures::TryStreamExt;
use mongodb::options::{FindOneAndUpdateOptions, ReturnDocument};
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{ListQuery, PresenceListResponse, PresenceUpsertResponse, UpsertPresenceInput};
use crate::types::AgentPresence;

const COLL: &str = "sabcall_agents_presence";
const VALID_STATUS: &[&str] = &["available", "busy", "away", "offline"];

fn validate_status(s: &str) -> Result<()> {
    if VALID_STATUS.contains(&s) {
        Ok(())
    } else {
        Err(ApiError::Validation(format!(
            "status must be one of {VALID_STATUS:?}"
        )))
    }
}

fn parse_oids(raw: Option<Vec<String>>) -> Vec<ObjectId> {
    raw.unwrap_or_default()
        .into_iter()
        .filter_map(|s| ObjectId::parse_str(&s).ok())
        .collect()
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_presence(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<PresenceListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = doc! { "userId": user_id };
    if let Some(s) = q.status.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        validate_status(s)?;
        filter.insert("status", s);
    }
    if let Some(qid) = q
        .queue_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("queueIds", qid);
    }
    let coll = mongo.collection::<AgentPresence>(COLL);
    let cursor = coll
        .find(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("agent_presence.find")))?;
    let rows: Vec<AgentPresence> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("agent_presence.collect")))?;
    Ok(Json(PresenceListResponse { items: rows }))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn upsert_presence(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<UpsertPresenceInput>,
) -> Result<Json<PresenceUpsertResponse>> {
    let user_id = user_oid(&user)?;
    validate_status(&input.status)?;
    let agent_oid = ObjectId::parse_str(input.agent_user_id.trim())
        .map_err(|_| ApiError::Validation("agentUserId must be a valid ObjectId".to_owned()))?;
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut set = doc! {
        "status": &input.status,
        "lastChangeAt": now,
    };
    if let Some(call) = input
        .active_call_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("activeCallId", call);
    }
    if input.queue_ids.is_some() {
        set.insert("queueIds", parse_oids(input.queue_ids));
    }
    if let Some(name) = input.display_name {
        set.insert("displayName", name);
    }

    let coll = mongo.collection::<AgentPresence>(COLL);
    let opts = FindOneAndUpdateOptions::builder()
        .upsert(true)
        .return_document(ReturnDocument::After)
        .build();
    let updated = coll
        .find_one_and_update(
            doc! { "userId": user_id, "agentUserId": agent_oid },
            doc! {
                "$set": set,
                "$setOnInsert": { "userId": user_id, "agentUserId": agent_oid },
            },
        )
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("agent_presence.upsert")))?
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("upsert returned no document")))?;
    Ok(Json(PresenceUpsertResponse { entity: updated }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %agent_id))]
pub async fn get_presence(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(agent_id): Path<String>,
) -> Result<Json<AgentPresence>> {
    let user_id = user_oid(&user)?;
    let agent_oid = oid_from_str(&agent_id)?;
    let coll = mongo.collection::<AgentPresence>(COLL);
    let row = coll
        .find_one(doc! { "userId": user_id, "agentUserId": agent_oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("agent_presence.get")))?
        .ok_or_else(|| ApiError::NotFound("agent_presence".to_owned()))?;
    Ok(Json(row))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn valid_statuses_pass() {
        for s in VALID_STATUS {
            assert!(validate_status(s).is_ok());
        }
    }

    #[test]
    fn invalid_status_fails() {
        assert!(validate_status("ghosted").is_err());
    }
}
