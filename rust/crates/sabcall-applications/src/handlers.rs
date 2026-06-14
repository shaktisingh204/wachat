//! HTTP handlers for the Voice Application entity.

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
    CreateApplicationInput, CreateApplicationResponse, DeleteApplicationResponse, ListQuery,
    UpdateApplicationInput,
};
use crate::types::VoiceApplication;

const COLL: &str = "sabcall_applications";
const ENTITY_KIND: &str = "voice_application";
const VALID_STATUSES: &[&str] = &["active", "disabled"];
const VALID_TYPES: &[&str] = &["webhook", "ivr", "queue", "dial", "autopilot"];

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn list_filter(user_id: ObjectId, status: Option<&str>, app_type: Option<&str>) -> Document {
    let mut filter = doc! { "userId": user_id };
    if let Some(s) = status.map(str::trim).filter(|s| !s.is_empty()) {
        if s != "all" {
            filter.insert("status", s);
        }
    }
    if let Some(t) = app_type.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("type", t);
    }
    filter
}

fn validate_status(s: &str) -> Result<()> {
    if VALID_STATUSES.contains(&s) {
        Ok(())
    } else {
        Err(ApiError::Validation(format!(
            "status must be one of {VALID_STATUSES:?}"
        )))
    }
}

fn validate_type(t: &str) -> Result<()> {
    if VALID_TYPES.contains(&t) {
        Ok(())
    } else {
        Err(ApiError::Validation(format!(
            "type must be one of {VALID_TYPES:?}"
        )))
    }
}

fn application_from_create(
    input: CreateApplicationInput,
    user_id: ObjectId,
) -> Result<VoiceApplication> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    let app_type = input.app_type.unwrap_or_else(|| "ivr".to_owned());
    validate_type(app_type.trim())?;
    let status = input.status.unwrap_or_else(|| "active".to_owned());
    validate_status(&status)?;
    Ok(VoiceApplication {
        id: None,
        user_id,
        name: input.name.trim().to_owned(),
        app_type: app_type.trim().to_owned(),
        webhook_url: input.webhook_url,
        ivr_id: input
            .ivr_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        queue_id: input
            .queue_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        dial_target: input.dial_target,
        fallback_url: input.fallback_url,
        record_calls: input.record_calls.unwrap_or(false),
        stt_enabled: input.stt_enabled.unwrap_or(false),
        tts_voice: input.tts_voice,
        status,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateApplicationInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        set.insert("name", v.trim().to_owned());
    }
    if let Some(v) = patch.app_type {
        validate_type(v.trim())?;
        set.insert("type", v.trim().to_owned());
    }
    if let Some(v) = patch.webhook_url {
        set.insert("webhookUrl", v);
    }
    if let Some(v) = patch
        .ivr_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("ivrId", v);
    }
    if let Some(v) = patch
        .queue_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("queueId", v);
    }
    if let Some(v) = patch.dial_target {
        set.insert("dialTarget", v);
    }
    if let Some(v) = patch.fallback_url {
        set.insert("fallbackUrl", v);
    }
    if let Some(v) = patch.record_calls {
        set.insert("recordCalls", v);
    }
    if let Some(v) = patch.stt_enabled {
        set.insert("sttEnabled", v);
    }
    if let Some(v) = patch.tts_voice {
        set.insert("ttsVoice", v);
    }
    if let Some(v) = patch.status {
        validate_status(&v)?;
        set.insert("status", v);
    }
    Ok(doc! { "$set": set })
}

fn doc_for_audit(entity: &VoiceApplication) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<VoiceApplication>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_applications(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref(), q.app_type.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name"]);
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
    let coll = mongo.collection::<VoiceApplication>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcall_applications.find"))
        })?;
    let mut rows: Vec<VoiceApplication> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcall_applications.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %application_id))]
pub async fn get_application(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(application_id): Path<String>,
) -> Result<Json<VoiceApplication>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&application_id)?;
    let coll = mongo.collection::<VoiceApplication>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcall_applications.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("voice_application".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_application(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateApplicationInput>,
) -> Result<Json<CreateApplicationResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = application_from_create(input, user_id)?;
    let coll = mongo.collection::<VoiceApplication>(COLL);

    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcall_applications.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateApplicationResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %application_id))]
pub async fn update_application(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(application_id): Path<String>,
    Json(patch): Json<UpdateApplicationInput>,
) -> Result<Json<VoiceApplication>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&application_id)?;
    let coll = mongo.collection::<VoiceApplication>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcall_applications.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("voice_application".to_owned()))?;

    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcall_applications.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("voice_application".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcall_applications.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("voice_application".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %application_id))]
pub async fn delete_application(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(application_id): Path<String>,
) -> Result<Json<DeleteApplicationResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&application_id)?;
    let coll = mongo.collection::<VoiceApplication>(COLL);
    let result = coll
        .delete_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcall_applications.delete"))
        })?;
    if result.deleted_count == 0 {
        return Err(ApiError::NotFound("voice_application".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteApplicationResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn application_from_create_defaults_type_and_status() {
        let user_id = ObjectId::new();
        let input = CreateApplicationInput {
            name: "Main IVR".into(),
            ..Default::default()
        };
        let a = application_from_create(input, user_id).unwrap();
        assert_eq!(a.app_type, "ivr");
        assert_eq!(a.status, "active");
        assert_eq!(a.name, "Main IVR");
        assert!(!a.record_calls);
        assert!(!a.stt_enabled);
    }

    #[test]
    fn application_from_create_rejects_bad_type() {
        let user_id = ObjectId::new();
        let input = CreateApplicationInput {
            name: "Bad".into(),
            app_type: Some("bogus".into()),
            ..Default::default()
        };
        assert!(application_from_create(input, user_id).is_err());
    }
}
