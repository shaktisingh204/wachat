//! HTTP handlers for the Voice Queue entity.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_common::{
    audit::{audit_for_create, audit_for_delete, audit_for_update, write_audit},
    pagination::{clamp_limit, skip_for},
    search::build_q_filter,
    tenant::user_oid,
};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    CreateQueueInput, CreateQueueResponse, DeleteQueueResponse, ListQuery, UpdateQueueInput,
};
use crate::types::VoiceQueue;

const COLL: &str = "sabvoice_queues";
const ENTITY_KIND: &str = "voice_queue";
const VALID_STRATEGY: &[&str] = &["round_robin", "least_busy", "simultaneous"];
const VALID_STATUS: &[&str] = &["active", "archived"];

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn validate_strategy(s: &str) -> Result<()> {
    if VALID_STRATEGY.contains(&s) {
        Ok(())
    } else {
        Err(ApiError::Validation(format!(
            "strategy must be one of {VALID_STRATEGY:?}"
        )))
    }
}

fn validate_status(s: &str) -> Result<()> {
    if VALID_STATUS.contains(&s) {
        Ok(())
    } else {
        Err(ApiError::Validation(format!(
            "status must be one of {VALID_STATUS:?}"
        )))
    }
}

fn parse_agent_ids(raw: Option<Vec<String>>) -> Vec<ObjectId> {
    raw.unwrap_or_default()
        .into_iter()
        .filter_map(|s| ObjectId::parse_str(&s).ok())
        .collect()
}

fn queue_from_create(input: CreateQueueInput, user_id: ObjectId) -> Result<VoiceQueue> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    let strategy = input.strategy.unwrap_or_else(|| "round_robin".to_owned());
    validate_strategy(&strategy)?;
    let status = input.status.unwrap_or_else(|| "active".to_owned());
    validate_status(&status)?;
    Ok(VoiceQueue {
        id: None,
        user_id,
        name: input.name.trim().to_owned(),
        description: input.description,
        strategy,
        agent_ids: parse_agent_ids(input.agent_ids),
        max_wait_secs: input.max_wait_secs.unwrap_or(60),
        fallback: input.fallback,
        hold_music_file_id: input.hold_music_file_id,
        status,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateQueueInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        let t = v.trim().to_owned();
        if t.is_empty() {
            return Err(ApiError::Validation("name cannot be empty".to_owned()));
        }
        set.insert("name", t);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.strategy {
        validate_strategy(&v)?;
        set.insert("strategy", v);
    }
    if let Some(v) = patch.agent_ids {
        let ids = parse_agent_ids(Some(v));
        set.insert("agentIds", ids);
    }
    if let Some(v) = patch.max_wait_secs {
        set.insert("maxWaitSecs", v);
    }
    if let Some(v) = patch.fallback {
        set.insert("fallback", v);
    }
    if let Some(v) = patch.hold_music_file_id {
        set.insert("holdMusicFileId", v);
    }
    if let Some(v) = patch.status {
        validate_status(&v)?;
        set.insert("status", v);
    }
    Ok(doc! { "$set": set })
}

fn doc_for_audit(entity: &VoiceQueue) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<VoiceQueue>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_queues(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = doc! { "userId": user_id };
    if let Some(s) = q.status.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        if s != "all" {
            filter.insert("status", s);
        }
    }
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "description"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<VoiceQueue>(COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabvoice_queues.find"))
        })?;
    let mut rows: Vec<VoiceQueue> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabvoice_queues.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %queue_id))]
pub async fn get_queue(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(queue_id): Path<String>,
) -> Result<Json<VoiceQueue>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&queue_id)?;
    let coll = mongo.collection::<VoiceQueue>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabvoice_queues.find_one")))?
        .ok_or_else(|| ApiError::NotFound("voice_queue".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_queue(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateQueueInput>,
) -> Result<Json<CreateQueueResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = queue_from_create(input, user_id)?;
    let coll = mongo.collection::<VoiceQueue>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabvoice_queues.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateQueueResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %queue_id))]
pub async fn update_queue(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(queue_id): Path<String>,
    Json(patch): Json<UpdateQueueInput>,
) -> Result<Json<VoiceQueue>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&queue_id)?;
    let coll = mongo.collection::<VoiceQueue>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabvoice_queues.find_one")))?
        .ok_or_else(|| ApiError::NotFound("voice_queue".to_owned()))?;
    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabvoice_queues.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("voice_queue".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabvoice_queues.refetch")))?
        .ok_or_else(|| ApiError::NotFound("voice_queue".to_owned()))?;
    if let Some(event) = audit_for_update(
        &user,
        ENTITY_KIND,
        oid,
        Some(doc_for_audit(&before)),
        Some(doc_for_audit(&after)),
    ) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %queue_id))]
pub async fn delete_queue(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(queue_id): Path<String>,
) -> Result<Json<DeleteQueueResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&queue_id)?;
    let coll = mongo.collection::<VoiceQueue>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabvoice_queues.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("voice_queue".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteQueueResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn queue_from_create_defaults() {
        let user_id = ObjectId::new();
        let input = CreateQueueInput {
            name: "Sales".into(),
            ..Default::default()
        };
        let q = queue_from_create(input, user_id).unwrap();
        assert_eq!(q.strategy, "round_robin");
        assert_eq!(q.status, "active");
        assert_eq!(q.max_wait_secs, 60);
    }

    #[test]
    fn rejects_bad_strategy() {
        let user_id = ObjectId::new();
        let input = CreateQueueInput {
            name: "Sales".into(),
            strategy: Some("warp_drive".into()),
            ..Default::default()
        };
        assert!(queue_from_create(input, user_id).is_err());
    }
}
