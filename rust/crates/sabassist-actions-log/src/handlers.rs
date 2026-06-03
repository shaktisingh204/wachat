//! HTTP handlers for the append-only SabAssist action log.

use axum::{
    Json,
    extract::{Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::{DateTime, Utc};
use crm_common::tenant::user_oid;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{CreateActionLogInput, CreateActionLogResponse, ListQuery};
use crate::types::SabassistActionLog;

const COLL: &str = "sabassist_actions_log";
const VALID_ACTIONS: &[&str] = &[
    "connect",
    "disconnect",
    "elevate",
    "file_transfer",
    "annotation",
    "reboot_request",
];

fn validate_action(s: &str) -> Result<()> {
    if VALID_ACTIONS.contains(&s) {
        Ok(())
    } else {
        Err(ApiError::Validation(format!(
            "action must be one of {VALID_ACTIONS:?}"
        )))
    }
}

fn parse_iso(s: &str) -> Result<BsonDateTime> {
    let dt = DateTime::parse_from_rfc3339(s)
        .map_err(|_| ApiError::Validation(format!("'{s}' is not a valid ISO-8601 timestamp")))?;
    Ok(BsonDateTime::from_chrono(dt.with_timezone(&Utc)))
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabassistActionLog>,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_actions(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter: Document = doc! { "userId": user_id };
    if let Some(sid) = q.session_id.as_deref() {
        let oid = oid_from_str(sid)?;
        filter.insert("sessionId", oid);
    }
    if let Some(a) = q.action.as_deref().filter(|s| !s.is_empty()) {
        validate_action(a)?;
        filter.insert("action", a);
    }
    let mut range = doc! {};
    if let Some(from) = q.from.as_deref() {
        range.insert("$gte", parse_iso(from)?);
    }
    if let Some(to) = q.to.as_deref() {
        range.insert("$lte", parse_iso(to)?);
    }
    if !range.is_empty() {
        filter.insert("ts", range);
    }
    let limit = q.limit.unwrap_or(500).min(2_000) as i64;
    let opts = FindOptions::builder()
        .sort(doc! { "ts": -1 })
        .limit(limit)
        .build();
    let coll = mongo.collection::<SabassistActionLog>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabassist_actions_log.find"))
    })?;
    let rows: Vec<SabassistActionLog> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabassist_actions_log.collect"))
    })?;
    Ok(Json(ListResponse { items: rows }))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_action(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateActionLogInput>,
) -> Result<Json<CreateActionLogResponse>> {
    let user_id = user_oid(&user)?;
    validate_action(&input.action)?;
    let session_oid = oid_from_str(&input.session_id)?;

    let actor_user_id = match input.actor_user_id.as_deref() {
        Some(s) => ObjectId::parse_str(s)
            .map_err(|_| ApiError::Validation("actorUserId is not a valid id".to_owned()))?,
        None => user_id,
    };

    let ts = match input.ts.as_deref() {
        Some(s) => parse_iso(s)?,
        None => BsonDateTime::from_chrono(Utc::now()),
    };

    let payload_json = input
        .payload_json
        .map(|v| {
            bson::to_bson(&v).map_err(|e| {
                ApiError::Internal(
                    anyhow::Error::new(e).context("sabassist_actions_log.payload_bson"),
                )
            })
        })
        .transpose()?;

    let mut entity = SabassistActionLog {
        id: None,
        user_id,
        session_id: session_oid,
        ts,
        actor_user_id,
        action: input.action,
        payload_json,
    };
    let coll = mongo.collection::<SabassistActionLog>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabassist_actions_log.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(CreateActionLogResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_action_accepts_known_kinds() {
        for a in VALID_ACTIONS {
            assert!(validate_action(a).is_ok());
        }
    }

    #[test]
    fn validate_action_rejects_unknown() {
        assert!(validate_action("blowup").is_err());
    }
}
