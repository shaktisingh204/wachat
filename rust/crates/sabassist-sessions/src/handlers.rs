//! HTTP handlers for SabAssist sessions.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::{DateTime, Utc};
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
    CreateSessionInput, CreateSessionResponse, DeleteSessionResponse, ListQuery, UpdateSessionInput,
};
use crate::types::SabassistSession;

const COLL: &str = "sabassist_sessions";
const ENTITY_KIND: &str = "sabassist_session";
const VALID_STATUS: &[&str] = &["scheduled", "active", "ended"];
const VALID_MODE: &[&str] = &["attended", "unattended"];

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn parse_iso(s: &str) -> Result<BsonDateTime> {
    let dt = DateTime::parse_from_rfc3339(s).map_err(|_| {
        ApiError::Validation(format!("'{s}' is not a valid ISO-8601 timestamp"))
    })?;
    Ok(BsonDateTime::from_chrono(dt.with_timezone(&Utc)))
}

fn maybe_oid(opt: Option<&str>) -> Option<ObjectId> {
    opt.and_then(|s| ObjectId::parse_str(s).ok())
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

fn validate_mode(s: &str) -> Result<()> {
    if VALID_MODE.contains(&s) {
        Ok(())
    } else {
        Err(ApiError::Validation(format!(
            "mode must be one of {VALID_MODE:?}"
        )))
    }
}

fn session_from_create(input: CreateSessionInput, user_id: ObjectId) -> Result<SabassistSession> {
    validate_mode(&input.mode)?;
    let status = input.status.unwrap_or_else(|| "scheduled".to_owned());
    validate_status(&status)?;
    let technician_user_id = match input.technician_user_id.as_deref() {
        Some(s) => ObjectId::parse_str(s)
            .map_err(|_| ApiError::Validation("technicianUserId is not a valid id".to_owned()))?,
        None => user_id,
    };
    Ok(SabassistSession {
        id: None,
        user_id,
        technician_user_id,
        customer_name: input.customer_name,
        customer_email: input.customer_email,
        call_id: maybe_oid(input.call_id.as_deref()),
        status,
        mode: input.mode,
        started_at: None,
        ended_at: None,
        duration_secs: None,
        recording_file_id: None,
        device_id: maybe_oid(input.device_id.as_deref()),
        notes: input.notes,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateSessionInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.status {
        validate_status(&v)?;
        set.insert("status", v);
    }
    if let Some(v) = patch.started_at {
        set.insert("startedAt", parse_iso(&v)?);
    }
    if let Some(v) = patch.ended_at {
        set.insert("endedAt", parse_iso(&v)?);
    }
    if let Some(v) = patch.duration_secs {
        set.insert("durationSecs", v);
    }
    if let Some(v) = patch.recording_file_id {
        set.insert("recordingFileId", v);
    }
    if let Some(v) = patch.notes {
        set.insert("notes", v);
    }
    if let Some(v) = patch.customer_name {
        set.insert("customerName", v);
    }
    if let Some(v) = patch.customer_email {
        set.insert("customerEmail", v);
    }
    Ok(doc! { "$set": set })
}

fn doc_for_audit(entity: &SabassistSession) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabassistSession>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_sessions(
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
    if let Some(m) = q.mode.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("mode", m);
    }
    if let Some(c) = maybe_oid(q.call_id.as_deref()) {
        filter.insert("callId", c);
    }
    if let Some(d) = maybe_oid(q.device_id.as_deref()) {
        filter.insert("deviceId", d);
    }
    let mut range = doc! {};
    if let Some(from) = q.from.as_deref() {
        range.insert("$gte", parse_iso(from)?);
    }
    if let Some(to) = q.to.as_deref() {
        range.insert("$lte", parse_iso(to)?);
    }
    if !range.is_empty() {
        filter.insert("createdAt", range);
    }
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["customerName", "customerEmail", "notes"]);
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
    let coll = mongo.collection::<SabassistSession>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabassist_sessions.find"))
        })?;
    let mut rows: Vec<SabassistSession> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabassist_sessions.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %session_id))]
pub async fn get_session(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(session_id): Path<String>,
) -> Result<Json<SabassistSession>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&session_id)?;
    let coll = mongo.collection::<SabassistSession>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabassist_sessions.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabassist_session".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_session(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateSessionInput>,
) -> Result<Json<CreateSessionResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = session_from_create(input, user_id)?;
    let coll = mongo.collection::<SabassistSession>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabassist_sessions.insert"))
        })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) =
        audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateSessionResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %session_id))]
pub async fn update_session(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(session_id): Path<String>,
    Json(patch): Json<UpdateSessionInput>,
) -> Result<Json<SabassistSession>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&session_id)?;
    let coll = mongo.collection::<SabassistSession>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabassist_sessions.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabassist_session".to_owned()))?;
    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabassist_sessions.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("sabassist_session".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabassist_sessions.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabassist_session".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %session_id))]
pub async fn delete_session(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(session_id): Path<String>,
) -> Result<Json<DeleteSessionResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&session_id)?;
    let coll = mongo.collection::<SabassistSession>(COLL);
    let result = coll
        .delete_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabassist_sessions.delete"))
        })?;
    if result.deleted_count == 0 {
        return Err(ApiError::NotFound("sabassist_session".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteSessionResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn session_from_create_defaults_status_to_scheduled() {
        let user_id = ObjectId::new();
        let input = CreateSessionInput {
            mode: "attended".into(),
            ..Default::default()
        };
        let s = session_from_create(input, user_id).unwrap();
        assert_eq!(s.status, "scheduled");
        assert_eq!(s.technician_user_id, user_id);
        assert_eq!(s.mode, "attended");
    }

    #[test]
    fn session_from_create_rejects_bad_mode() {
        let user_id = ObjectId::new();
        let input = CreateSessionInput {
            mode: "exploded".into(),
            ..Default::default()
        };
        assert!(session_from_create(input, user_id).is_err());
    }
}
